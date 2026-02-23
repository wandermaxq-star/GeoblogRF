import express from 'express';
// SONAR-AUTO-FIX (javascript:S1128): original: // SONAR-AUTO-FIX (javascript:S1128): original: import pool from '../database/config.js';
import fetch from 'node-fetch';

const router = express.Router();

// Функция для нормализации ответа от Nominatim
function normalizeNominatimReverse(json, lat, lng) {
  if (!json || !json.display_name) {
    return null;
  }

  return {
    name: json.name || json.display_name.split(',')[0],
    address: json.display_name,
    type: json.type || 'place',
    category: json.category || 'other',
    source: 'osm',
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
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1&accept-language=ru`;
    
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
          name: data.display_name.split(',')[0] || `Место (${lat}, ${lng})`,
          address: data.display_name,
          type: data.type || 'place',
          category: 'other',
          source: 'osm',
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
      .map(element => ({
        name: element.tags.name,
        address: element.tags['addr:street'] ? 
          `${element.tags['addr:street']}, ${element.tags['addr:housenumber'] || ''}`.trim() : 
          'Адрес не указан',
        type: element.tags.amenity || element.tags.shop || element.tags.tourism || element.tags.historic || element.tags.leisure || element.tags.natural || 'place',
        category: element.tags.amenity || element.tags.shop || element.tags.tourism || element.tags.historic || element.tags.leisure || element.tags.natural || 'other',
        source: 'osm',
        coordinates: { latitude: element.lat, longitude: element.lon }
      }))
      .slice(0, 10); // Ограничиваем 10 результатами
    
    const payload = { places, totalFound: places.length };
    res.json(payload);
    
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при поиске ближайших мест' });
  }
});

export default router;


