import apiClient from '../api/apiClient';

// Типы для обнаруженных мест
export interface DiscoveredPlace {
  id?: string;
  name: string;
  address: string;
  type: string;
  category: string;
  source: 'yandex' | 'osm' | 'foursquare' | 'google';
  confidence: number; // 0-1, насколько уверены в результате
  coordinates: {
    latitude: number;
    longitude: number;
  };
  metadata?: {
    phone?: string;
    website?: string;
    openingHours?: string;
    rating?: number;
    distanceMeters?: number;
  };
}

// Интерфейс для результатов поиска
export interface PlaceSearchResult {
  places: DiscoveredPlace[];
  bestMatch?: DiscoveredPlace;
  totalFound: number;
}

// Кэш для результатов поиска (5 минут)
interface CacheEntry {
  data: PlaceSearchResult;
  timestamp: number;
}

class PlaceDiscoveryService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут

  private normalizeLabel(value: string | undefined | null): string {
    return String(value || '').trim();
  }

  private getPrimaryAddressPart(address: string | undefined | null): string {
    return this.normalizeLabel(address).split(',').map((part) => part.trim()).find(Boolean) || '';
  }

  private isGenericName(name: string | undefined | null): boolean {
    const normalized = this.normalizeLabel(name).toLowerCase();
    if (!normalized) {
      return true;
    }

    if (/^место\s*\(/i.test(normalized) || /^координаты:/i.test(normalized)) {
      return true;
    }

    if (/^\d+[a-zа-яё\-\/]*$/i.test(normalized)) {
      return true;
    }

    return /(улица|ул\.?|проспект|пр-?т|переулок|пер\.?|проезд|шоссе|набережная|бульвар|площадь|дорога|дом|корпус|строение|микрорайон)/i.test(normalized);
  }

  private hasStrongObjectName(place: DiscoveredPlace | undefined | null): boolean {
    if (!place) {
      return false;
    }

    const name = this.normalizeLabel(place.name);
    if (!name || this.isGenericName(name)) {
      return false;
    }

    const firstAddressPart = this.getPrimaryAddressPart(place.address);
    return !firstAddressPart || name.toLowerCase() !== firstAddressPart.toLowerCase();
  }

  private scorePlace(place: DiscoveredPlace, latitude: number, longitude: number): number {
    let score = place.confidence || 0;

    if (this.hasStrongObjectName(place)) {
      score += 2;
    } else if (this.normalizeLabel(place.name)) {
      score += 0.25;
    }

    if (place.source === 'osm') {
      score += 0.2;
    }

    const distance = this.calculateDistanceMeters(
      latitude,
      longitude,
      place.coordinates.latitude,
      place.coordinates.longitude
    );

    if (distance <= 50) {
      score += 0.8;
    } else if (distance <= 150) {
      score += 0.4;
    } else if (distance > 500) {
      score -= 0.35;
    }

    return score;
  }

  private deduplicatePlaces(places: DiscoveredPlace[]): DiscoveredPlace[] {
    const uniquePlaces = new Map<string, DiscoveredPlace>();

    for (const place of places) {
      const name = this.normalizeLabel(place.name).toLowerCase();
      const lat = Math.round(place.coordinates.latitude * 10000) / 10000;
      const lng = Math.round(place.coordinates.longitude * 10000) / 10000;
      const key = `${name}:${lat}:${lng}`;
      const existing = uniquePlaces.get(key);

      if (!existing || (place.confidence || 0) > (existing.confidence || 0)) {
        uniquePlaces.set(key, place);
      }
    }

    return Array.from(uniquePlaces.values());
  }

  private pickBestMatch(places: DiscoveredPlace[], latitude: number, longitude: number): DiscoveredPlace | undefined {
    return [...places]
      .sort((left, right) => this.scorePlace(right, latitude, longitude) - this.scorePlace(left, latitude, longitude))[0];
  }

  private calculateDistanceMeters(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const earthRadiusMeters = 6371000;
    const dLatitude = toRadians(latitude2 - latitude1);
    const dLongitude = toRadians(longitude2 - longitude1);
    const a =
      Math.sin(dLatitude / 2) * Math.sin(dLatitude / 2) +
      Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) *
      Math.sin(dLongitude / 2) * Math.sin(dLongitude / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  /**
   * Валидация координат
   */
  private validateCoordinates(latitude: number, longitude: number): boolean {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return false;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return false;
    }
    if (isNaN(latitude) || isNaN(longitude)) {
      return false;
    }
    return true;
  }

  /**
   * Генерация ключа кэша
   */
  private getCacheKey(latitude: number, longitude: number, type: string): string {
    // Округляем координаты до 4 знаков для группировки близких точек
    const lat = Math.round(latitude * 10000) / 10000;
    const lng = Math.round(longitude * 10000) / 10000;
    return `${type}:${lat}:${lng}`;
  }

  /**
   * Получение данных из кэша
   */
  private getFromCache(key: string): PlaceSearchResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Сохранение данных в кэш
   */
  private setCache(key: string, data: PlaceSearchResult): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Очистка старых записей (если кэш больше 100 записей)
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.CACHE_TTL) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Основной метод для обнаружения места по координатам
   */
  async discoverPlace(latitude: number, longitude: number): Promise<PlaceSearchResult> {
    try {
      // Валидация координат
      if (!this.validateCoordinates(latitude, longitude)) {
        return { places: [], totalFound: 0 };
      }

      // Проверяем кэш
      const cacheKey = this.getCacheKey(latitude, longitude, 'discover');
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Сначала делаем reverse (Nominatim) через наш API - это более надежно
      const reverse = await this.searchLocalPlaces(latitude, longitude);
      const nearby = await this.searchExternalPlaces(latitude, longitude);
      const combinedPlaces = this.deduplicatePlaces([
        ...reverse.places,
        ...nearby.places,
      ]);

      const bestMatch = this.pickBestMatch(combinedPlaces, latitude, longitude);
      if (combinedPlaces.length > 0 && bestMatch) {
        const result = {
          places: combinedPlaces,
          bestMatch,
          totalFound: combinedPlaces.length,
        };
        this.setCache(cacheKey, result);
        return result;
      }

      // Если ничего не найдено
      this.setCache(cacheKey, { places: [], totalFound: 0 });
      return { places: [], totalFound: 0 };
    } catch (error) {
      return {
        places: [],
        totalFound: 0
      };
    }
  }

  /**
   * Поиск мест в нашей базе данных
   */
  private async searchLocalPlaces(latitude: number, longitude: number): Promise<PlaceSearchResult> {
    try {
      // Проверяем кэш для reverse
      const cacheKey = this.getCacheKey(latitude, longitude, 'reverse');
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // reverse lookup
      const response = await apiClient.get(`/places/reverse`, {
        params: {
          lat: latitude,
          lng: longitude,
        }
      });
      
      const result = response.data || { places: [], totalFound: 0 };
      if (!result.bestMatch && Array.isArray(result.places) && result.places.length > 0) {
        result.bestMatch = result.places[0];
      }
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      return { places: [], totalFound: 0 };
    }
  }

  /**
   * Поиск через внешние API (пока заглушка)
   */
  private async searchExternalPlaces(latitude: number, longitude: number): Promise<PlaceSearchResult> {
    try {
      // Проверяем кэш для nearby
      const cacheKey = this.getCacheKey(latitude, longitude, 'nearby');
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await apiClient.get(`/places/nearby`, {
        params: { lat: latitude, lng: longitude, radius: 120 }
      });
      
      const result = response.data || { places: [], totalFound: 0 };
      if (!result.bestMatch && Array.isArray(result.places) && result.places.length > 0) {
        result.bestMatch = this.pickBestMatch(result.places, latitude, longitude) || result.places[0];
      }
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      return { places: [], totalFound: 0 };
    }
  }

  /**
   * Получение детальной информации о месте
   */
  async getPlaceDetails(placeId: string, source: string): Promise<DiscoveredPlace | null> {
    try {
      if (source === 'local') {
        const response = await apiClient.get(`/places/${placeId}`);
        return response.data;
      }
      
      // TODO: Реализовать для внешних источников
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Проверка, существует ли уже метка для этого места
   */
  async checkExistingMarker(latitude: number, longitude: number): Promise<boolean> {
    try {
      // Валидация координат
      if (!this.validateCoordinates(latitude, longitude)) {
        return false;
      }

      const response = await apiClient.get('/markers/nearby', {
        params: {
          lat: latitude,
          lng: longitude,
          radius: 50 // метров
        }
      });

      return response.data && response.data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Очистка кэша
   */
  clearCache(): void {
    this.cache.clear();
    }

  /**
   * Принудительное обновление места (игнорируя кэш)
   */
  async forceRefreshPlace(latitude: number, longitude: number): Promise<PlaceSearchResult> {
    // Очищаем кэш для этих координат
    const cacheKey = this.getCacheKey(latitude, longitude, 'discover');
    this.cache.delete(cacheKey);
    
    // Заново ищем место
    return this.discoverPlace(latitude, longitude);
  }
}

export const placeDiscoveryService = new PlaceDiscoveryService();
export default placeDiscoveryService;
