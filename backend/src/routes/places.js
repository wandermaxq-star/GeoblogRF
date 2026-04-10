import express from 'express';
// SONAR-AUTO-FIX (javascript:S1128): original: // SONAR-AUTO-FIX (javascript:S1128): original: import pool from '../database/config.js';
import fetch from 'node-fetch';

const router = express.Router();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function looksLikeAddressLabel(value) {
  if (!value) {
    return true;
  }

  const normalized = String(value).trim().toLowerCase();
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

function pickPreferredOsmName(json) {
  const candidates = [
    json?.namedetails?.name,
    json?.namedetails?.['name:ru'],
    json?.namedetails?.official_name,
    json?.namedetails?.short_name,
    json?.extratags?.brand,
    json?.name,
    json?.address?.attraction,
    json?.address?.tourism,
    json?.address?.amenity,
    json?.address?.building,
    json?.address?.leisure,
    json?.address?.historic,
    json?.address?.shop,
    json?.address?.natural,
  ];

  for (const candidate of candidates) {
    const trimmed = String(candidate || '').trim();
    if (trimmed && !looksLikeAddressLabel(trimmed)) {
      return trimmed;
    }
  }

  const fallbackCandidates = [
    json?.display_name?.split(',')[0],
    json?.address?.road,
    json?.address?.pedestrian,
    json?.address?.neighbourhood,
    json?.address?.suburb,
    json?.address?.village,
    json?.address?.hamlet,
  ];

  for (const candidate of fallbackCandidates) {
    const trimmed = String(candidate || '').trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return '';
}

function buildOsmAddress(json, lat, lng) {
  const displayName = String(json?.display_name || '').trim();
  if (displayName) {
    return displayName;
  }

  const address = json?.address || {};
  const parts = [
    address.road,
    address.house_number,
    address.neighbourhood,
    address.suburb,
    address.city || address.town || address.village,
    address.state,
    address.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : `Координаты: ${lat}, ${lng}`;
}

function computeDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

// Функция для нормализации ответа от Nominatim
function normalizeNominatimReverse(json, lat, lng) {
  if (!json || !json.display_name) {
    return null;
  }

  const name = pickPreferredOsmName(json);
  const address = buildOsmAddress(json, lat, lng);
  const confidence = name && !looksLikeAddressLabel(name) ? 0.94 : 0.55;

  return {
    name: name || address.split(',')[0],
    address,
    type: json.type || 'place',
    category: json.category || 'other',
    source: 'osm',
    confidence,
    coordinates: { latitude: Number(lat), longitude: Number(lng) }
  };
}

// GET /api/places/reverse - обратный геокодинг через Nominatim
router.get('/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  
  if (!lat || !lng) {
    return res.status(400).json({ message: 'lat и lng обязательны' });
  }

  try {
    // Используем fetch для геопоиска через Nominatim
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1&namedetails=1&extratags=1&accept-language=ru`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HorizonExplorer/1.0 (https://github.com/your-repo)'
      },
      signal: AbortSignal.timeout(10000) // 10 секунд таймаут
    });
    
    if (!response.ok) {
      // Fallback - возвращаем базовую информацию
      const place = {
        name: `Место (${lat}, ${lng})`,
        address: `Координаты: ${lat}, ${lng}`,
        type: 'place',
        category: 'other',
        source: 'local',
        confidence: 0.2,
        coordinates: { latitude: Number(lat), longitude: Number(lng) }
      };
      
      const payload = { places: [place], bestMatch: place, totalFound: 1 };
      res.json(payload);
      return;
    }
    
    const data = await response.json();
    
    if (data && data.display_name) {
      // Используем функцию нормализации
      const place = normalizeNominatimReverse(data, lat, lng);
      
      if (place) {
        const payload = { places: [place], bestMatch: place, totalFound: 1 };
        res.json(payload);
      } else {
        // Если нормализация не удалась
        const fallbackPlace = {
          name: pickPreferredOsmName(data) || data.display_name.split(',')[0] || `Место (${lat}, ${lng})`,
          address: buildOsmAddress(data, lat, lng),
          type: data.type || 'place',
          category: 'other',
          source: 'osm',
          confidence: 0.5,
          coordinates: { latitude: Number(lat), longitude: Number(lng) }
        };
        
        const payload = { places: [fallbackPlace], bestMatch: fallbackPlace, totalFound: 1 };
        res.json(payload);
      }
    } else {
      // Если Nominatim не дал результатов
      const place = {
        name: `Место (${lat}, ${lng})`,
        address: `Координаты: ${lat}, ${lng}`,
        type: 'place',
        category: 'other',
        source: 'local',
        confidence: 0.2,
        coordinates: { latitude: Number(lat), longitude: Number(lng) }
      };
      
      const payload = { places: [place], bestMatch: place, totalFound: 1 };
      res.json(payload);
    }
    
  } catch (error) {
    // Fallback при ошибке
    const place = {
      name: `Место (${lat}, ${lng})`,
      address: `Координаты: ${lat}, ${lng}`,
      type: 'place',
      category: 'other',
      source: 'local',
      confidence: 0.2,
      coordinates: { latitude: Number(lat), longitude: Number(lng) }
    };
    
    const payload = { places: [place], bestMatch: place, totalFound: 1 };
    res.json(payload);
  }
});

// GET /api/places/nearby - поиск ближайших мест через Overpass API
router.get('/nearby', async (req, res) => {
  const { lat, lng, radius = 1000 } = req.query;
  
  if (!lat || !lng) {
    return res.status(400).json({ message: 'lat и lng обязательны' });
  }

  try {
    const originLat = toNumber(lat);
    const originLng = toNumber(lng);
    const searchRadius = Math.max(toNumber(radius), 1);

    // Overpass API запрос для поиска POI в радиусе
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"](around:${radius},${lat},${lng});
        node["shop"](around:${radius},${lat},${lng});
        node["tourism"](around:${radius},${lat},${lng});
        node["historic"](around:${radius},${lat},${lng});
        node["leisure"](around:${radius},${lat},${lng});
        node["natural"](around:${radius},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;
    
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: overpassQuery
    });
    
    if (!response.ok) {
      return res.status(502).json({ message: 'Ошибка Overpass API', status: response.status });
    }
    
    const data = await response.json();
    
    // Преобразуем результаты в наш формат
    const places = data.elements
      .filter(element => element.type === 'node' && element.tags && element.tags.name)
      .map(element => {
        const distanceMeters = computeDistanceMeters(originLat, originLng, element.lat, element.lon);
        return {
          name: element.tags.name,
          address: element.tags['addr:street']
            ? `${element.tags['addr:street']}, ${element.tags['addr:housenumber'] || ''}`.trim()
            : 'Адрес не указан',
          type: element.tags.amenity || element.tags.shop || element.tags.tourism || element.tags.historic || element.tags.leisure || element.tags.natural || 'place',
          category: element.tags.amenity || element.tags.shop || element.tags.tourism || element.tags.historic || element.tags.leisure || element.tags.natural || 'other',
          source: 'osm',
          confidence: Math.max(0.35, 0.92 - distanceMeters / Math.max(searchRadius * 2, 1)),
          coordinates: { latitude: element.lat, longitude: element.lon },
          distanceMeters,
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 10); // Ограничиваем 10 результатами
    
    const payload = { places, bestMatch: places[0] || null, totalFound: places.length };
    res.json(payload);
    
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при поиске ближайших мест' });
  }
});

export default router;


