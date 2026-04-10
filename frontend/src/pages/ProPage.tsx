import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Map, Navigation, Sparkles, Layers, CalendarRange, ShieldCheck, Wallet, Check, Crown, Wifi, WifiOff, Percent, Compass } from 'lucide-react';
import CentreBackground from '../components/Centre/CentreBackground';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';
import OfflineMapWidget from '../components/Offline/OfflineMapWidget';
import DownloadRoutePackModal from '../components/Offline/DownloadRoutePackModal';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_PRO_ROUTE_PACK_ID, PRO_ROUTE_PACKS as STATIC_ROUTE_PACKS } from '../data/proRoutePacks';
import type { CuratedRouteKind, CuratedRouteVariant, CuratedRoutePack } from '../types/proRoutePacks';
import { offlineService, type OfflineRoutePackData } from '../services/offlineService';

// Константы PRO-подписки
const PRO_SUBSCRIPTION_PRICE = 350; // ₽/месяц
const PRO_PACK_DISCOUNT = 15; // % скидка на кураторские паки

const ProPage = () => {
  const isMobile = useIsMobile();
  usePanelRegistration();

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        <Suspense fallback={<div className="centre-scroll-area" />}>
          {isMobile ? <MobileVersion /> : <DesktopVersion />}
        </Suspense>
      </MirrorGradientContainer>
    </>
  );
};

const ROUTE_KIND_LABELS: Record<CuratedRouteKind, string> = {
  federal: 'Федеральный маршрут',
  regional: 'Региональный маршрут',
  event: 'Событийный пакет',
};

const DesktopVersion = () => <ProExperience compact={false} />;

const MobileVersion = () => <ProExperience compact={true} />;

const ProExperience: React.FC<{ compact: boolean }> = ({ compact }) => {
  const { user, updateUser } = useAuth();
  const [routePacks, setRoutePacks] = useState<CuratedRoutePack[]>(STATIC_ROUTE_PACKS);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // загрузка каталогов с сервера, если доступно
  useEffect(() => {
    setLoadingPacks(true);
    fetch('/api/curated-route-packs')
      .then((r) => r.json())
      .then((data: CuratedRoutePack[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setRoutePacks(data);
          setActivePackId(data[0].id);
        }
      })
      .catch(() => {
        // оставляем статические данные
      })
      .finally(() => setLoadingPacks(false));
  }, []);

  const [activePackId, setActivePackId] = useState<string | null>(
    DEFAULT_PRO_ROUTE_PACK_ID || routePacks[0]?.id || null,
  );
  const [hoveredPackId, setHoveredPackId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [enabledWaypointIds, setEnabledWaypointIds] = useState<string[]>([]);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [savedPack, setSavedPack] = useState<OfflineRoutePackData | null>(null);
  const [downloadedPackIds, setDownloadedPackIds] = useState<string[]>([]);
  const [isRemovingSavedPack, setIsRemovingSavedPack] = useState(false);
  const [purchasedPackIds, setPurchasedPackIds] = useState<string[]>([]);
  const [purchaseInProgress, setPurchaseInProgress] = useState<string | null>(null);
  const [loadingPurchased, setLoadingPurchased] = useState(false);

  const activePack = useMemo<CuratedRoutePack | null>(
    () => routePacks.find((pack) => pack.id === activePackId) ?? routePacks[0] ?? null,
    [activePackId, routePacks],
  );

  const previewPack = useMemo(
    () => routePacks.find((pack) => pack.id === hoveredPackId) ?? activePack,
    [activePack, hoveredPackId, routePacks],
  );

  const activeVariant = useMemo<CuratedRouteVariant | undefined>(() => {
    if (!activePack) return undefined;
    return activePack.variants.find((variant: CuratedRouteVariant) => variant.id === selectedVariantId) ?? activePack.variants[0];
  }, [activePack, selectedVariantId]);

  const previewVariant = useMemo<CuratedRouteVariant | undefined>(() => {
    if (!previewPack || !activePack) return undefined;
    if (previewPack.id === activePack.id) {
      return activeVariant;
    }

    return previewPack.variants[0];
  }, [activePack?.id, activeVariant, previewPack]);

  useEffect(() => {
    if (!activePack) return;
    const defaultVariant = activePack.variants[0];
    setSelectedVariantId(defaultVariant?.id ?? null);
  }, [activePackId, activePack]);

  useEffect(() => {
    if (!activeVariant) return;
    setEnabledWaypointIds(
      activeVariant.waypoints
        .filter((waypoint) => waypoint.isDefaultEnabled || waypoint.isRequired)
        .map((waypoint) => waypoint.id),
    );
  }, [activeVariant]);

  useEffect(() => {
    if (!user?.id) {
      setPurchasedPackIds([]);
      return;
    }

    setLoadingPurchased(true);
    fetch('/api/users/purchased-route-packs', { headers: { Accept: 'application/json' } })
      .then((res) => res.json())
      .then((data) => {
        setPurchasedPackIds(Array.isArray(data.purchased_packs) ? data.purchased_packs : []);
      })
      .catch(() => setPurchasedPackIds([]))
      .finally(() => setLoadingPurchased(false));
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    offlineService
      .getDownloadedRoutePacks()
      .then((packs) => {
        if (!isMounted) return;
        setDownloadedPackIds(packs.map((pack) => pack.packId));
        setSavedPack(packs.find((pack) => pack.packId === activePack?.id) ?? null);
      })
      .catch(() => {
        if (!isMounted) return;
        setDownloadedPackIds([]);
        setSavedPack(null);
      });

    return () => {
      isMounted = false;
    };
  }, [activePack?.id]);

  const enabledWaypoints = useMemo(
    () => activeVariant?.waypoints.filter((waypoint) => enabledWaypointIds.includes(waypoint.id)) ?? [],
    [activeVariant, enabledWaypointIds],
  );

  const previewWaypoints = useMemo(() => {
    if (!previewVariant) return [];

    if (previewPack?.id === activePack?.id) {
      return previewVariant.waypoints.filter((waypoint) => waypoint.isRequired || enabledWaypointIds.includes(waypoint.id));
    }

    return previewVariant.waypoints.filter((waypoint) => waypoint.isRequired || waypoint.isDefaultEnabled);
  }, [activePack?.id, enabledWaypointIds, previewPack?.id, previewVariant]);

  const estimatedBundleSize = useMemo(() => {
    if (!activeVariant) return 0;

    return activeVariant.estimatedBaseSizeMb + enabledWaypoints.reduce((sum, waypoint) => sum + waypoint.estimatedTileWeightMb, 0);
  }, [activeVariant, enabledWaypoints]);

  const coveredRegionCount = useMemo(() => {
    if (!activePack) return 0;
    const regionIds = new Set(activePack.regions);
    enabledWaypoints.forEach((waypoint) => regionIds.add(waypoint.regionId));
    return regionIds.size;
  }, [activePack?.regions, enabledWaypoints]);

  const isPremiumUser = offlineService.isPremiumUser(user?.subscription_expires_at);
  const isCurrentPackPurchased = activePack ? purchasedPackIds.includes(activePack.id) : false;
  
  // Расчёт цены с учётом PRO-скидки
  const currentPackBasePrice = activePack?.price || 0;
  const currentPackAuthorDiscount = activePack?.discount || 0;
  
  // PRO-скидка применяется к уже сниженной цене (если есть скидка автора)
  const priceAfterAuthorDiscount = Math.round(currentPackBasePrice * (1 - currentPackAuthorDiscount / 100));
  const proDiscountAmount = isPremiumUser ? Math.round(priceAfterAuthorDiscount * PRO_PACK_DISCOUNT / 100) : 0;
  const finalPrice = priceAfterAuthorDiscount - proDiscountAmount;

  const downloadStatusLabel = useMemo(() => {
    if (!user) return 'Нужен аккаунт';
    if (!isPremiumUser) return 'Требуется PRO';
    if (!savedPack) return 'Ещё не скачан';
    return `Сохранён ${new Date(savedPack.downloadedAt).toLocaleDateString('ru-RU')}`;
  }, [isPremiumUser, savedPack, user]);

  const optionalWaypointCount = activeVariant?.waypoints.filter((waypoint) => !waypoint.isRequired).length ?? 0;

  const toggleWaypoint = (waypointId: string) => {
    const waypoint = activeVariant?.waypoints.find((item) => item.id === waypointId);
    if (!waypoint || waypoint.isRequired) return;

    setEnabledWaypointIds((current) =>
      current.includes(waypointId)
        ? current.filter((id) => id !== waypointId)
        : [...current, waypointId],
    );
  };

  const handlePackDownloadComplete = (downloadedPack: OfflineRoutePackData) => {
    setSavedPack(downloadedPack);
    setDownloadedPackIds((current) => (current.includes(downloadedPack.packId) ? current : [...current, downloadedPack.packId]));
    setIsDownloadModalOpen(false);

    // если в профиле есть счётчик пакетов, увеличиваем его
    if (user && updateUser) {
      updateUser({ packsPurchased: (user.packsPurchased || 0) + 1 });
    }
  };

  const purchasePack = async (packId: string) => {
    if (!user?.id) return;
    setPurchaseInProgress(packId);

    try {
      const response = await fetch(`/api/curated-route-packs/${packId}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Ошибка покупки');
      }
      setPurchasedPackIds((current) => (current.includes(packId) ? current : [...current, packId]));
      if (updateUser) {
        updateUser({ purchasedPacks: [...(user.purchasedPacks || []), packId] });
      }
    } catch (error) {
      console.error('purchase pack error', error);
    } finally {
      setPurchaseInProgress(null);
    }
  };


  const handleDeleteSavedPack = async () => {
    if (!activePack) return;
    setIsRemovingSavedPack(true);

    try {
      await offlineService.deleteRoutePackData(activePack.id);
      setSavedPack(null);
      setDownloadedPackIds((current) => current.filter((packId) => packId !== activePack.id));
    } finally {
      setIsRemovingSavedPack(false);
    }
  };

  if (!activePack || !activeVariant || !previewPack || !previewVariant) {
    return null;
  }

  return (
    <>
      <div className="centre-static-header">
        <div style={{ fontSize: compact ? '24px' : '32px', marginBottom: compact ? '8px' : '12px' }}>👑</div>
        <h1 style={{
          fontSize: compact ? '20px' : '28px',
          fontWeight: '700',
          color: 'var(--glass-text)',
          margin: '0 0 4px 0'
        }}>
          PRO подписка
        </h1>
        <p style={{
          fontSize: compact ? '12px' : '14px',
          color: 'var(--text-accent)',
          margin: '0'
        }}>
          Офлайн-карты, скидки на паки и приоритетные функции
        </p>
      </div>

      <div className="centre-scroll-area">
        <div className="centre-content" style={{ display: 'flex', flexDirection: 'column', gap: compact ? '12px' : '16px' }}>
          
          {/* ═══════════════════════════════════════════════════════════
              ГЛАВНЫЙ БЛОК: Преимущества PRO
          ═══════════════════════════════════════════════════════════ */}
          <div className="centre-glass-card" style={{
            background: isPremiumUser 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(14, 165, 233, 0.12) 100%)'
              : 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.08) 100%)',
            border: isPremiumUser 
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(249, 115, 22, 0.25)',
          }}>
            {/* Заголовок и статус */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: isPremiumUser ? 'rgba(16, 185, 129, 0.2)' : 'rgba(249, 115, 22, 0.2)', marginBottom: '12px' }}>
                  <Crown size={16} style={{ color: isPremiumUser ? '#10B981' : '#F59E0B' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: isPremiumUser ? '#10B981' : '#F59E0B' }}>
                    {isPremiumUser ? 'PRO активен' : `${PRO_SUBSCRIPTION_PRICE} ₽/месяц`}
                  </span>
                </div>
                <h2 style={{ color: 'var(--glass-text)', margin: '0 0 8px 0', fontSize: compact ? '20px' : '26px', lineHeight: 1.2 }}>
                  {isPremiumUser ? 'Вы — PRO-подписчик' : 'Разблокируйте все возможности'}
                </h2>
                <p style={{ color: 'var(--cg-text-muted)', margin: 0, fontSize: compact ? '13px' : '14px', lineHeight: 1.6 }}>
                  {isPremiumUser 
                    ? 'Офлайн-карты и скидка 15% на все кураторские паки уже доступны. Скачивайте маршруты и путешествуйте без интернета.'
                    : 'Скачивайте офлайн-паки, получайте скидку 15% на кураторские маршруты и путешествуйте без интернета.'}
                </p>
              </div>

              {/* Цена / Кнопка */}
              {!isPremiumUser && (
                <div style={{ 
                  minWidth: '180px', 
                  padding: '16px 20px', 
                  borderRadius: '16px', 
                  background: 'rgba(255,255,255,0.08)', 
                  border: '1px solid rgba(255,255,255,0.12)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--glass-text)', lineHeight: 1 }}>
                    {PRO_SUBSCRIPTION_PRICE} ₽
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)', marginBottom: '12px' }}>
                    в месяц
                  </div>
                  <button style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.9), rgba(234, 88, 12, 0.85))',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                  }}>
                    Оформить PRO
                  </button>
                </div>
              )}
              
              {isPremiumUser && (
                <div style={{ 
                  minWidth: '180px', 
                  padding: '16px 20px', 
                  borderRadius: '16px', 
                  background: 'rgba(16, 185, 129, 0.12)', 
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  textAlign: 'center'
                }}>
                  <Check size={32} style={{ color: '#10B981', marginBottom: '8px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#10B981' }}>
                    PRO активен
                  </div>
                  {user?.subscription_expires_at && (
                    <div style={{ fontSize: '11px', color: 'var(--cg-text-muted)', marginTop: '4px' }}>
                      до {new Date(user.subscription_expires_at).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Преимущества */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '12px', 
              marginTop: '20px' 
            }}>
              <ProBenefit 
                icon={<WifiOff size={20} />}
                title="Офлайн-карты"
                description="Скачивайте паки и путешествуйте без интернета"
                active={isPremiumUser}
              />
              <ProBenefit 
                icon={<Percent size={20} />}
                title={`Скидка ${PRO_PACK_DISCOUNT}% на паки`}
                description="На все кураторские маршруты и эксклюзивы"
                active={isPremiumUser}
                highlight
              />
              <ProBenefit 
                icon={<Compass size={20} />}
                title="GPS-навигация офлайн"
                description="Ваши координаты без сети и Wi-Fi"
                active={isPremiumUser}
              />
              <ProBenefit 
                icon={<Crown size={20} />}
                title="Приоритетная поддержка"
                description="Быстрые ответы и помощь с маршрутами"
                active={isPremiumUser}
              />
            </div>

            {/* Пример экономии */}
            {!isPremiumUser && (
              <div style={{ 
                marginTop: '16px', 
                padding: '12px 16px', 
                borderRadius: '12px', 
                background: 'rgba(249, 115, 22, 0.08)', 
                border: '1px solid rgba(249, 115, 22, 0.15)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Wallet size={16} style={{ color: '#F59E0B' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--glass-text)' }}>
                    Пример экономии
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)', lineHeight: 1.5 }}>
                  Купив 3 пакета по 500 ₽ со скидкой 15%, вы экономите <strong style={{ color: '#10B981' }}>225 ₽</strong> — 
                  это 65% стоимости подписки. При активных путешествиях PRO окупается за первую же поездку.
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              КАТАЛОГ ПАКОВ
          ═══════════════════════════════════════════════════════════ */}
          <div className="centre-glass-card" style={{
            background: 'linear-gradient(140deg, rgba(15, 118, 110, 0.16) 0%, rgba(14, 165, 233, 0.14) 55%, rgba(245, 158, 11, 0.10) 100%)',
            borderColor: 'rgba(15, 118, 110, 0.25)'
          }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: compact ? '100%' : '70%' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', color: 'var(--glass-text)', fontSize: compact ? '11px' : '12px', fontWeight: 600, marginBottom: compact ? '10px' : '12px' }}>
                  <Sparkles size={compact ? 14 : 16} />
                  curated route packs MVP
                </div>
                <h2 style={{ color: 'var(--glass-text)', margin: '0 0 10px 0', fontSize: compact ? '18px' : '24px', lineHeight: 1.15 }}>
                  {activePack.title}
                </h2>
                {activePack.variants.length > 1 && (
                  <select
                    className="variant-select"
                    value={activeVariant.id}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    style={{ marginBottom: '8px', padding: '4px 6px' }}
                  >
                    {activePack.variants.map((v: CuratedRouteVariant) => (
                      <option key={v.id} value={v.id}>{v.title}</option>
                    ))}
                  </select>
                )}
                <p style={{ color: 'var(--glass-text)', opacity: 0.9, margin: '0 0 10px 0', fontSize: compact ? '12px' : '14px', lineHeight: 1.55 }}>
                  {activePack.subtitle}
                </p>
                <p style={{ color: 'var(--cg-text-muted)', margin: 0, fontSize: compact ? '11px' : '13px', lineHeight: 1.6 }}>
                  {activePack.summary}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: compact ? '14px' : '18px' }}>
                  <button
                    onClick={() => setIsDownloadModalOpen(true)}
                    style={primaryActionStyle}
                  >
                    <Download size={compact ? 14 : 16} />
                    <span>{savedPack ? 'Обновить offline-пакет' : 'Скачать offline-пакет'}</span>
                  </button>
                  {savedPack && (
                    <button
                      onClick={handleDeleteSavedPack}
                      disabled={isRemovingSavedPack}
                      style={{
                        ...secondaryActionStyle,
                        opacity: isRemovingSavedPack ? 0.6 : 1,
                        cursor: isRemovingSavedPack ? 'default' : 'pointer',
                      }}
                    >
                      <span>{isRemovingSavedPack ? 'Удаляем...' : 'Удалить локальный пакет'}</span>
                    </button>
                  )}

                <div style={{ width: '100%', margin: '10px 0', padding: '10px', borderRadius: '12px', background: 'rgba(15, 118, 110, 0.1)', border: '1px solid rgba(15, 118, 110, 0.2)' }}>
                  <div style={{ fontSize: compact ? '12px' : '14px', fontWeight: 700, marginBottom: '6px' }}>
                    {activePack.exclusive ? 'Эксклюзивный пакет гида' : 'Кураторский пакет'}
                  </div>
                  
                  {/* Цена с учётом скидок */}
                  <div style={{ fontSize: compact ? '11px' : '13px', color: 'var(--cg-text-muted)' }}>
                    {isPremiumUser && proDiscountAmount > 0 ? (
                      <>
                        <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{currentPackBasePrice} ₽</span>
                        {' → '}
                        <strong style={{ color: '#10B981' }}>{finalPrice} ₽</strong>
                        <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '11px', fontWeight: 600 }}>
                          PRO −{PRO_PACK_DISCOUNT}%
                        </span>
                      </>
                    ) : currentPackAuthorDiscount > 0 ? (
                      <>
                        <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{currentPackBasePrice} ₽</span>
                        {' → '}
                        <strong>{finalPrice} ₽</strong>
                        <span style={{ marginLeft: '8px', color: 'var(--text-accent)', fontSize: '11px' }}>
                          скидка {currentPackAuthorDiscount}%
                        </span>
                      </>
                    ) : (
                      <strong>{currentPackBasePrice} ₽</strong>
                    )}
                  </div>
                  
                  {!isPremiumUser && !isCurrentPackPurchased && (
                    <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.15)' }}>
                      <span style={{ fontSize: '11px', color: '#F59E0B' }}>
                        💡 С PRO-подпиской скидка 15% → {Math.round(priceAfterAuthorDiscount * 0.85)} ₽
                      </span>
                    </div>
                  )}
                  
                  {!isCurrentPackPurchased && (
                    <button
                      onClick={() => purchasePack(activePack.id)}
                      disabled={!!purchaseInProgress}
                      style={{ ...primaryActionStyle, marginTop: '10px' }}
                    >
                      <span>{purchaseInProgress === activePack.id ? 'Покупка...' : `Купить за ${finalPrice} ₽`}</span>
                    </button>
                  )}
                  {isCurrentPackPurchased && (
                    <div style={{ marginTop: '10px', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={16} />
                      Пакет куплен навсегда
                    </div>
                  )}
                </div>

              {/* waypoint toggles */}
              {activeVariant?.waypoints.length > 1 && (
                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ fontSize: compact ? '14px' : '16px', margin: '8px 0' }}>Выбор точек</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {activeVariant.waypoints.map((wp) => {
                      if (wp.isRequired) {
                        return (
                          <span key={wp.id} style={{ opacity: 0.6, fontSize: compact ? '11px' : '12px' }}>{wp.title}</span>
                        );
                      }
                      const enabled = enabledWaypointIds.includes(wp.id);
                      return (
                        <label
                          key={wp.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            fontSize: compact ? '11px' : '12px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleWaypoint(wp.id)}
                          />
                          {wp.title}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
                </div>
              </div>

              <div style={{ minWidth: compact ? '100%' : '220px', display: 'grid', gap: '10px' }}>
                <MetricCard icon={<Navigation size={compact ? 16 : 18} />} label="Формат" value={ROUTE_KIND_LABELS[activePack.routeKind]} compact={compact} />
                <MetricCard icon={<Download size={compact ? 16 : 18} />} label="Сейчас в пакете" value={`${estimatedBundleSize.toFixed(0)} МБ`} compact={compact} />
                <MetricCard icon={<CalendarRange size={compact ? 16 : 18} />} label="Рекомендация" value={activeVariant.durationLabel} compact={compact} />
                <MetricCard icon={<ShieldCheck size={compact ? 16 : 18} />} label="Оффлайн-статус" value={downloadStatusLabel} compact={compact} />
              </div>
            </div>
          </div>

          <div className="centre-glass-card">
            <SectionTitle icon={<Layers size={compact ? 18 : 20} />} title="Каталог маршрутных пакетов" compact={compact} />
            {/* search/filter */}
            <div style={{ margin: '12px 0' }}>
              <input
                type="text"
                placeholder="Поиск по названию…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}
              />
              {loadingPacks && <div style={{ color: 'var(--glass-text)', marginTop: '6px' }}>Загрузка…</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
              {routePacks
                .filter((pack) => pack.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((pack) => {
                const isActive = pack.id === activePack?.id;
                const isPreview = pack.id === previewPack?.id;
                const isDownloaded = downloadedPackIds.includes(pack.id);

                return (
                  <button
                    key={pack.id}
                    onClick={() => setActivePackId(pack.id)}
                    onMouseEnter={() => !compact && setHoveredPackId(pack.id)}
                    onMouseLeave={() => !compact && setHoveredPackId(null)}
                    onFocus={() => setHoveredPackId(pack.id)}
                    onBlur={() => setHoveredPackId(null)}
                    style={{
                      textAlign: 'left',
                      borderRadius: '16px',
                      padding: compact ? '14px' : '16px',
                      border: isActive ? '1px solid rgba(14, 165, 233, 0.45)' : '1px solid rgba(255,255,255,0.14)',
                      background: isActive
                        ? 'linear-gradient(150deg, rgba(14, 165, 233, 0.18), rgba(15, 118, 110, 0.14))'
                        : isPreview
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      color: 'inherit'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: compact ? '13px' : '14px' }}>
                        {pack.title}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {isDownloaded && (
                          <span style={{ color: '#34d399', fontSize: compact ? '10px' : '11px', fontWeight: 700 }}>
                            offline
                          </span>
                        )}
                        <span style={{ color: 'var(--text-accent)', fontSize: compact ? '10px' : '11px', fontWeight: 700 }}>
                          {ROUTE_KIND_LABELS[pack.routeKind]}
                        </span>
                      </div>
                    </div>
                    <p style={{ color: 'var(--cg-text-muted)', margin: '0 0 12px 0', fontSize: compact ? '11px' : '12px', lineHeight: 1.5 }}>
                      {pack.highlight}
                    </p>
                    <div style={{ color: 'var(--glass-text)', fontSize: compact ? '11px' : '12px', fontWeight: 600, marginBottom: '10px' }}>
                      {pack.heroMetric}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {pack.tags.map((tag: string) => (
                        <span key={tag} style={{ padding: '5px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', color: 'var(--cg-text-muted)', fontSize: compact ? '10px' : '11px' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: '16px' }}>
            <div className="centre-glass-card" style={{ paddingBottom: compact ? '12px' : '16px' }}>
              <SectionTitle icon={<Map size={compact ? 18 : 20} />} title="Интерактивное превью маршрута" compact={compact} />
              <p style={{ color: 'var(--cg-text-muted)', fontSize: compact ? '11px' : '12px', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Наведи или выбери маршрут, чтобы увидеть связанные регионы и ключевые точки поездки. Клик по региону по-прежнему открывает текущий модал скачивания, но сама витрина уже строится вокруг маршрутного пакета.
              </p>
              <div className="offline-map-widget" style={{
                minHeight: compact ? '360px' : '500px',
                height: compact ? '360px' : '500px',
                background: 'var(--glass-card-bg)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <OfflineMapWidget
                  highlightedRegionIds={previewPack.regions}
                  previewWaypoints={previewWaypoints}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="centre-glass-card">
                <SectionTitle icon={<Navigation size={compact ? 18 : 20} />} title="Вариант поездки" compact={compact} />
                <div style={{ display: 'grid', gap: '10px' }}>
                  {activePack.variants.map((variant: CuratedRouteVariant) => {
                    const isSelected = variant.id === activeVariant.id;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        style={{
                          textAlign: 'left',
                          padding: compact ? '12px' : '14px',
                          borderRadius: '14px',
                          border: isSelected ? '1px solid rgba(14, 165, 233, 0.45)' : '1px solid rgba(255,255,255,0.12)',
                          background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'rgba(255,255,255,0.05)',
                          cursor: 'pointer',
                          color: 'inherit'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: compact ? '12px' : '13px' }}>{variant.title}</span>
                          <span style={{ color: 'var(--text-accent)', fontWeight: 700, fontSize: compact ? '10px' : '11px' }}>{variant.durationLabel}</span>
                        </div>
                        <p style={{ color: 'var(--cg-text-muted)', margin: '0 0 8px 0', fontSize: compact ? '11px' : '12px', lineHeight: 1.45 }}>{variant.summary}</p>
                        <div style={{ color: 'var(--glass-text)', fontSize: compact ? '10px' : '11px' }}>
                          {variant.distanceLabel} · база {variant.estimatedBaseSizeMb} МБ
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="centre-glass-card">
                <SectionTitle icon={<Download size={compact ? 18 : 20} />} title="Состав оффлайн-пакета" compact={compact} />
                <div style={{ display: 'grid', gap: '10px' }}>
                  {activeVariant.waypoints.map((waypoint) => {
                    const enabled = enabledWaypointIds.includes(waypoint.id);
                    return (
                      <button
                        key={waypoint.id}
                        onClick={() => toggleWaypoint(waypoint.id)}
                        disabled={waypoint.isRequired}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '10px',
                          width: '100%',
                          textAlign: 'left',
                          padding: compact ? '10px 12px' : '12px 14px',
                          borderRadius: '14px',
                          border: enabled ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255,255,255,0.10)',
                          background: enabled ? 'rgba(16, 185, 129, 0.10)' : 'rgba(255,255,255,0.04)',
                          cursor: waypoint.isRequired ? 'default' : 'pointer',
                          opacity: enabled || waypoint.isRequired ? 1 : 0.78,
                          color: 'inherit'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: compact ? '12px' : '13px' }}>{waypoint.title}</span>
                            <span style={{ padding: '3px 7px', borderRadius: '999px', background: waypoint.isRequired ? 'rgba(14, 165, 233, 0.18)' : 'rgba(245, 158, 11, 0.16)', color: waypoint.isRequired ? '#38bdf8' : '#fbbf24', fontSize: compact ? '9px' : '10px', fontWeight: 700 }}>
                              {waypoint.isRequired ? 'обязательно' : enabled ? 'включено' : 'исключено'}
                            </span>
                          </div>
                          <p style={{ color: 'var(--cg-text-muted)', margin: 0, fontSize: compact ? '10px' : '11px', lineHeight: 1.45 }}>
                            {waypoint.note || 'Точка маршрута для оффлайн-навигации и сценарного визуала.'}
                          </p>
                        </div>
                        <div style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: compact ? '11px' : '12px', whiteSpace: 'nowrap' }}>
                          {waypoint.estimatedTileWeightMb} МБ
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="centre-glass-card" style={{ background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.12), rgba(8, 145, 178, 0.08))', borderColor: 'rgba(59, 130, 246, 0.24)' }}>
                <SectionTitle icon={<ShieldCheck size={compact ? 18 : 20} />} title="Что уже показывает MVP" compact={compact} />
                <div style={{ display: 'grid', gap: '8px', color: 'var(--cg-text-muted)', fontSize: compact ? '11px' : '12px', lineHeight: 1.5 }}>
                  <div>Маршрут выбирается как curated-сценарий, а не как пользовательский маршрут.</div>
                  <div>Скачивание теперь идёт не по региону, а по выбранному route pack и его варианту.</div>
                  <div>Опциональные остановки реально влияют на состав и размер сохраняемого пакета.</div>
                  <div>Локально хранится последний сохранённый вариант пакета, его покрытие и оффлайн-статус.</div>
                </div>
                <div style={{ marginTop: '14px', padding: compact ? '10px 12px' : '12px 14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: compact ? '12px' : '13px', marginBottom: '4px' }}>
                        Текущий расчёт пакета
                      </div>
                      <div style={{ color: 'var(--cg-text-muted)', fontSize: compact ? '10px' : '11px' }}>
                        {enabledWaypoints.length} точек включено · {optionalWaypointCount} опциональных доступны для управления · {coveredRegionCount} регионов покрытия
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-accent)', fontWeight: 800, fontSize: compact ? '18px' : '22px' }}>
                      {estimatedBundleSize.toFixed(0)} МБ
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DownloadRoutePackModal
        pack={activePack}
        variant={activeVariant}
        enabledWaypointIds={enabledWaypointIds}
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        onDownloadComplete={handlePackDownloadComplete}
      />
    </>
  );
};

const primaryActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '11px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(14, 165, 233, 0.38)',
  background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.28), rgba(15, 118, 110, 0.24))',
  color: 'var(--glass-text)',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '11px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--glass-text)',
  fontWeight: 600,
  cursor: 'pointer',
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; compact: boolean }> = ({ icon, title, compact }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '10px' : '12px', marginBottom: compact ? '10px' : '12px' }}>
    <div style={{ color: 'var(--text-accent)', flexShrink: 0 }}>{icon}</div>
    <h2 style={{
      fontSize: compact ? '14px' : '16px',
      fontWeight: '600',
      color: 'var(--glass-text)',
      margin: '0'
    }}>
      {title}
    </h2>
  </div>
);

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string; compact: boolean }> = ({ icon, label, value, compact }) => (
  <div style={{ padding: compact ? '10px 12px' : '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-accent)', marginBottom: '6px' }}>
      {icon}
      <span style={{ fontSize: compact ? '10px' : '11px', fontWeight: 700 }}>{label}</span>
    </div>
    <div style={{ color: 'var(--glass-text)', fontSize: compact ? '12px' : '13px', fontWeight: 700, lineHeight: 1.35 }}>
      {value}
    </div>
  </div>
);

// Компонент преимущества PRO
const ProBenefit: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  active?: boolean;
  highlight?: boolean;
}> = ({ icon, title, description, active, highlight }) => (
  <div style={{
    padding: '12px 14px',
    borderRadius: '14px',
    background: active 
      ? 'rgba(16, 185, 129, 0.08)' 
      : highlight 
        ? 'rgba(249, 115, 22, 0.08)'
        : 'rgba(255,255,255,0.04)',
    border: active 
      ? '1px solid rgba(16, 185, 129, 0.2)' 
      : highlight 
        ? '1px solid rgba(249, 115, 22, 0.2)'
        : '1px solid rgba(255,255,255,0.08)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <div style={{ 
        color: active ? '#10B981' : highlight ? '#F59E0B' : 'var(--text-accent)',
        opacity: active ? 1 : 0.7,
      }}>
        {icon}
      </div>
      <span style={{ 
        fontSize: '13px', 
        fontWeight: 700, 
        color: active ? '#10B981' : 'var(--glass-text)',
      }}>
        {title}
      </span>
    </div>
    <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)', lineHeight: 1.45 }}>
      {description}
    </div>
  </div>
);

export default ProPage;
