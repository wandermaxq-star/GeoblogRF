// backend/src/services/tilePackService.js
// Асинхронный pipeline генерации тайлового пака после одобрения заявки
import { fileURLToPath } from 'url';
import path from 'path';

let pool;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const { pathToFileURL } = await import('url');
  const dbPath = path.join(__dirname, '..', '..', 'db.js');
  const poolModule = await import(pathToFileURL(dbPath).href);
  pool = poolModule.default || poolModule;
} catch (e) {
  console.warn('[tilePackService] could not import db.js:', e.message);
}

/**
 * Ставит пак в очередь генерации тайлов.
 * Вызывается асинхронно после одобрения модератором.
 */
export async function enqueueTilePack(packId) {
  if (!pool) {
    console.warn('[tilePackService] db not available, skipping tile generation for', packId);
    return;
  }

  try {
    // Загружаем данные пака
    const result = await pool.query(
      `SELECT id, polyline, waypoints, distance_meters FROM route_pack_submissions WHERE id = $1`,
      [packId]
    );
    if (result.rows.length === 0) {
      console.warn('[tilePackService] Pack not found:', packId);
      return;
    }

    console.log(`[tilePackService] Queuing tile generation for pack ${packId}...`);

    // TODO: здесь будет вызов реального генератора тайлов (generate-route-pack-tiles.cjs)
    // Сейчас — заглушка с задержкой 0, помечаем пак как "в обработке"
    // В будущем: spawn child_process или вызов tile generation API

    // Имитируем успешную генерацию (убрать когда будет реальный пайплайн)
    await pool.query(
      `UPDATE route_pack_submissions
       SET tile_pack_ready = TRUE,
           tile_pack_size_mb = $2,
           tile_pack_url = $3
       WHERE id = $1`,
      [
        packId,
        // Оценочный размер на основании дистанции
        Math.round((result.rows[0].distance_meters || 100000) / 10000 * 10) / 10 || 50,
        `/api/tiles/packs/${packId}/download`,
      ]
    );

    console.log(`[tilePackService] Tile pack marked ready for ${packId}`);
  } catch (err) {
    console.error('[tilePackService] Error processing pack:', packId, err.message);
  }
}
