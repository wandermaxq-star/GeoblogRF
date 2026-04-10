/**
 * Hook для отслеживания новых (непрочитанных) комментариев
 * Сохраняет информацию о просмотренных комментариях в localStorage
 */

import { useEffect, useState } from 'react';

const COMMENTS_VIEWED_KEY = 'geoblog_comments_viewed'; // ключ в localStorage

export interface CommentsViewedData {
  [postId: string]: {
    timestamp: number; // время последнего просмотра (ms)
    count: number; // количество комментариев на момент просмотра
  };
}

/**
 * Получить или инициализировать данные о просмотренных комментариях
 */
function getViewedData(): CommentsViewedData {
  try {
    const data = localStorage.getItem(COMMENTS_VIEWED_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Сохранить данные о просмотренных комментариях
 */
function saveViewedData(data: CommentsViewedData) {
  try {
    localStorage.setItem(COMMENTS_VIEWED_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('⚠️ Не удалось сохранить данные о комментариях:', err);
  }
}

/**
 * Хук для проверки наличия новых комментариев
 * @param postId - ID поста
 * @param commentsCount - текущее количество комментариев
 * @param onMarkAsViewed - callback когда комментарии отмечены как просмотренные
 * @returns { hasNew: boolean, markAsViewed: () => void }
 */
export function useNewComments(
  postId: string | number,
  commentsCount: number = 0,
  onMarkAsViewed?: () => void
) {
  const [hasNew, setHasNew] = useState(false);

  // Проверить есть ли новые комментарии при монтировании или изменении счётчика
  useEffect(() => {
    const data = getViewedData();
    const viewed = data[String(postId)];

    if (!viewed) {
      // Первый раз - нет новых комментариев
      setHasNew(false);
    } else {
      // Если количество увеличилось с момента просмотра - есть новые
      setHasNew(commentsCount > viewed.count);
    }
  }, [postId, commentsCount]);

  // Отметить комментарии как просмотренные (вызвать когда пользователь открыл комментарии)
  const markAsViewed = () => {
    const data = getViewedData();
    data[String(postId)] = {
      timestamp: Date.now(),
      count: commentsCount,
    };
    saveViewedData(data);
    setHasNew(false);
    onMarkAsViewed?.();
  };

  return {
    hasNew,
    markAsViewed,
  };
}

/**
 * Получить время последнего просмотра комментариев для поста
 */
export function getLastViewedTime(postId: string | number): number | null {
  const data = getViewedData();
  return data[String(postId)]?.timestamp ?? null;
}

/**
 * Получить последнее известное количество комментариев для поста
 */
export function getLastViewedCount(postId: string | number): number | null {
  const data = getViewedData();
  return data[String(postId)]?.count ?? null;
}

/**
 * Очистить данные о просмотренных комментариях (для дебага)
 */
export function clearViewedComments() {
  localStorage.removeItem(COMMENTS_VIEWED_KEY);
}
