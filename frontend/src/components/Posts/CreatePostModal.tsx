import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '../../hooks/use-mobile';
import {
  FaTimes, FaMapMarkerAlt, FaRoute, FaCalendar,
  FaPaperPlane, FaTrash, FaCloud,
} from 'react-icons/fa';
import {
  Camera, ChevronLeft,
  Sparkles, Plus,
} from 'lucide-react';
import { createPost, PostDTO } from '../../services/postsService';
import { useLayoutState } from '../../contexts/LayoutContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { offlinePostsStorage } from '../../services/offlinePostsStorage';
import ModeSelector, { CreationMode } from './ModeSelector';

// ─── Типы ────────────────────────────────────────────────────────────

type HookType = 'route' | 'marker' | 'event' | null;

interface GuideSection {
  id: string;
  title: string;
  content: string;
  hasMap: boolean;
  routeId?: string;
  markerId?: string;
  eventId?: string;
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: PostDTO) => void;
  initialRoute?: any;
  inline?: boolean;
}

// ─── Эмоциональные стартеры ──────────────────────────────────────────

const STARTERS = [
  'Это место выбило меня из колеи потому что…',
  'Если у тебя всего один день — делай так',
  'Никому не рассказывайте, но здесь…',
  'Самое вкусное здесь — это…',
];

// ─── Стекло-стили ────────────────────────────────────────────────────

const glass = {
  bg: {
    background: 'var(--glass-bg, rgba(255,255,255,0.65))',
    backdropFilter: 'blur(14px) saturate(180%)',
    WebkitBackdropFilter: 'blur(14px) saturate(180%)',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.30)',
    backdropFilter: 'blur(10px) saturate(180%)',
    WebkitBackdropFilter: 'blur(10px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.20)',
    color: 'var(--glass-text, var(--text-primary, #1a1a1a))',
    borderRadius: '12px',
  } as React.CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: '16px',
  } as React.CSSProperties,
};

// ─── Компонент ───────────────────────────────────────────────────────

const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen, onClose, onPostCreated, initialRoute, inline = false,
}) => {
  // ── Режим ──
  const [mode, setMode] = useState<'select' | CreationMode>('select');

  // ── Общие поля ──
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // ── Хуки контента ──
  const [hookType, setHookType] = useState<HookType>(null);
  const [hookRouteId, setHookRouteId] = useState<string | null>(null);
  const [hookMarkerId, setHookMarkerId] = useState<string | null>(null);
  const [hookEventId, setHookEventId] = useState<string | null>(null);
  const [showHookPicker, setShowHookPicker] = useState(false);
  const [hookPickerTab, setHookPickerTab] = useState<'routes' | 'markers' | 'events'>('routes');

  // ── Путеводитель ──
  const [guideSections, setGuideSections] = useState<GuideSection[]>([]);

  // ── Фото ──
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  // ── Черновики (для режима continue) ──
  const [draftsList, setDraftsList] = useState<import('../../services/offlinePostsStorage').OfflinePostDraft[]>([]);

  // ── Другое ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const layout = useLayoutState();
  const favorites = useFavorites();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Утилита: has-hook ──
  const hasHook = !!(hookRouteId || hookMarkerId || hookEventId);

  // ────────────────────── Эффекты ──────────────────────

  // Очистка при закрытии
  useEffect(() => {
    if (!isOpen) {
      setMode('select');
      setTitle('');
      setBody('');
      setHookType(null);
      setHookRouteId(null);
      setHookMarkerId(null);
      setHookEventId(null);
      setShowHookPicker(false);
      setGuideSections([]);
      setUploadedFiles([]);
      setPhotoPreviewUrls([]);
      setError(null);
      setHasDraft(false);
      setDraftsList([]);
    }
  }, [isOpen]);

  // Проверка черновиков
  useEffect(() => {
    if (isOpen) {
      offlinePostsStorage.getDraftsCount('draft').then((c) => setHasDraft(c > 0)).catch(() => {});
    }
  }, [isOpen]);

  // Загрузка списка черновиков при continue
  useEffect(() => {
    if (mode === 'continue') {
      offlinePostsStorage.getAllDrafts('draft').then(setDraftsList).catch(() => setDraftsList([]));
    }
  }, [mode]);

  // Авто-применение начального маршрута
  useEffect(() => {
    if (isOpen && initialRoute) {
      setHookRouteId(initialRoute.id || initialRoute.track?.id || null);
      setHookType('route');
      setMode('story');
    }
  }, [isOpen, initialRoute]);

  // ────────────────────── Хендлеры ──────────────────────

  const handleHookSelect = useCallback((type: HookType, id?: string) => {
    if (type === 'route' && id) {
      setHookRouteId(id); setHookMarkerId(null); setHookEventId(null); setHookType('route');
    } else if (type === 'marker' && id) {
      setHookMarkerId(id); setHookRouteId(null); setHookEventId(null); setHookType('marker');
    } else if (type === 'event' && id) {
      setHookEventId(id); setHookRouteId(null); setHookMarkerId(null); setHookType('event');
    } else {
      setHookType(null); setHookRouteId(null); setHookMarkerId(null); setHookEventId(null);
    }
    setShowHookPicker(false);
  }, []);

  // ── Загрузка черновика ──

  const loadDraft = useCallback(async (draftId: string) => {
    const d = await offlinePostsStorage.getDraft(draftId);
    if (!d) return;
    setBody(d.text || '');
    setTitle(d.title || '');
    if (d.images?.length) {
      setUploadedFiles(d.images);
      setPhotoPreviewUrls(d.images.map((f) => URL.createObjectURL(f)));
    }
    setMode('story');
  }, []);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = [...uploadedFiles, ...files].slice(0, 10);
    setUploadedFiles(next);
    setPhotoPreviewUrls(next.map((f) => URL.createObjectURL(f)));
    e.target.value = '';
  }, [uploadedFiles]);

  const handleRemovePhoto = useCallback((idx: number) => {
    setUploadedFiles((p) => p.filter((_, i) => i !== idx));
    setPhotoPreviewUrls((p) => p.filter((_, i) => i !== idx));
  }, []);

  // ── Секции путеводителя ──

  const addGuideSection = useCallback(() => {
    setGuideSections((s) => [...s, { id: `sec-${Date.now()}`, title: '', content: '', hasMap: false }]);
  }, []);

  const updateGuideSection = useCallback((id: string, upd: Partial<GuideSection>) => {
    setGuideSections((s) => s.map((x) => (x.id === id ? { ...x, ...upd } : x)));
  }, []);

  const removeGuideSection = useCallback((id: string) => {
    setGuideSections((s) => s.filter((x) => x.id !== id));
  }, []);

  // ── Извлечение трека ──

  const extractTrackFromRoute = (routeId: string | null): GeoJSON.Feature<GeoJSON.LineString> | null => {
    if (!routeId || !favorites?.favoriteRoutes) return null;
    const route = favorites.favoriteRoutes.find((r) => r.id === routeId);
    if (!route || !route.points || route.points.length < 2) return null;
    const coords = route.points
      .map((p: any) => {
        if (Array.isArray(p.coordinates)) return [p.coordinates[1], p.coordinates[0]];
        if (p.latitude !== undefined && p.longitude !== undefined) return [p.longitude, p.latitude];
        return null;
      })
      .filter((c: any): c is [number, number] => c !== null);
    if (coords.length < 2) return null;
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { routeId: route.id, routeTitle: route.title },
    };
  };

  // ── Геолокация → region ──

  const getRegionId = (): Promise<string> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve('default'); return; }
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude: la, longitude: lo } }) => {
          if (la >= 55 && la <= 56 && lo >= 37 && lo <= 38) resolve('moscow');
          else if (la >= 59 && la <= 60 && lo >= 30 && lo <= 31) resolve('spb');
          else if (la >= 43 && la <= 45 && lo >= 39 && lo <= 41) resolve('krasnodar');
          else resolve('default');
        },
        () => resolve('default'),
        { timeout: 3000 },
      );
    });

  // ── Сохранение офлайн ──

  const handleSaveOffline = async () => {
    if (!body.trim()) { setError('Напиши хотя бы пару слов'); return; }
    if (mode === 'guide' && (!title.trim() || guideSections.length === 0)) {
      setError('Заполни заголовок и добавь хотя бы одну секцию');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let postBody = body;
      let track: GeoJSON.Feature<GeoJSON.LineString> | null = null;
      if (mode === 'guide') {
        postBody = JSON.stringify({
          type: 'guide',
          introduction: body,
          sections: guideSections.map((s) => ({
            title: s.title, content: s.content, hasMap: s.hasMap,
            routeId: s.routeId, markerId: s.markerId, eventId: s.eventId,
          })),
        });
        const rs = guideSections.find((s) => s.hasMap && s.routeId);
        if (rs?.routeId) track = extractTrackFromRoute(rs.routeId);
      } else if (hookRouteId) {
        track = extractTrackFromRoute(hookRouteId);
      }
      const regionId = await getRegionId();
      await offlinePostsStorage.addDraft({
        text: postBody,
        title: title.trim() || undefined,
        images: uploadedFiles,
        track,
        status: 'draft',
        regionId,
        hasImages: uploadedFiles.length > 0,
        hasTrack: track !== null,
      });
      onClose();
    } catch (e: any) {
      setError('Не удалось сохранить: ' + (e.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  // ── Публикация ──

  const handleCreatePost = async () => {
    if (!body.trim()) { 
      setError('Напиши хотя бы пару слов'); 
      return; 
    }
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА БЕЗОПАСНОСТИ: фото обязательны
    if (mode === 'instant' && uploadedFiles.length === 0) { 
      setError('⚠️ Фотография ОБЯЗАТЕЛЬНА для публикации момента (требование безопасности)'); 
      return; 
    }
    if (mode === 'story' && uploadedFiles.length === 0) { 
      setError('⚠️ Хотя бы одно фото ТРЕБУЕТСЯ для проверки модератором (требование безопасности)'); 
      return; 
    }
    
    if (mode === 'guide') {
      if (!title.trim()) { setError('Заголовок обязателен для путеводителя'); return; }
      if (guideSections.length === 0) { setError('Добавь хотя бы одну секцию'); return; }
    }
    
    setLoading(true);
    setError(null);
    try {
      let photoUrls: string[] = [];
      if (uploadedFiles.length > 0) {
        const uploads = uploadedFiles.map(async (file) => {
          const fd = new FormData();
          fd.append('image', file);
          const res = await fetch('/api/upload/image', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: fd,
          });
          if (res.ok) { const d = await res.json(); return d.photoUrl; }
          return null;
        });
        photoUrls = (await Promise.all(uploads)).filter(Boolean) as string[];
      }

      let postBody = body;
      if (mode === 'guide') {
        postBody = JSON.stringify({
          type: 'guide',
          introduction: body,
          sections: guideSections.map((s) => ({
            title: s.title, content: s.content, hasMap: s.hasMap,
            routeId: s.routeId, markerId: s.markerId, eventId: s.eventId,
          })),
        });
      }

      const isGuide = mode === 'guide';
      const created = await createPost({
        title: title.trim() || undefined,
        body: postBody,
        route_id: !isGuide && hookRouteId ? hookRouteId : undefined,
        marker_id: !isGuide && hookMarkerId ? hookMarkerId : undefined,
        event_id: !isGuide && hookEventId ? hookEventId : undefined,
        photo_urls: photoUrls.length > 0 ? photoUrls.join(',') : undefined,
        template: isGuide ? 'guide' : 'mobile',
      });

      onPostCreated(created);
      onClose();
    } catch {
      setError('Не удалось опубликовать пост');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────
  //  Ранний возврат
  // ────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ────────────────────── Общие элементы ──────────────

  const BackButton = () => (
    <button
      onClick={() => setMode('select')}
      className="p-2 rounded-full transition-colors"
      style={{ ...glass.card, background: 'rgba(255,255,255,0.25)' }}
    >
      <ChevronLeft className="w-5 h-5" style={{ color: 'var(--glass-text, #333)' }} />
    </button>
  );

  const canPublish =
    body.trim().length > 0 && 
    (mode === 'instant' ? photoPreviewUrls.length > 0 : true) && // instant ТРЕБУЕТ фото
    (mode === 'story' ? photoPreviewUrls.length > 0 : true) && // story ТРЕБУЕТ фото для безопасности
    (mode !== 'guide' || (title.trim().length > 0 && guideSections.length > 0));

  const renderError = () =>
    error ? (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm px-4 py-2.5 rounded-xl"
        style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626' }}
      >
        {error}
      </motion.div>
    ) : null;

  // ── Фото-область (базовая, переиспользуемая) ──

  const renderPhotoZone = (aspect: string, label: string, sublabel: string) => (
    <div className="space-y-3">
      <div
        className="relative rounded-2xl overflow-hidden cursor-pointer transition-all border-2 border-dashed"
        style={{
          borderColor: photoPreviewUrls.length ? 'rgba(59,130,246,0.35)' : 'rgba(150,150,150,0.30)',
          aspectRatio: aspect,
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" disabled={uploadedFiles.length >= 10} />
        {photoPreviewUrls.length > 0 ? (
          <img src={photoPreviewUrls[0]} alt="Главное фото" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <Camera className="w-12 h-12 mb-2" style={{ color: 'var(--glass-text-secondary, #aaa)' }} />
            <p className="text-base font-semibold" style={{ color: 'var(--glass-text, #555)' }}>{label}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--glass-text-secondary, #999)' }}>{sublabel}</p>
          </div>
        )}
      </div>
      {photoPreviewUrls.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {photoPreviewUrls.slice(1).map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={(e) => { e.stopPropagation(); handleRemovePhoto(idx + 1); }}
                className="absolute top-0.5 right-0.5 bg-red-500/80 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <FaTimes size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Пикер хуков (bottom-sheet) ──

  const renderHookPicker = () => {
    if (!showHookPicker) return null;
    const items =
      hookPickerTab === 'routes'
        ? (favorites?.favoriteRoutes || []).map((r) => ({ id: r.id, name: r.title, type: 'route' as const }))
        : hookPickerTab === 'markers'
          ? (favorites?.favoritePlaces || []).map((p) => ({ id: p.id, name: p.name, type: 'marker' as const }))
          : (favorites?.favoriteEvents || []).map((e) => ({ id: e.id, name: e.title, type: 'event' as const }));
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={() => setShowHookPicker(false)}
      >
        <motion.div
          initial={{ y: 50 }} animate={{ y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[70vh] rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ ...glass.bg, border: '1px solid rgba(255,255,255,0.25)' }}
        >
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--glass-text)' }}>
              {hookPickerTab === 'routes' ? 'Выбери маршрут' : hookPickerTab === 'markers' ? 'Выбери метку' : 'Выбери событие'}
            </h3>
            <button onClick={() => setShowHookPicker(false)}><FaTimes size={16} style={{ color: 'var(--glass-text-secondary)' }} /></button>
          </div>
          <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            {(['routes', 'markers', 'events'] as const).map((tab) => (
              <button
                key={tab} onClick={() => setHookPickerTab(tab)}
                className="flex-1 py-2 text-sm font-medium transition-colors"
                style={{
                  color: hookPickerTab === tab ? 'var(--text-accent, #2563eb)' : 'var(--glass-text-secondary)',
                  borderBottom: hookPickerTab === tab ? '2px solid var(--text-accent, #2563eb)' : '2px solid transparent',
                }}
              >
                {tab === 'routes' ? 'Маршруты' : tab === 'markers' ? 'Метки' : 'События'}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto max-h-[50vh] p-3 space-y-2">
            {items.length === 0 && (
              <p className="text-center py-6 text-sm" style={{ color: 'var(--glass-text-secondary)' }}>Пока пусто — добавьте в избранное</p>
            )}
            {items.map((item) => (
              <button
                key={item.id} onClick={() => handleHookSelect(item.type, item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{ ...glass.card, background: 'rgba(255,255,255,0.12)' }}
              >
                {item.type === 'route' && <FaRoute size={14} className="text-blue-500 shrink-0" />}
                {item.type === 'marker' && <FaMapMarkerAlt size={14} className="text-green-500 shrink-0" />}
                {item.type === 'event' && <FaCalendar size={14} className="text-purple-500 shrink-0" />}
                <span className="truncate text-sm" style={{ color: 'var(--glass-text)' }}>{item.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // ═══════════════════════════════════════════════════
  //  INSTANT — «Здесь и сейчас»
  //  Фото на весь экран → пара слов → опубликовать
  // ═══════════════════════════════════════════════════

  const renderInstantEditor = () => (
    <div className="space-y-5">
      {/* 1. Фото — главный элемент, крупное */}
      {renderPhotoZone('3/4', 'Сфотографируй момент', 'Один кадр — и готово')}

      {/* 2. Короткий текст */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Что здесь происходит? (пара слов хватит)"
        rows={3}
        maxLength={280}
        className="w-full px-4 py-3 text-sm rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-300/50"
        style={glass.input}
      />
      <div className="text-right text-xs" style={{ color: 'var(--glass-text-secondary)' }}>
        {body.length}/280
      </div>

      {/* 3. Ошибка */}
      {renderError()}

      {/* 4. Большая кнопка публикации */}
      <button
        onClick={handleCreatePost}
        disabled={loading || !canPublish}
        title={mode === 'instant' && photoPreviewUrls.length === 0 ? 'Добавьте фотографию' : ''}
        className="w-full py-4 rounded-2xl text-base font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-3"
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          color: '#fff',
          boxShadow: '0 6px 20px rgba(59,130,246,0.35)',
        }}
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <FaPaperPlane size={14} /> {photoPreviewUrls.length === 0 ? '📸 Добавьте фото' : 'Опубликовать момент'}
          </>
        )}
      </button>

      {/* 5. Мелкая кнопка черновика */}
      <button
        onClick={handleSaveOffline}
        disabled={loading || !body.trim()}
        className="w-full py-2 text-sm rounded-xl disabled:opacity-30 transition-all"
        style={{ color: 'var(--glass-text-secondary)' }}
      >
        <FaCloud size={12} className="inline mr-1.5" /> Сохранить как черновик
      </button>

      {body.trim() && photoPreviewUrls.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{ color: '#059669' }}
        >
          <Sparkles size={14} />
          +{20 + (photoPreviewUrls.length * 5)} XP за живой момент!
        </motion.div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════
  //  STORY — «Впечатление дня»
  //  Стартеры → текст → фото → привязка
  // ═══════════════════════════════════════════════════

  const renderStoryEditor = () => (
    <div className="space-y-5">
      {/* 1. Эмоциональные стартеры */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--glass-text-secondary)' }}>
          Начни с эмоции:
        </p>
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => setBody((prev) => (prev ? `${prev}\n\n${s}` : s))}
              className="text-sm px-3 py-1.5 rounded-full transition-all"
              style={{
                ...glass.card,
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.18)',
                color: 'var(--glass-text, #2563eb)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Заголовок (необязательный) */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок (необязательно)"
        className="w-full px-4 py-2.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-300/50"
        style={glass.input}
      />

      {/* 3. Текст */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Расскажи свои впечатления, эмоции, что запомнилось…"
        className="w-full min-h-[140px] px-4 py-3 text-sm rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-300/50"
        style={glass.input}
      />

      {/* 4. Фото */}
      {renderPhotoZone('16/9', 'Добавить фото', 'до 10 фото')}

      {/* 5. Привязка контента */}
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: 'var(--glass-text-secondary)' }}>Привязать к контенту:</p>

        {hasHook ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{ ...glass.card, background: 'rgba(59,130,246,0.08)' }}
          >
            {hookType === 'route' && <FaRoute size={14} className="text-blue-500" />}
            {hookType === 'marker' && <FaMapMarkerAlt size={14} className="text-green-500" />}
            {hookType === 'event' && <FaCalendar size={14} className="text-purple-500" />}
            <span className="text-sm flex-1" style={{ color: 'var(--glass-text)' }}>
              {hookType === 'route' && (favorites?.favoriteRoutes?.find((r) => r.id === hookRouteId)?.title || 'Маршрут')}
              {hookType === 'marker' && (favorites?.favoritePlaces?.find((p) => p.id === hookMarkerId)?.name || 'Метка')}
              {hookType === 'event' && (favorites?.favoriteEvents?.find((e) => e.id === hookEventId)?.title || 'Событие')}
            </span>
            <button onClick={() => handleHookSelect(null)} className="text-red-400 hover:text-red-600"><FaTimes size={12} /></button>
          </motion.div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setHookPickerTab('routes'); setShowHookPicker(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all" style={{ ...glass.card, color: 'var(--glass-text)' }}>
              <FaRoute size={14} className="text-blue-500" /> Маршрут
            </button>
            <button onClick={() => { setHookPickerTab('markers'); setShowHookPicker(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all" style={{ ...glass.card, color: 'var(--glass-text)' }}>
              <FaMapMarkerAlt size={14} className="text-green-500" /> Метка
            </button>
            <button onClick={() => { setHookPickerTab('events'); setShowHookPicker(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all" style={{ ...glass.card, color: 'var(--glass-text)' }}>
              <FaCalendar size={14} className="text-purple-500" /> Событие
            </button>
          </div>
        )}
      </div>

      {renderError()}

      {/* 6. Кнопки */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSaveOffline} disabled={loading || !body.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-xl disabled:opacity-40 transition-all"
          style={{ ...glass.card, color: 'var(--glass-text)' }}>
          <FaCloud size={12} /> Черновик
        </button>
        <div className="flex-1" />
        <button onClick={handleCreatePost} disabled={loading || !canPublish}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
          title={mode === 'story' && photoPreviewUrls.length === 0 ? 'Добавьте фото для модерации' : ''}
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><FaPaperPlane size={12} /> {photoPreviewUrls.length === 0 && mode === 'story' ? '📸 Добавьте фото' : 'Опубликовать'}</>}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  //  GUIDE — «Мой путеводитель»
  //  Заголовок → формат → вступление → секции
  // ═══════════════════════════════════════════════════

  const renderGuideEditor = () => (
    <div className="space-y-5">
      {/* 1. Обложка */}
      {renderPhotoZone('16/9', 'Обложка путеводителя', 'Главное фото маршрута')}

      {/* 2. Заголовок (обязательный) */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок путеводителя *"
        className="w-full px-4 py-3 text-base font-semibold rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-300/50"
        style={glass.input}
      />

      {/* 3. Вступление */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Вступление — главная мысль, зачем ехать в это место…"
        className="w-full min-h-[100px] px-4 py-3 text-sm rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-300/50"
        style={glass.input}
      />

      {/* 4. Секции */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--glass-text)' }}>Секции путеводителя</span>
          <button onClick={addGuideSection}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl transition-all"
            style={{ ...glass.card, background: 'rgba(59,130,246,0.12)', color: 'var(--text-accent, #2563eb)' }}>
            <Plus size={12} /> Добавить секцию
          </button>
        </div>

        <AnimatePresence>
          {guideSections.map((sec, idx) => (
            <motion.div key={sec.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-2xl space-y-3" style={glass.card}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--glass-text-secondary)' }}>Секция {idx + 1}</span>
                <button onClick={() => removeGuideSection(sec.id)} className="text-red-400 hover:text-red-600"><FaTrash size={12} /></button>
              </div>
              <input type="text" value={sec.title} onChange={(e) => updateGuideSection(sec.id, { title: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none" style={glass.input} placeholder="Заголовок секции…" />
              <textarea value={sec.content} onChange={(e) => updateGuideSection(sec.id, { content: e.target.value })}
                className="w-full px-3 py-2 text-sm min-h-[60px] rounded-xl resize-none focus:outline-none" style={glass.input}
                placeholder="Что здесь важно знать / увидеть…" />

              <div className="flex gap-2 flex-wrap">
                {sec.hasMap ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ ...glass.card, background: 'rgba(59,130,246,0.08)' }}>
                    {sec.routeId && <><FaRoute size={12} className="text-blue-500" /> Маршрут</>}
                    {sec.markerId && <><FaMapMarkerAlt size={12} className="text-green-500" /> Метка</>}
                    {sec.eventId && <><FaCalendar size={12} className="text-purple-500" /> Событие</>}
                    <button onClick={() => updateGuideSection(sec.id, { hasMap: false, routeId: undefined, markerId: undefined, eventId: undefined })} className="text-red-400 ml-1"><FaTimes size={10} /></button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { setHookPickerTab('routes'); setShowHookPicker(true); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors" style={{ ...glass.card, color: 'var(--glass-text)' }}>
                      <FaRoute size={10} className="text-blue-500" /> Маршрут
                    </button>
                    <button onClick={() => { setHookPickerTab('markers'); setShowHookPicker(true); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors" style={{ ...glass.card, color: 'var(--glass-text)' }}>
                      <FaMapMarkerAlt size={10} className="text-green-500" /> Метка
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {guideSections.length === 0 && (
          <p className="text-center py-6 text-sm italic" style={{ color: 'var(--glass-text-secondary)' }}>
            Добавь первую секцию — «Как добраться» или «Где сфотографировать»
          </p>
        )}
      </div>

      {renderError()}

      {/* 5. Кнопки */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSaveOffline} disabled={loading || !body.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-xl disabled:opacity-40 transition-all"
          style={{ ...glass.card, color: 'var(--glass-text)' }}>
          <FaCloud size={12} /> Черновик
        </button>
        <div className="flex-1" />
        <button onClick={handleCreatePost} disabled={loading || !canPublish}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><FaPaperPlane size={12} /> Опубликовать гид</>}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  //  CONTINUE — «Продолжить черновик»
  //  Список черновиков → нажатие → загрузка в story-редактор
  // ═══════════════════════════════════════════════════

  const renderContinueEditor = () => (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--glass-text-secondary)' }}>
        Выбери черновик, чтобы продолжить:
      </p>

      {draftsList.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <FaCloud size={32} style={{ color: 'var(--glass-text-secondary)', margin: '0 auto' }} />
          <p className="text-sm" style={{ color: 'var(--glass-text-secondary)' }}>Черновиков пока нет</p>
          <button
            onClick={() => setMode('instant')}
            className="px-4 py-2 text-sm rounded-xl transition-all"
            style={{ ...glass.card, background: 'rgba(59,130,246,0.08)', color: 'var(--text-accent, #2563eb)' }}
          >
            Создать новый пост
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {draftsList.map((d) => (
            <motion.button
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => loadDraft(d.id)}
              className="w-full text-left p-4 rounded-2xl transition-all"
              style={{ ...glass.card, background: 'rgba(255,255,255,0.12)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(245,158,11,0.12)' }}>
                  <FaCloud className="text-amber-500" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  {d.title && <p className="text-sm font-semibold truncate" style={{ color: 'var(--glass-text)' }}>{d.title}</p>}
                  <p className="text-sm truncate" style={{ color: 'var(--glass-text)' }}>
                    {d.text?.slice(0, 80) || 'Без текста'}
                    {(d.text?.length || 0) > 80 ? '…' : ''}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--glass-text-secondary)' }}>
                    {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                    {d.hasImages && ' · с фото'}
                    {d.hasTrack && ' · с маршрутом'}
                  </p>
                </div>
                <ChevronLeft className="w-4 h-4 mt-1 rotate-180 shrink-0" style={{ color: 'var(--glass-text-secondary)' }} />
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════
  //  Маппинг режима → редактор
  // ═══════════════════════════════════════════════════

  const modeTitle: Record<CreationMode, string> = {
    instant: 'Момент здесь и сейчас',
    story: 'Впечатление дня',
    guide: 'Мой путеводитель',
    continue: 'Продолжить черновик',
  };

  const renderCurrentEditor = () => {
    switch (mode) {
      case 'instant': return renderInstantEditor();
      case 'story': return renderStoryEditor();
      case 'guide': return renderGuideEditor();
      case 'continue': return renderContinueEditor();
      default: return null;
    }
  };

  // ═══════════════════════════════════════════════════
  //  INLINE-форма (встроена в Posts.tsx)
  // ═══════════════════════════════════════════════════

  if (inline) {
    return (
      <>
        <div className="create-post-inline" style={{ padding: '0 4px' }}>
          <AnimatePresence mode="wait">
            {mode === 'select' ? (
              <motion.div key="sel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between mb-2 px-2">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--glass-text)' }}>Новый пост</h3>
                  <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ ...glass.card, background: 'rgba(255,255,255,0.3)' }}>
                    <FaTimes size={14} style={{ color: 'var(--glass-text)' }} />
                  </button>
                </div>
                <ModeSelector onSelect={(m) => setMode(m)} hasDraft={hasDraft} isOnline={navigator.onLine} />
              </motion.div>
            ) : (
              <motion.div key="editor" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-2 mb-4 px-2">
                  <BackButton />
                  <h3 className="text-base font-semibold flex-1" style={{ color: 'var(--glass-text)' }}>
                    {modeTitle[mode as CreationMode]}
                  </h3>
                  <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ ...glass.card, background: 'rgba(255,255,255,0.3)' }}>
                    <FaTimes size={14} style={{ color: 'var(--glass-text)' }} />
                  </button>
                </div>
                <div className="px-2">
                  {renderCurrentEditor()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {renderHookPicker()}
      </>
    );
  }

  // ═══════════════════════════════════════════════════
  //  MODAL (полноэкранный)
  // ═══════════════════════════════════════════════════

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.45)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-2xl overflow-hidden flex flex-col"
          style={{
            ...glass.bg,
            border: '1px solid var(--border-light, rgba(255,255,255,0.25))',
            boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
          }}
        >
          <AnimatePresence mode="wait">
            {mode === 'select' ? (
              <motion.div key="sel" className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--glass-text, var(--text-primary))' }}>Создать запись</h2>
                  <button onClick={onClose} className="p-2 rounded-full transition-colors" style={{ color: 'var(--glass-text-secondary)' }}>
                    <FaTimes size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ModeSelector onSelect={(m) => setMode(m)} hasDraft={hasDraft} isOnline={navigator.onLine} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="editor" className="flex flex-col h-full" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  <BackButton />
                  <h2 className="text-lg font-semibold flex-1" style={{ color: 'var(--glass-text, var(--text-primary))' }}>
                    {modeTitle[mode as CreationMode]}
                  </h2>
                  <button onClick={onClose} className="p-2 rounded-full transition-colors" style={{ color: 'var(--glass-text-secondary)' }}>
                    <FaTimes size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {renderCurrentEditor()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      {renderHookPicker()}
    </>
  );
};

export default CreatePostModal;
