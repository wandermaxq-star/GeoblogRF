import { useEffect, useState, useCallback } from 'react';
import { getSummary, getUserRating, rate, RatingTarget, RatingSummary } from '../services/ratingsService';
import { useAuth } from '../contexts/AuthContext';

interface UseRatingResult {
  summary: RatingSummary;
  userRating: number | null;
  isLoading: boolean;
  error: string | null;
  handleRate: (value: number) => Promise<void>;
}

export function useRating(target: RatingTarget, id: string | number | undefined | null): UseRatingResult {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<RatingSummary>({ avg: 0, count: 0 });
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        // Получаем сводку рейтинга (доступно для всех)
        const s = await getSummary(target, String(id));
        if (!mounted) return;
        setSummary(s);
        
        // Получаем рейтинг пользователя только если авторизован
        if (user && token) {
          const ur = await getUserRating(target, String(id));
          if (!mounted) return;
          setUserRating(ur);
        } else {
          setUserRating(null);
        }
      } catch (e) {
        if (!mounted) return;
        setError('Failed to load rating');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [target, id, user, token]);

  const handleRate = useCallback(async (value: number) => {
    // КРИТИЧНО: Оценка доступна только для авторизованных пользователей
    if (!id || !user || !token) {
      console.log('[useRating] Rating requires authentication');
      return;
    }
    try {
      const s = await rate(target, String(id), value);
      setUserRating(value);
      setSummary(s);
    } catch (e) {
      // ignore
    }
  }, [target, id, user, token]);

  return { summary, userRating, isLoading, error, handleRate };
}

export default useRating;




