import React, { useEffect, useMemo, useState } from 'react';
import { canCreateMarker } from '../../services/zoneService';
import { MarkerData } from '../../types/marker';
import { useIncompleteMarkers } from '../../hooks/useMarkerCompleteness';
import { offlineContentStorage } from '../../services/offlineContentStorage';
import { useAuth } from '../../contexts/AuthContext';
import { FaCloud, FaImage } from 'react-icons/fa';

interface MarkerFormModalProps {
  mode: 'add' | 'edit' | 'suggest';
  initialData?: Partial<MarkerData>;
  onSubmit: (data: Partial<MarkerData>) => void;
  onCancel: () => void;
}

const MarkerFormModal: React.FC<MarkerFormModalProps> = ({ mode, initialData = {}, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<MarkerData>>(initialData);
  const { fetchIncompleteMarkers } = useIncompleteMarkers();
  const [nearbyIncomplete, setNearbyIncomplete] = useState<any[]>([]);
  const [isCheckingNearby, setIsCheckingNearby] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const { user } = useAuth();
  const canCheckDuplicates = useMemo(() => typeof formData.latitude === 'number' && typeof formData.longitude === 'number' && (formData.title || '').length >= 3, [formData.latitude, formData.longitude, formData.title]);

  // Подгружаем неподполные метки рядом при готовности данных
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canCheckDuplicates) {
        setNearbyIncomplete([]);
        return;
      }
      try {
        setIsCheckingNearby(true);
        const token = localStorage.getItem('token') || '';
        const data = await fetchIncompleteMarkers({
          minScore: 0,
          maxScore: 80,
          limit: 5
        }, token);
        if (!cancelled) {
          // Если API useIncompleteMarkers не учитывает координаты, запросим специализированный эндпоинт
          if (typeof formData.latitude === 'number' && typeof formData.longitude === 'number') {
            const url = new URL('/api/markers/nearby-incomplete', window.location.origin);
            url.searchParams.set('latitude', String(formData.latitude));
            url.searchParams.set('longitude', String(formData.longitude));
            if (formData.category) url.searchParams.set('category', String(formData.category));
            url.searchParams.set('radius', '500');
            const resp = await fetch(url.toString(), {
              headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });
            if (resp.ok) {
              const resJson = await resp.json();
              setNearbyIncomplete(resJson?.data?.markers || []);
            } else {
              setNearbyIncomplete(data?.markers || []);
            }
          } else {
            setNearbyIncomplete(data?.markers || []);
          }
        }
      } catch (_) {
        if (!cancelled) setNearbyIncomplete([]);
      } finally {
        if (!cancelled) setIsCheckingNearby(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canCheckDuplicates, formData.latitude, formData.longitude, formData.category, fetchIncompleteMarkers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
      setUploadedFiles(prev => [...prev, ...fileArray]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Сохранение метки офлайн
  const handleSaveOffline = async () => {
    if (!formData.title?.trim()) {
      alert('Название метки обязательно');
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      alert('Координаты метки обязательны');
      return;
    }

    if (!user?.id) {
      alert('Для сохранения офлайн необходимо авторизоваться');
      return;
    }

    setIsSavingOffline(true);

    try {
      // Получаем regionId (можно использовать 'default' или определить по координатам)
      const regionId = 'default'; // В будущем можно определить по координатам

      // Сохраняем в IndexedDB
      await offlineContentStorage.addDraft({
        contentType: 'marker',
        contentData: {
          title: formData.title,
          description: formData.description || '',
          latitude: formData.latitude as number,
          longitude: formData.longitude as number,
          category: formData.category || 'other',
          hashtags: (() => {
            const hashtagsValue = formData.hashtags as string | string[] | undefined;
            if (typeof hashtagsValue === 'string') {
              return hashtagsValue.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
            } else if (Array.isArray(hashtagsValue)) {
              return hashtagsValue;
            }
            return [];
          })(),
          address: formData.address
        },
        images: uploadedFiles,
        hasImages: uploadedFiles.length > 0,
        status: 'draft',
        regionId: regionId
      });

      alert('Черновик метки сохранён офлайн! Он будет отправлен автоматически при появлении интернета.');
      onCancel();
    } catch (e: any) {
      alert('Не удалось сохранить черновик: ' + (e.message || 'Неизвестная ошибка'));
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Дубликаты/альтернативы: мягкая проверка на бэкенде (если есть координаты)
      if (canCheckDuplicates) {
        try {
          const token = localStorage.getItem('token') || '';
          const resp = await fetch('/api/markers/validate-creation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
              latitude: formData.latitude,
              longitude: formData.longitude,
              title: formData.title,
              category: formData.category || 'other',
              description: formData.description || ''
            })
          });
          if (resp.ok) {
            const result = await resp.json();
            if (!result.success) {
              alert(result.message || 'Ошибка валидации метки');
              return;
            }
            const { canCreate, validation, recommendation } = result.data || {};
            if (validation?.issues?.length) {
              const msg = validation.issues.map((i: any) => `- ${i.message}`).join('\n');
              alert(`Найдены проблемы:\n${msg}`);
              if (!canCreate) return;
            }
            if (recommendation?.action === 'block') {
              alert('Создание метки заблокировано: найден точный дубликат рядом.');
              return;
            }
            if (recommendation?.action === 'warn' || validation?.warnings?.length) {
              const warn = validation?.warnings?.map((w: any) => `- ${w.message}`).join('\n') || 'Обнаружены потенциальные дубликаты поблизости.';
              const proceed = window.confirm(`${warn}\n\nПродолжить создание новой метки?`);
              if (!proceed) return;
            }
          }
        } catch (_) {
          // если валидация недоступна — продолжаем
        }
      }
      if (typeof formData.longitude === 'number' && typeof formData.latitude === 'number') {
        // ОБЯЗАТЕЛЬНАЯ проверка запретных зон — блокирует, не спрашивает
        const zoneCheck = await canCreateMarker(formData.latitude, formData.longitude);
        if (!zoneCheck.allowed) {
          alert(`🚫 Создание метки заблокировано: ${zoneCheck.reason || 'Запретная зона'}`);
          return;
        }
      }
    } catch (_) {
      // молча продолжаем, если проверка недоступна
    }
    onSubmit(formData);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>
          {mode === 'edit' && 'Редактировать метку'}
          {mode === 'add' && 'Добавить метку'}
          {mode === 'suggest' && 'Предложить изменения'}
        </h2>
        <form onSubmit={handleSubmit}>
          <label>
            Название:
            <input name="title" value={formData.title || ''} onChange={handleChange} required />
          </label>
          <label>
            Описание:
            <textarea name="description" value={formData.description || ''} onChange={handleChange} required />
          </label>
          <label>
            Категория:
            <select name="category" value={formData.category || 'other'} onChange={handleChange}>
              <option value="other">Другое</option>
              <option value="restaurant">Ресторан</option>
              <option value="hotel">Отель</option>
              <option value="attraction">Достопримечательность</option>
              <option value="nature">Природа</option>
              <option value="culture">Культура</option>
            </select>
          </label>
          <label>
            Хэштеги (через запятую):
            <input name="hashtags" value={typeof formData.hashtags === 'string' ? formData.hashtags : (formData.hashtags?.join(', ') || '')} onChange={handleChange} />
          </label>
          <label>
            Адрес:
            <input name="address" value={formData.address || ''} onChange={handleChange} />
          </label>
          <label>
            Фотографии:
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleFileChange}
              style={{ marginTop: '4px' }}
            />
            {uploadedFiles.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {uploadedFiles.map((file, index) => (
                  <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </label>
          {/* Подсказки: рядом есть неполные метки */}
          {canCheckDuplicates && (
            <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💡 Рядом есть неполные метки — можно дополнить вместо создания</span>
                {isCheckingNearby && <span style={{ color: '#6b7280', fontWeight: 400 }}>Проверяем…</span>}
              </div>
              {nearbyIncomplete.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: 13 }}>Неполных меток поблизости не найдено.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {nearbyIncomplete.slice(0, 3).map((m: any) => (
                    <div key={m.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 600 }}>{m.title || 'Без названия'}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>Полнота: {m.completenessScore ?? m.completeness_score ?? 0}% • {typeof m.distance === 'number' ? `${m.distance}м` : 'рядом'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => window.alert('Открытие существующей метки пока не реализовано здесь. Откройте её на карте и нажмите "Редактировать".')}
                          style={{ padding: '6px 10px', background: '#8e44ad', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Дополнить</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Вы всё равно можете создать новую метку ниже.</div>
                </div>
              )}
            </div>
          )}
          {/* Можно добавить другие поля по необходимости */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" onClick={onCancel} style={{ flex: 1, minWidth: '100px' }}>Отмена</button>
            {user && mode === 'add' && (
              <button 
                type="button" 
                onClick={handleSaveOffline}
                disabled={isSavingOffline || !formData.title?.trim() || !formData.latitude || !formData.longitude}
                style={{
                  flex: 1,
                  minWidth: '150px',
                  background: isSavingOffline ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: isSavingOffline ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <FaCloud />
                {isSavingOffline ? 'Сохранение...' : 'Сохранить офлайн'}
              </button>
            )}
            <button 
              type="submit"
              style={{ flex: 1, minWidth: '100px' }}
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .modal-backdrop {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 3000;
        }
        .modal-content {
          background: #fff; border-radius: 10px; padding: 24px; min-width: 320px; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        }
        label { display: block; margin-bottom: 12px; }
        input, textarea { width: 100%; margin-top: 4px; }
      `}</style>
    </div>
  );
};

export default MarkerFormModal;
