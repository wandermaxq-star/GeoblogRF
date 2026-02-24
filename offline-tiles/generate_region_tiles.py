"""
Генератор растровых тайлов (PNG) с нарезкой строго по полигону границы региона.
Скачивает тайлы из tileserver-gl только для тех ячеек сетки,
которые пересекаются с контуром субъекта РФ (или города-столицы).

Требования:
    pip install requests shapely tqdm

Использование:
    python generate_region_tiles.py --region boundaries/vladimir_oblast.geojson \
        --output vladimir_oblast.mbtiles --min-zoom 4 --max-zoom 12 \
        --name "Владимирская область" --threads 20

    python generate_region_tiles.py --region boundaries/vladimir_city.geojson \
        --output vladimir_city.mbtiles --min-zoom 8 --max-zoom 16 \
        --name "г. Владимир" --threads 20

    # Буферная зона (в км) — захватить чуть больше контура:
    python generate_region_tiles.py --region boundaries/vladimir_oblast.geojson \
        --output vladimir_oblast.mbtiles --buffer 3 ...
"""

import os
import sys
import math
import time
import json
import sqlite3
import logging
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    print("❌ Установите requests: pip install requests")
    sys.exit(1)

try:
    from shapely.geometry import shape, box, mapping
    from shapely.ops import unary_union
    from shapely import __version__ as shapely_version
except ImportError:
    print("❌ Установите shapely: pip install shapely")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:
    # Fallback: простой прогресс без tqdm
    tqdm = None

# ─────────────────────────────────────────────────────────
# Настройки по умолчанию
# ─────────────────────────────────────────────────────────
TILESERVER_URL = os.environ.get("TILESERVER_URL", "http://localhost:8080")
STYLE = os.environ.get("TILE_STYLE", "basic-preview")
THREADS = 20
BUFFER_KM = 2  # буферная зона по умолчанию (км)
TIMEOUT = 15
MAX_RETRIES = 3

LOGFILE = "generate_tiles.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[
        logging.FileHandler(LOGFILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# Геометрические утилиты
# ─────────────────────────────────────────────────────────

def km_to_degrees(km: float, latitude: float = 55.0) -> float:
    """Приблизительная конвертация км → градусы (буферная зона).
    На широте 55° 1° ≈ 63 км по долготе и ≈ 111 км по широте.
    Берём минимум (долготный) для гарантированного охвата."""
    return km / (111.32 * math.cos(math.radians(latitude)))


def load_region_polygon(geojson_path: str, buffer_km: float = 0):
    """Загружает полигон региона из GeoJSON файла.
    Поддерживает Feature, FeatureCollection, и голую Geometry."""
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Извлекаем геометрию
    if data.get("type") == "FeatureCollection":
        geometries = [shape(feat["geometry"]) for feat in data["features"] if feat.get("geometry")]
        polygon = unary_union(geometries)
    elif data.get("type") == "Feature":
        polygon = shape(data["geometry"])
    else:
        polygon = shape(data)

    if not polygon.is_valid:
        polygon = polygon.buffer(0)  # fix self-intersections

    # Добавляем буферную зону
    if buffer_km > 0:
        centroid = polygon.centroid
        buf_deg = km_to_degrees(buffer_km, centroid.y)
        polygon = polygon.buffer(buf_deg)
        log.info(f"Буферная зона: +{buffer_km} км (~{buf_deg:.4f}°)")

    log.info(f"Полигон загружен: {geojson_path}")
    log.info(f"  Bounds: {polygon.bounds}")
    log.info(f"  Area: {polygon.area:.4f} кв.°")

    return polygon


def tile_bbox(z: int, x: int, y: int):
    """Возвращает bbox тайла (slippy map) как Shapely box [west, south, east, north]."""
    n = 2 ** z
    lon_min = x / n * 360.0 - 180.0
    lon_max = (x + 1) / n * 360.0 - 180.0
    lat_max = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * y / n))))
    lat_min = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * (y + 1) / n))))
    return box(lon_min, lat_min, lon_max, lat_max)


def lon2tile(lon: float, z: int) -> int:
    return int((lon + 180.0) / 360.0 * (1 << z))


def lat2tile(lat: float, z: int) -> int:
    lat_rad = math.radians(lat)
    return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * (1 << z))


def enumerate_tiles(polygon, min_zoom: int, max_zoom: int):
    """Перечисляет все тайлы, пересекающиеся с полигоном региона."""
    west, south, east, north = polygon.bounds
    tasks = []

    # Подготавливаем simplified-версию полигона для ускорения проверки на низких зумах
    # (на высоких зумах используем точный полигон)
    prepared_simple = polygon.simplify(0.01, preserve_topology=True)

    for z in range(min_zoom, max_zoom + 1):
        x_min = max(0, lon2tile(west, z))
        x_max = min((1 << z) - 1, lon2tile(east, z))
        y_min = max(0, lat2tile(north, z))
        y_max = min((1 << z) - 1, lat2tile(south, z))

        # На низких зумах (< 10) используем упрощённый полигон для скорости
        check_poly = prepared_simple if z < 10 else polygon

        count = 0
        for x in range(x_min, x_max + 1):
            for y in range(y_min, y_max + 1):
                tb = tile_bbox(z, x, y)
                if check_poly.intersects(tb):
                    tasks.append((z, x, y))
                    count += 1

        total_rect = (x_max - x_min + 1) * (y_max - y_min + 1)
        log.info(f"  Zoom {z}: {count}/{total_rect} тайлов (экономия {100 - count*100//max(1,total_rect)}%)")

    return tasks


# ─────────────────────────────────────────────────────────
# HTTP / Загрузка тайлов
# ─────────────────────────────────────────────────────────

def create_session():
    session = requests.Session()
    retries = Retry(
        total=MAX_RETRIES, backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session.mount("http://", HTTPAdapter(max_retries=retries))
    session.mount("https://", HTTPAdapter(max_retries=retries))
    return session


def wait_for_tileserver(session, url: str, timeout: int = 60):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = session.get(f"{url}/styles.json", timeout=5)
            if r.status_code == 200:
                styles = r.json()
                log.info(f"Tileserver доступен. Стили: {list(styles.keys()) if isinstance(styles, dict) else '...'}")
                return True
        except Exception:
            time.sleep(2)
    return False


def download_tile_to_bytes(session, tileserver: str, style: str, z: int, x: int, y: int):
    """Скачивает один тайл, возвращает (status, z, x, y, bytes|None)."""
    url = f"{tileserver}/styles/{style}/{z}/{x}/{y}.png"
    try:
        resp = session.get(url, timeout=TIMEOUT)
        if resp.status_code == 404:
            return ("MISSING", z, x, y, None)
        resp.raise_for_status()
        return ("OK", z, x, y, resp.content)
    except Exception as e:
        return ("ERR", z, x, y, str(e))


# ─────────────────────────────────────────────────────────
# MBTiles упаковка
# ─────────────────────────────────────────────────────────

def create_mbtiles(output_path: str, name: str, polygon, min_zoom: int, max_zoom: int):
    """Создаёт пустой MBTiles с заполненными метаданными."""
    if os.path.exists(output_path):
        os.remove(output_path)

    db = sqlite3.connect(output_path)
    db.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
    db.execute("""CREATE TABLE tiles (
        zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER,
        tile_data BLOB
    )""")
    db.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")

    west, south, east, north = polygon.bounds
    centroid = polygon.centroid
    center_zoom = (min_zoom + max_zoom) // 2

    meta = {
        "format": "png",
        "name": name,
        "description": f"Растровые тайлы: {name}",
        "bounds": f"{west:.6f},{south:.6f},{east:.6f},{north:.6f}",
        "center": f"{centroid.x:.6f},{centroid.y:.6f},{center_zoom}",
        "minzoom": str(min_zoom),
        "maxzoom": str(max_zoom),
        "type": "baselayer",
        "version": "1",
        "clip_type": "polygon",  # маркер: нарезано по полигону
    }
    for k, v in meta.items():
        db.execute("INSERT INTO metadata VALUES (?, ?)", (k, v))

    db.commit()
    return db


def insert_tile(db, z: int, x: int, y: int, data: bytes):
    """Вставляет тайл в MBTiles (y конвертируется в TMS)."""
    tms_y = (1 << z) - 1 - y
    db.execute(
        "INSERT OR REPLACE INTO tiles VALUES (?, ?, ?, ?)",
        (z, x, tms_y, data),
    )


# ─────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Генерация растровых тайлов по полигону региона")
    p.add_argument("--region", required=True, help="GeoJSON файл с контуром региона")
    p.add_argument("--output", required=True, help="Выходной .mbtiles файл")
    p.add_argument("--name", default="Region", help="Название региона для метаданных")
    p.add_argument("--min-zoom", type=int, default=4, help="Минимальный zoom (по умолчанию 4)")
    p.add_argument("--max-zoom", type=int, default=12, help="Максимальный zoom (по умолчанию 12)")
    p.add_argument("--buffer", type=float, default=BUFFER_KM, help=f"Буферная зона в км (по умолчанию {BUFFER_KM})")
    p.add_argument("--threads", type=int, default=THREADS, help=f"Потоков загрузки (по умолчанию {THREADS})")
    p.add_argument("--tileserver", default=TILESERVER_URL, help="URL tileserver-gl")
    p.add_argument("--style", default=STYLE, help="Имя стиля tileserver-gl")
    p.add_argument("--batch-size", type=int, default=500, help="Размер пакета для commit")
    return p.parse_args()


def main():
    args = parse_args()

    log.info("=" * 60)
    log.info(f"Генерация тайлов: {args.name}")
    log.info(f"  Регион: {args.region}")
    log.info(f"  Выход:  {args.output}")
    log.info(f"  Zoom:   {args.min_zoom}–{args.max_zoom}")
    log.info(f"  Буфер:  {args.buffer} км")
    log.info(f"  Потоки: {args.threads}")
    log.info("=" * 60)

    # 1. Загружаем полигон
    polygon = load_region_polygon(args.region, buffer_km=args.buffer)

    # 2. Перечисляем тайлы, попадающие в полигон
    log.info("Подсчёт тайлов в полигоне...")
    tasks = enumerate_tiles(polygon, args.min_zoom, args.max_zoom)
    log.info(f"Всего тайлов для загрузки: {len(tasks)}")

    if not tasks:
        log.error("Нет тайлов для загрузки. Проверьте GeoJSON и zoom-уровни.")
        sys.exit(1)

    # 3. Проверяем tileserver
    session = create_session()
    if not wait_for_tileserver(session, args.tileserver):
        log.error(f"Tileserver {args.tileserver} недоступен!")
        sys.exit(2)

    # 4. Создаём MBTiles
    db = create_mbtiles(args.output, args.name, polygon, args.min_zoom, args.max_zoom)

    # 5. Загружаем тайлы параллельно
    stats = {"OK": 0, "MISSING": 0, "ERR": 0, "SKIP": 0}
    batch_count = 0
    start_time = time.time()

    def process_batch():
        nonlocal batch_count
        db.commit()
        batch_count = 0

    iterator_fn = tqdm if tqdm else lambda x, **kw: x

    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        futures = {
            executor.submit(
                download_tile_to_bytes, session, args.tileserver, args.style, z, x, y
            ): (z, x, y)
            for z, x, y in tasks
        }

        for i, future in enumerate(
            iterator_fn(as_completed(futures), total=len(tasks), desc="tiles", unit="tile"), 1
        ):
            result = future.result()
            status = result[0]
            stats[status] = stats.get(status, 0) + 1

            if status == "OK" and result[4]:
                z, x, y = result[1], result[2], result[3]
                insert_tile(db, z, x, y, result[4])
                batch_count += 1

                if batch_count >= args.batch_size:
                    process_batch()

            if i % 500 == 0 or i == len(tasks):
                elapsed = time.time() - start_time
                rate = i / elapsed if elapsed > 0 else 0
                log.info(
                    f"Прогресс: {i}/{len(tasks)} ({rate:.0f} тайлов/сек) — "
                    f"OK:{stats['OK']} MISS:{stats['MISSING']} ERR:{stats['ERR']}"
                )

    # Финальный commit
    db.commit()

    # 6. Итоги
    elapsed = time.time() - start_time
    final_size = os.path.getsize(args.output) / (1024 * 1024)

    log.info("=" * 60)
    log.info(f"✅ Готово: {args.output}")
    log.info(f"   Размер: {final_size:.1f} МБ")
    log.info(f"   Тайлов: OK={stats['OK']}, MISSING={stats['MISSING']}, ERR={stats['ERR']}")
    log.info(f"   Время: {elapsed:.0f} сек ({elapsed/60:.1f} мин)")
    log.info("=" * 60)

    db.close()

    if stats["ERR"] > 0:
        log.warning(f"⚠️  {stats['ERR']} тайлов с ошибками. Перезапустите для повторной загрузки.")


if __name__ == "__main__":
    main()
