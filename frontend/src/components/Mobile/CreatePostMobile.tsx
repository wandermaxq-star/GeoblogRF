import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAutoSave } from '../../hooks/use-auto-save';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';
import { useHaptic } from '../../hooks/use-haptic';
import { motion } from 'framer-motion';

// ---------- Типы ----------

interface CreatePostData {
  title: string;
  body: string;
  photos: string[];
  location?: { lat: number; lng: number; address: string };
  tags: string[];
}

interface CreatePostMobileProps {
  onClose: () => void;
  onSubmit: (data: CreatePostData) => void;
}

// ---------- Валидация ----------

function validate(data: CreatePostData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.length < 5) {
    errors.title = 'Заголовок минимум 5 символов';
  }
  if (!data.body || data.body.length < 50) {
    errors.body = 'Текст минимум 50 символов';
  }
  if (data.photos.length === 0 && !data.location) {
    errors.photos = 'Добавьте фото или укажите местоположение';
  }
  return errors;
}

// ---------- Компонент ----------

const DRAFT_KEY = 'create-post-draft';

const CreatePostMobile: React.FC<CreatePostMobileProps> = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const navigate = useNavigate();
  const haptic = useHaptic();

  const { load, clear } = useAutoSave<CreatePostData>({
    key: DRAFT_KEY,
    data: { title, body, photos, location: location ?? undefined, tags },
  });

  // Загружаем черновик при монтировании
  useEffect(() => {
    const draft = load();
    if (draft) {
      setTitle(draft.title ?? '');
      setBody(draft.body ?? '');
      setPhotos(draft.photos ?? []);
      setLocation(draft.location ?? null);
      setTags(draft.tags ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Отслеживаем изменения
  useEffect(() => {
    if (title || body || photos.length || location || tags.length) {
      setHasChanges(true);
    }
  }, [title, body, photos, location, tags]);

  // Блокируем скролл body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = useCallback(() => {
    if (hasChanges && (title || body || photos.length || location || tags.length)) {
      if (!confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return;
    }
    clear();
    onClose();
  }, [hasChanges, title, body, photos, location, tags, clear, onClose]);

  const handlePublish = useCallback(() => {
    const data: CreatePostData = {
      title,
      body,
      photos,
      location: location ?? undefined,
      tags,
    };
    const errs = validate(data);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit(data);
    clear();
    haptic.success();
  }, [title, body, photos, location, tags, onSubmit, clear, haptic]);

  // Scroll into view при фокусе
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const scrollToRef = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /** Авто-высота textarea */
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // --- Swipe-down to close ---
  const touchStartY = useRef(0);
  const touchDelta = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDelta.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientY - touchStartY.current;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (touchDelta.current > 150) {
      handleClose();
    }
  }, [handleClose]);

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 bg-background z-50 flex flex-col"
      initial={{ y: '100%' }}
      animate={{ y: '0%' }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
        <button onClick={handleClose} className="text-xl text-foreground" aria-label="Закрыть">
          ✕
        </button>
        <h2 className="text-lg font-semibold text-foreground">Новый пост</h2>
        <Button onClick={handlePublish} size="sm">
          Опубликовать
        </Button>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Заголовок */}
        <div>
          <input
            ref={titleRef}
            type="text"
            placeholder="Заголовок"
            className="w-full text-xl font-bold border-b border-border bg-transparent focus:outline-none text-foreground"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => scrollToRef(titleRef)}
          />
          {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
        </div>

        {/* Текст */}
        <div>
          <textarea
            ref={bodyRef}
            placeholder="Текст поста (минимум 50 символов)"
            className="w-full resize-none min-h-[150px] bg-transparent focus:outline-none text-foreground"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              autoResize(e.target);
            }}
            onFocus={() => scrollToRef(bodyRef)}
          />
          <p className="text-xs text-muted-foreground text-right">{body.length}/50+</p>
          {errors.body && <p className="text-red-500 text-sm">{errors.body}</p>}
        </div>

        {/* Фото */}
        <div>
          <label className="inline-block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                const urls = Array.from(files).map((f) => URL.createObjectURL(f));
                setPhotos((prev) => [...prev, ...urls]);
              }}
            />
            <Button variant="outline" type="button" asChild>
              <span>Добавить фото</span>
            </Button>
          </label>
          {errors.photos && <p className="text-red-500 text-sm mt-1">{errors.photos}</p>}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {photos.map((url, idx) => (
                <div key={idx} className="relative">
                  <img src={url} alt="" className="w-full h-24 object-cover rounded" />
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(url);
                      setPhotos((p) => p.filter((_, i) => i !== idx));
                    }}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                    aria-label="Удалить фото"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Геолокация */}
        <div>
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate('/map?selectLocation=1')}
          >
            Определить местоположение
          </Button>
          {location && (
            <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
          )}
        </div>

        {/* Теги */}
        <div>
          <label className="block mb-1 text-sm font-medium text-foreground">Теги</label>
          <input
            type="text"
            placeholder="Введите тег и нажмите Enter"
            className="w-full border border-border rounded px-3 py-2 bg-transparent text-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const value = e.currentTarget.value.trim();
                if (value && !tags.includes(value)) {
                  setTags((t) => [...t, value]);
                }
                e.currentTarget.value = '';
              }
            }}
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-sm inline-flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => setTags((ts) => ts.filter((_, j) => j !== i))}
                    className="hover:text-red-500"
                    aria-label={`Удалить тег ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer — кнопка «Опубликовать» всегда видима */}
      <div className="flex-shrink-0 p-4 border-t border-border">
        <Button onClick={handlePublish} className="w-full">
          Опубликовать
        </Button>
      </div>
    </motion.div>
  );
};

export default CreatePostMobile;
