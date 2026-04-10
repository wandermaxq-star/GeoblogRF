import React, { useEffect, useState } from 'react';
import { Camera, ImagePlus, MapPin } from 'lucide-react';
import MapCreationPanelShell from './MapCreationPanelShell';
import { DiscoveredPlace } from '../../services/placeDiscoveryService';

export interface MarkerCreationPayload {
  title: string;
  description: string;
  category: string;
  hashtags: string;
  address: string;
  photoUrls: string;
}

interface MarkerCreationPanelProps {
  coords: [number, number];
  discoveredPlace: DiscoveredPlace | null;
  isMobile: boolean;
  isTwoPanelMode: boolean;
  onSubmit: (payload: MarkerCreationPayload) => Promise<void>;
  onCancel: () => void;
}

function deriveMarkerTitle(place: DiscoveredPlace | null): string {
  if (!place) {
    return '';
  }

  const explicitName = place.name?.trim();
  if (explicitName) {
    return explicitName;
  }

  const firstAddressPart = place.address
    ?.split(',')
    .map((part) => part.trim())
    .find(Boolean);

  if (firstAddressPart) {
    return firstAddressPart;
  }

  const fallbackType = place.type?.trim() || place.category?.trim();
  if (fallbackType) {
    return fallbackType.charAt(0).toUpperCase() + fallbackType.slice(1);
  }

  return 'Новая метка';
}

function normalizeMarkerCategory(category: string | undefined): string {
  if (!category) {
    return 'other';
  }

  const normalized = category.trim().toLowerCase();
  const matched = CATEGORY_OPTIONS.find((option) => option.id === normalized);
  return matched ? matched.id : 'other';
}

const CATEGORY_OPTIONS = [
  { id: 'other', label: 'Другое' },
  { id: 'restaurant', label: 'Ресторан' },
  { id: 'hotel', label: 'Отель' },
  { id: 'attraction', label: 'Достопримечательность' },
  { id: 'nature', label: 'Природа' },
  { id: 'culture', label: 'Культура' },
];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.24)',
  background: 'rgba(255,255,255,0.48)',
  padding: '9px 12px',
  outline: 'none',
  color: 'var(--glass-text, #111827)',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--glass-text-secondary, #6b7280)',
  marginBottom: 4,
};

const mobileStepperStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 10,
};

const mobileStepChipStyle = (isActive: boolean, accent: string): React.CSSProperties => ({
  flex: 1,
  borderRadius: 14,
  minHeight: 56,
  padding: '10px 12px',
  border: `1px solid ${isActive ? `${accent}55` : 'rgba(148, 163, 184, 0.18)'}`,
  background: isActive ? `linear-gradient(135deg, ${accent}18, rgba(255,255,255,0.72))` : 'rgba(255,255,255,0.5)',
  color: isActive ? 'var(--glass-text, #111827)' : 'var(--glass-text-secondary, #6b7280)',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  lineHeight: 1.15,
  boxSizing: 'border-box',
});

const mobileActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
};

export const MarkerCreationPanel: React.FC<MarkerCreationPanelProps> = ({
  coords,
  discoveredPlace,
  isMobile,
  isTwoPanelMode,
  onSubmit,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [hashtags, setHashtags] = useState('');
  const [address, setAddress] = useState('');
  const [photoLink, setPhotoLink] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [manualPhotoLinks, setManualPhotoLinks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileStep, setMobileStep] = useState(0);

  useEffect(() => {
    setTitle('');
    setDescription('');
    setCategory('other');
    setHashtags('');
    setAddress('');
    setPhotoLink('');
    setUploadedFiles([]);
    setManualPhotoLinks([]);
    setError(null);
    setMobileStep(0);
  }, [coords[0], coords[1]]);

  useEffect(() => {
    if (!discoveredPlace) {
      return;
    }

    setTitle((current) => current || deriveMarkerTitle(discoveredPlace));
    setAddress((current) => current || discoveredPlace.address || '');
    setCategory((current) => current !== 'other' ? current : normalizeMarkerCategory(discoveredPlace.category));
  }, [discoveredPlace]);

  const uploadFiles = async () => {
    const token = localStorage.getItem('token');
    const uploadedUrls: string[] = [];

    for (const file of uploadedFiles) {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить фотографии');
      }

      const data = await response.json();
      if (data?.photoUrl) {
        uploadedUrls.push(data.photoUrl);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (trimmedTitle.length < 3) {
      if (isMobile) {
        setMobileStep(0);
      }
      setError('Название метки должно содержать минимум 3 символа');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const uploadedUrls = uploadedFiles.length > 0 ? await uploadFiles() : [];
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        category,
        hashtags,
        address: address.trim(),
        photoUrls: [...manualPhotoLinks, ...uploadedUrls].join(','),
      });
    } catch (submitError: any) {
      setError(submitError?.message || 'Не удалось добавить метку');
    } finally {
      setSaving(false);
    }
  };

  const mobileSteps = [
    {
      id: 'place',
      label: '1/3',
      title: 'Основа',
      hint: 'Название, категория и привязка к месту.',
      content: (
        <>
          {discoveredPlace && (
            <div style={{ borderRadius: 16, padding: 12, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.14)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>Найдено место</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--glass-text, #111827)' }}>{deriveMarkerTitle(discoveredPlace)}</div>
              <div style={{ fontSize: 12, marginTop: 3, color: 'var(--glass-text-secondary, #6b7280)' }}>{discoveredPlace.address}</div>
            </div>
          )}

          <div>
            <div style={labelStyle}>Название</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} placeholder="Например, смотровая площадка у реки" autoFocus />
          </div>

          <div>
            <div style={labelStyle}>Категория</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={labelStyle}>Адрес или название места</div>
            <input value={address} onChange={(e) => setAddress(e.target.value)} style={fieldStyle} placeholder="Можно уточнить вручную" />
          </div>
        </>
      ),
    },
    {
      id: 'story',
      label: '2/3',
      title: 'Описание',
      hint: 'Что это за место и как его лучше искать.',
      content: (
        <>
          <div>
            <div style={labelStyle}>Описание</div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...fieldStyle, minHeight: 140, resize: 'vertical' }} placeholder="Коротко опишите, чем это место полезно или интересно" />
          </div>

          <div>
            <div style={labelStyle}>Хэштеги</div>
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} style={fieldStyle} placeholder="например: закат, река, видовая" />
          </div>
        </>
      ),
    },
    {
      id: 'media',
      label: '3/3',
      title: 'Фото',
      hint: 'Добавьте фото файлами или ссылками. Это необязательно.',
      content: (
        <>
          <div>
            <div style={labelStyle}>Фото</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ ...fieldStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Camera size={16} />
                <span>Загрузить фото</span>
                <input type="file" accept="image/*" multiple onChange={(e) => setUploadedFiles(Array.from(e.target.files || []))} style={{ display: 'none' }} />
              </label>
              <div style={{ fontSize: 12, color: 'var(--glass-text-secondary, #6b7280)' }}>
                {uploadedFiles.length > 0 ? `Файлов: ${uploadedFiles.length}` : 'Можно оставить пустым'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>
              <input value={photoLink} onChange={(e) => setPhotoLink(e.target.value)} style={fieldStyle} placeholder="или вставьте ссылку на изображение" />
              <button
                type="button"
                onClick={() => {
                  if (!photoLink.trim()) {
                    return;
                  }

                  setManualPhotoLinks((current) => [...current, photoLink.trim()]);
                  setPhotoLink('');
                }}
                style={{
                  borderRadius: 14,
                  border: '1px solid rgba(59, 130, 246, 0.24)',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#1d4ed8',
                  padding: '0 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  minHeight: 46,
                }}
              >
                <ImagePlus size={16} />
              </button>
            </div>

            {manualPhotoLinks.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {manualPhotoLinks.map((link, index) => (
                  <button
                    key={`${link}-${index}`}
                    type="button"
                    onClick={() => setManualPhotoLinks((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    style={{
                      borderRadius: 999,
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      background: 'rgba(59, 130, 246, 0.08)',
                      color: '#1d4ed8',
                      padding: '5px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Фото {index + 1} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ),
    },
  ];

  const isLastMobileStep = mobileStep === mobileSteps.length - 1;
  const mobileFooter = isMobile ? (
    <div style={mobileActionsStyle}>
      <button
        type="button"
        onClick={() => {
          if (mobileStep === 0) {
            onCancel();
            return;
          }

          setMobileStep((current) => Math.max(0, current - 1));
        }}
        style={{
          flex: 1,
          borderRadius: 14,
          border: '1px solid rgba(148, 163, 184, 0.22)',
          background: 'rgba(255,255,255,0.78)',
          color: 'var(--glass-text-secondary, #6b7280)',
          padding: '11px 14px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {mobileStep === 0 ? 'Отмена' : 'Назад'}
      </button>
      {isLastMobileStep ? (
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 1.2,
            borderRadius: 14,
            border: '1px solid rgba(239, 68, 68, 0.18)',
            background: saving ? 'rgba(239,68,68,0.45)' : 'linear-gradient(135deg, #ef4444, #fb7185)',
            color: '#fff',
            padding: '11px 14px',
            cursor: saving ? 'default' : 'pointer',
            fontWeight: 700,
            boxShadow: '0 14px 28px rgba(239, 68, 68, 0.22)',
          }}
        >
          {saving ? 'Сохраняем...' : 'Добавить метку'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMobileStep((current) => Math.min(mobileSteps.length - 1, current + 1))}
          style={{
            flex: 1.2,
            borderRadius: 14,
            border: '1px solid rgba(239, 68, 68, 0.18)',
            background: 'linear-gradient(135deg, #ef4444, #fb7185)',
            color: '#fff',
            padding: '11px 14px',
            cursor: 'pointer',
            fontWeight: 700,
            boxShadow: '0 14px 28px rgba(239, 68, 68, 0.22)',
          }}
        >
          Далее
        </button>
      )}
    </div>
  ) : null;

  return (
    <MapCreationPanelShell
      title="Добавить метку"
      icon={<MapPin size={18} />}
      accentColor="#ef4444"
      isMobile={isMobile}
      isTwoPanelMode={isTwoPanelMode}
      onClose={onCancel}
      footer={mobileFooter}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 14, minHeight: isMobile ? '100%' : undefined }}>
        {isMobile ? (
          <>
            <div style={mobileStepperStyle}>
              {mobileSteps.map((step, index) => (
                <button key={step.id} type="button" onClick={() => setMobileStep(index)} style={{ ...mobileStepChipStyle(index === mobileStep, '#ef4444'), boxShadow: index === mobileStep ? '0 12px 24px rgba(239, 68, 68, 0.16)' : 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, lineHeight: 1 }}>{step.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.15, color: index === mobileStep ? '#991b1b' : undefined }}>{step.title}</div>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, lineHeight: 1.35, marginTop: -2, marginBottom: 0, color: 'var(--glass-text-secondary, #6b7280)' }}>
              {mobileSteps[mobileStep].hint}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {mobileSteps[mobileStep].content}

              {error && <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>}
            </div>
          </>
        ) : (
          <>
            {discoveredPlace && (
              <div style={{ borderRadius: 16, padding: 12, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.14)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>Найдено место</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--glass-text, #111827)' }}>{deriveMarkerTitle(discoveredPlace)}</div>
                <div style={{ fontSize: 12, marginTop: 3, color: 'var(--glass-text-secondary, #6b7280)' }}>{discoveredPlace.address}</div>
              </div>
            )}

            <div>
              <div style={labelStyle}>Название</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} placeholder="Например, смотровая площадка у реки" autoFocus />
            </div>

            <div>
              <div style={labelStyle}>Категория</div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Адрес или название места</div>
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={fieldStyle} placeholder="Можно уточнить вручную" />
            </div>

            <div>
              <div style={labelStyle}>Описание</div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...fieldStyle, minHeight: 92, resize: 'vertical' }} placeholder="Коротко опишите, чем это место полезно или интересно" />
            </div>

            <div>
              <div style={labelStyle}>Хэштеги</div>
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} style={fieldStyle} placeholder="например: закат, река, видовая" />
            </div>

            <div>
              <div style={labelStyle}>Фото</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ ...fieldStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <Camera size={16} />
                  <span>Загрузить фото</span>
                  <input type="file" accept="image/*" multiple onChange={(e) => setUploadedFiles(Array.from(e.target.files || []))} style={{ display: 'none' }} />
                </label>
                <div style={{ fontSize: 12, color: 'var(--glass-text-secondary, #6b7280)' }}>
                  {uploadedFiles.length > 0 ? `Файлов: ${uploadedFiles.length}` : 'Можно оставить пустым'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={photoLink} onChange={(e) => setPhotoLink(e.target.value)} style={fieldStyle} placeholder="или вставьте ссылку на изображение" />
                <button
                  type="button"
                  onClick={() => {
                    if (!photoLink.trim()) {
                      return;
                    }

                    setManualPhotoLinks((current) => [...current, photoLink.trim()]);
                    setPhotoLink('');
                  }}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(59, 130, 246, 0.24)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#1d4ed8',
                    padding: '0 14px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <ImagePlus size={16} />
                </button>
              </div>

              {manualPhotoLinks.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {manualPhotoLinks.map((link, index) => (
                    <button
                      key={`${link}-${index}`}
                      type="button"
                      onClick={() => setManualPhotoLinks((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      style={{
                        borderRadius: 999,
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        background: 'rgba(59, 130, 246, 0.08)',
                        color: '#1d4ed8',
                        padding: '5px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Фото {index + 1} ×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  border: '1px solid rgba(148, 163, 184, 0.22)',
                  background: 'rgba(255,255,255,0.34)',
                  color: 'var(--glass-text-secondary, #6b7280)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  border: '1px solid rgba(239, 68, 68, 0.18)',
                  background: saving ? 'rgba(239,68,68,0.45)' : 'linear-gradient(135deg, #ef4444, #fb7185)',
                  color: '#fff',
                  padding: '12px 14px',
                  cursor: saving ? 'default' : 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 14px 28px rgba(239, 68, 68, 0.22)',
                }}
              >
                {saving ? 'Сохраняем...' : 'Добавить метку'}
              </button>
            </div>
          </>
        )}
      </form>
    </MapCreationPanelShell>
  );
};

export default MarkerCreationPanel;