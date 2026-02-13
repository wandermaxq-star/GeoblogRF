/**
 * Tile Server — раздача тайлов из MBTiles (SQLite) файлов.
 *
 * MBTiles — стандартный формат хранения тайлов карт в SQLite-базе.
 * Структура: таблица `tiles` с полями `zoom_level`, `tile_column`, `tile_row`, `tile_data`.
 *
 * Эндпоинты:
 *   GET /api/tiles                     — список доступных тайлсетов
 *   GET /api/tiles/:tileset/:z/:x/:y   — получить конкретный тайл (PNG)
 *   GET /api/tiles/:tileset/metadata   — метаданные тайлсета (bounds, center, zoom range)
 */

import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке с MBTiles — относительно корня проекта (backend/../offline-tiles)
const TILES_DIR = path.resolve(__dirname, '..', '..', '..', 'offline-tiles');

// Кэш открытых SQLite соединений (по имени тайлсета)
const dbCache = new Map();

/**
 * Открывает MBTiles файл и кэширует соединение.
 * @param {string} tileset — имя тайлсета (без .mbtiles)
 * @returns {import('better-sqlite3').Database | null}
 */
function getDB(tileset) {
  if (dbCache.has(tileset)) {
    return dbCache.get(tileset);
  }

  const filePath = path.join(TILES_DIR, `${tileset}.mbtiles`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    // Подготавливаем запрос для быстрого получения тайлов
    db._tileStmt = db.prepare(
      'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
    );
    // Кэшируем метаданные
    try {
      const metaRows = db.prepare('SELECT name, value FROM metadata').all();
      db._metadata = {};
      for (const row of metaRows) {
        db._metadata[row.name] = row.value;
      }
    } catch (e) {
      db._metadata = {};
    }
    dbCache.set(tileset, db);
    return db;
  } catch (err) {
    console.error(`[TileServer] Ошибка открытия ${filePath}:`, err.message);
    return null;
  }
}

// ============================================================
// GET /api/tiles — список доступных тайлсетов
// ============================================================
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(TILES_DIR)) {
      return res.json({ tilesets: [] });
    }

    const files = fs.readdirSync(TILES_DIR).filter(f => f.endsWith('.mbtiles'));
    const tilesets = files.map(f => {
      const name = f.replace('.mbtiles', '');
      const db = getDB(name);
      const meta = db?._metadata || {};
      const stats = fs.statSync(path.join(TILES_DIR, f));

      return {
        name,
        filename: f,
        sizeBytes: stats.size,
        sizeMB: +(stats.size / (1024 * 1024)).toFixed(2),
        format: meta.format || 'png',
        bounds: meta.bounds || null,
        center: meta.center || null,
        minzoom: meta.minzoom ? +meta.minzoom : null,
        maxzoom: meta.maxzoom ? +meta.maxzoom : null,
        description: meta.description || null,
      };
    });

    res.json({ tilesets });
  } catch (err) {
    console.error('[TileServer] Ошибка списка тайлсетов:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/tiles/:tileset/metadata — метаданные конкретного тайлсета
// ============================================================
router.get('/:tileset/metadata', (req, res) => {
  const { tileset } = req.params;
  const db = getDB(tileset);

  if (!db) {
    return res.status(404).json({ error: `Тайлсет '${tileset}' не найден` });
  }

  const meta = db._metadata || {};

  // Парсим bounds и center в числа
  let bounds = null;
  if (meta.bounds) {
    bounds = meta.bounds.split(',').map(Number);
  }

  let center = null;
  if (meta.center) {
    center = meta.center.split(',').map(Number);
  }

  res.json({
    name: tileset,
    format: meta.format || 'png',
    bounds,
    center,
    minzoom: meta.minzoom ? +meta.minzoom : null,
    maxzoom: meta.maxzoom ? +meta.maxzoom : null,
    description: meta.description || null,
    attribution: meta.attribution || null,
    type: meta.type || null,
    version: meta.version || null,
  });
});

// ============================================================
// GET /api/tiles/:tileset/:z/:x/:y — получить тайл
// ============================================================
router.get('/:tileset/:z/:x/:y', (req, res) => {
  const { tileset } = req.params;
  const z = parseInt(req.params.z, 10);
  const x = parseInt(req.params.x, 10);
  // Убираем расширение (.png, .jpg, .pbf) из y если есть
  const yRaw = req.params.y.replace(/\.\w+$/, '');
  const y = parseInt(yRaw, 10);

  if (isNaN(z) || isNaN(x) || isNaN(y)) {
    return res.status(400).json({ error: 'Некорректные координаты тайла' });
  }

  const db = getDB(tileset);
  if (!db) {
    return res.status(404).json({ error: `Тайлсет '${tileset}' не найден` });
  }

  // MBTiles использует TMS-координаты: y инвертирован относительно XYZ (slippy map)
  const tmsY = (1 << z) - 1 - y;

  try {
    const row = db._tileStmt.get(z, x, tmsY);

    if (!row || !row.tile_data) {
      // Тайл отсутствует — возвращаем прозрачный PNG 1x1
      res.writeHead(204);
      return res.end();
    }

    // Определяем формат по метаданным или по сигнатуре данных
    const format = db._metadata?.format || 'png';
    let contentType = 'image/png';
    if (format === 'jpg' || format === 'jpeg') contentType = 'image/jpeg';
    else if (format === 'webp') contentType = 'image/webp';
    else if (format === 'pbf') contentType = 'application/x-protobuf';

    // Агрессивное кеширование — тайлы не меняются
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(row.tile_data);
  } catch (err) {
    console.error(`[TileServer] Ошибка чтения тайла ${tileset}/${z}/${x}/${y}:`, err.message);
    res.status(500).json({ error: 'Ошибка чтения тайла' });
  }
});

// Корректная очистка при завершении процесса
process.on('exit', () => {
  for (const [name, db] of dbCache) {
    try { db.close(); } catch (e) {}
  }
  dbCache.clear();
});

export default router;
