/**
 * AddEventModal — минимальный модал создания события с карты.
 * Шаг 3 рефакторинга календаря.
 */
import React, { useState } from 'react';
import { X, CalendarPlus } from 'lucide-react';
import { createEvent } from '../../services/eventService';
import { useEventsStore } from '../../stores/eventsStore';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Предзаполненные координаты, если пользователь выбрал точку на карте */
  initialCoords?: { lat: number; lng: number };
}

const CATEGORIES = [
  { id: 'festival', label: 'Фестиваль' },
  { id: 'concert', label: 'Концерт' },
  { id: 'exhibition', label: 'Выставка' },
  { id: 'sport', label: 'Спорт' },
  { id: 'other', label: 'Другое' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const AddEventModal: React.FC<AddEventModalProps> = ({ isOpen, onClose, initialCoords }) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('festival');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addOpenEvent = useEventsStore(s => s.addOpenEvent);

  const resetForm = () => {
    setTitle('');
    setStartDate(todayIso());
    setEndDate('');
    setDescription('');
    setCategory('festival');
    setLocation('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Введите название события');
      return;
    }
    if (!startDate) {
      setError('Укажите дату начала');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        end_date: endDate || undefined,
        location: location.trim() || undefined,
        category,
        latitude: initialCoords?.lat,
        longitude: initialCoords?.lng,
        is_public: true,
      });

      // Если у события есть координаты — добавляем маркер на карту
      const lat = initialCoords?.lat ?? (created as any).latitude;
      const lng = initialCoords?.lng ?? (created as any).longitude;
      if (lat && lng) {
        addOpenEvent({
          id: Number(created.id) || 0,
          title: created.title,
          description: created.description || '',
          date: startDate,
          endDate: endDate || undefined,
          categoryId: category,
          hashtags: [],
          location: location.trim(),
          latitude: lat,
          longitude: lng,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка при создании события');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 3000 }}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl glass-l2 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <CalendarPlus size={18} className="text-blue-400" />
            <h2 className="text-base font-semibold" style={{ color: 'var(--glass-text)' }}>
              Добавить событие
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} style={{ color: 'var(--glass-card-text-secondary)' }} />
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          {/* Название */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--glass-card-text-secondary)' }}>
              Название *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Название события"
              maxLength={150}
              className="dark-glass-input glass-l3 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--glass-text)' }}
              autoFocus
            />
          </div>

          {/* Даты */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--glass-card-text-secondary)' }}>
                Дата начала *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="dark-glass-input glass-l3 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ color: 'var(--glass-text)' }}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--glass-card-text-secondary)' }}>
                Дата окончания
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
                className="dark-glass-input glass-l3 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ color: 'var(--glass-text)' }}
              />
            </div>
          </div>

          {/* Категория */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--glass-card-text-secondary)' }}>
              Категория
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="dark-glass-input glass-l3 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--glass-text)' }}
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Место */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--glass-card-text-secondary)' }}>
              Место
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Адрес или название места"
              maxLength={200}
              className="dark-glass-input glass-l3 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--glass-text)' }}
            />
            {initialCoords && (
              <span className="text-xs" style={{ color: 'var(--glass-card-text-secondary)' }}>
                Координаты выбраны с карты: {initialCoords.lat.toFixed(5)}, {initialCoords.lng.toFixed(5)}
              </span>
            )}
          </div>

          {/* Описание */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--glass-card-text-secondary)' }}>
              Описание
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Опишите событие..."
              rows={3}
              maxLength={2000}
              className="dark-glass-input glass-l3 rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ color: 'var(--glass-text)' }}
            />
          </div>

          {/* Ошибка */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Успех */}
          {success && (
            <p className="text-sm text-green-400">Событие отправлено на модерацию!</p>
          )}

          {/* Кнопки */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium glass-l3 hover:bg-white/10 transition-colors"
              style={{ color: 'var(--glass-card-text-secondary)' }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || success}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: saving || success ? 'rgba(76,201,240,0.4)' : 'rgba(76,201,240,0.85)',
                color: '#000',
              }}
            >
              {saving ? 'Сохранение...' : success ? 'Сохранено!' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEventModal;
