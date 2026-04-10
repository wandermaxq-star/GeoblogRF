/**
 * Хелпер для интеграции геймификации
 * Вызывается после успешного создания контента
 */

import { gamificationFacade } from '../services/gamificationFacade';
import { XPParams } from '../types/gamification';

/**
 * Добавить XP за создание поста
 */
export async function addXPForPost(postId: string, options: {
  hasPhoto?: boolean;
  hasMarker?: boolean;
  userId?: string;
}): Promise<void> {
  try {
    const userId = options.userId;
    if (!userId) {
      console.warn('GamificationHelper: userId не указан, пропускаем начисление XP');
      return;
    }

    // Базовый XP за создание поста
    const baseXP = await gamificationFacade.addXP({
      userId,
      source: 'post_created',
      amount: 50,
      contentId: postId,
      contentType: 'post',
      metadata: {
        hasPhoto: options.hasPhoto,
        hasMarker: options.hasMarker,
      },
    });

    // Бонус за фото
    if (options.hasPhoto) {
      await gamificationFacade.addXP({
        userId,
        source: 'post_with_photo',
        amount: 25,
        contentId: postId,
        contentType: 'post',
        metadata: {
          hasPhoto: true,
        },
      });
    }

    // Бонус за метку
    if (options.hasMarker) {
      await gamificationFacade.addXP({
        userId,
        source: 'post_with_marker',
        amount: 30,
        contentId: postId,
        contentType: 'post',
        metadata: {
          hasMarker: true,
        },
      });
    }
  } catch (error) {
    console.error('GamificationHelper.addXPForPost error:', error);
    // Не прерываем выполнение, если геймификация не работает
  }
}

/**
 * Добавить XP за создание метки
 */
export async function addXPForMarker(markerId: string, options: {
  hasPhoto?: boolean;
  hasDescription?: boolean;
  completeness?: number;
  userId?: string;
}): Promise<void> {
  try {
    const userId = options.userId;
    if (!userId) {
      console.warn('GamificationHelper: userId не указан, пропускаем начисление XP');
      return;
    }

    // Базовый XP за создание метки
    await gamificationFacade.addXP({
      userId,
      source: 'marker_created',
      amount: 30,
      contentId: markerId,
      contentType: 'marker',
      metadata: {
        hasPhoto: options.hasPhoto,
        completeness: options.completeness,
      },
    });

    // Бонус за фото
    if (options.hasPhoto) {
      await gamificationFacade.addXP({
        userId,
        source: 'marker_with_photo',
        amount: 20,
        contentId: markerId,
        contentType: 'marker',
        metadata: {
          hasPhoto: true,
        },
      });
    }

    // Бонус за описание
    if (options.hasDescription) {
      await gamificationFacade.addXP({
        userId,
        source: 'marker_with_description',
        amount: 15,
        contentId: markerId,
        contentType: 'marker',
        metadata: {
          completeness: options.completeness || 80,
        },
      });
    }

    // Бонус за качество
    if (options.completeness && options.completeness >= 90) {
      await gamificationFacade.addXP({
        userId,
        source: 'quality_perfect',
        amount: 30,
        contentId: markerId,
        contentType: 'marker',
        metadata: {
          completeness: options.completeness,
          quality: 'perfect',
        },
      });
    } else if (options.completeness && options.completeness >= 80) {
      await gamificationFacade.addXP({
        userId,
        source: 'quality_high',
        amount: 10,
        contentId: markerId,
        contentType: 'marker',
        metadata: {
          completeness: options.completeness,
          quality: 'high',
        },
      });
    }
  } catch (error) {
    console.error('GamificationHelper.addXPForMarker error:', error);
    // Не прерываем выполнение, если геймификация не работает
  }
}

/**
 * Добавить XP за создание события.
 * ВАЖНО: XP начисляется бэкендом при ОДОБРЕНИИ модератором (requiresModeration: true).
 * Эта функция предназначена для специальных случаев (например, события без модерации).
 * Не вызывается из AddEventModal при создании — бэкенд всё делает сам после approve.
 */
export async function addXPForEvent(eventId: string, options: {
  hasDescription?: boolean;
  hasLocation?: boolean;
  hasPhoto?: boolean;
  userId?: string;
}): Promise<void> {
  try {
    const userId = options.userId;
    if (!userId) {
      console.warn('GamificationHelper: userId не указан, пропускаем начисление XP');
      return;
    }

    await gamificationFacade.addXP({
      userId,
      source: 'event_created',
      amount: 50,
      contentId: eventId,
      contentType: 'event',
      metadata: {
        hasPhoto: options.hasPhoto,
        hasMarker: options.hasLocation,
      },
    });

    if (options.hasPhoto) {
      await gamificationFacade.addXP({
        userId,
        source: 'event_with_photo',
        amount: 25,
        contentId: eventId,
        contentType: 'event',
        metadata: { hasPhoto: true },
      });
    }
  } catch (error) {
    console.error('GamificationHelper.addXPForEvent error:', error);
  }
}

/**
 * Добавить XP за одобрение модерацией
 */
export async function addXPForApproval(contentId: string, options: {
  contentType: 'post' | 'marker' | 'event';
  quality?: 'low' | 'medium' | 'high' | 'perfect';
  userId?: string;
}): Promise<void> {
  try {
    const userId = options.userId;
    if (!userId) {
      console.warn('GamificationHelper: userId не указан, пропускаем начисление XP');
      return;
    }

    await gamificationFacade.addXP({
      userId,
      source: 'content_approved',
      amount: 20,
      contentId,
      contentType: options.contentType,
      metadata: {
        quality: options.quality || 'medium',
      },
    });
  } catch (error) {
    console.error('GamificationHelper.addXPForApproval error:', error);
    // Не прерываем выполнение, если геймификация не работает
  }
}

/**
 * Добавить XP за записанный GPS-трек
 */
export async function addXPForTrack(trackId: string, options: {
  distance?: number; // meters
  isTracked?: boolean;
  userId?: string;
}): Promise<void> {
  try {
    const userId = options.userId;
    if (!userId) return;

    // Базовый XP за трек
    await gamificationFacade.addXP({
      userId,
      source: 'gps_track_recorded',
      amount: 40,
      contentId: trackId,
      contentType: 'route',
      metadata: { distance: options.distance, isTracked: options.isTracked },
    });

    // Бонус за длинный трек (>5 km)
    if ((options.distance || 0) >= 5000) {
      await gamificationFacade.addXP({
        userId,
        source: 'gps_track_long',
        amount: 20,
        contentId: trackId,
        contentType: 'route',
        metadata: { distance: options.distance },
      });
    }
  } catch (error) {
    console.error('GamificationHelper.addXPForTrack error:', error);
  }
}

/**
 * Добавить XP за экспорт трека
 */
export async function addXPForTrackExport(trackId: string, options: { userId?: string; format?: 'gpx' | 'kml' | 'geojson' }): Promise<void> {
  try {
    const userId = options.userId;
    if (!userId) return;
    await gamificationFacade.addXP({
      userId,
      source: 'gps_track_exported',
      amount: 10,
      contentId: trackId,
      contentType: 'route',
      metadata: { format: options.format as 'gpx' | 'kml' | 'geojson' | undefined },
    });
  } catch (error) {
    console.error('GamificationHelper.addXPForTrackExport error:', error);
  }
}

