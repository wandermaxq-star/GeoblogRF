"""
Генератор тестовых растровых тайлов (PNG) для проверки tile server.
Создаёт MBTiles файл с цветными тайлами для Владимирской области.
"""
import sqlite3
import io
import math
from PIL import Image, ImageDraw

# Путь к выходному файлу (определяется относительно расположения скрипта)
import os
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-raster.mbtiles")

# Параметры: Владимирская область
BOUNDS = (39.0, 55.5, 42.5, 57.0)  # west, south, east, north
CENTER = (40.4, 56.13, 10)          # lon, lat, zoom
MIN_ZOOM = 7
MAX_ZOOM = 12
NAME = "test-raster"

def lon2tile(lon, z):
    return int((lon + 180.0) / 360.0 * (1 << z))

def lat2tile(lat, z):
    lat_rad = math.radians(lat)
    return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * (1 << z))

def generate():
    db = sqlite3.connect(OUTPUT)
    db.execute('CREATE TABLE IF NOT EXISTS metadata (name TEXT, value TEXT)')
    db.execute('CREATE TABLE IF NOT EXISTS tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles (zoom_level, tile_column, tile_row)')
    
    # Метаданные
    meta = {
        'format': 'png',
        'bounds': ','.join(str(b) for b in BOUNDS),
        'center': ','.join(str(c) for c in CENTER),
        'minzoom': str(MIN_ZOOM),
        'maxzoom': str(MAX_ZOOM),
        'name': NAME,
        'description': 'Тестовые растровые тайлы для Владимирской области',
        'type': 'baselayer',
        'version': '1',
    }
    for k, v in meta.items():
        db.execute('INSERT OR REPLACE INTO metadata VALUES (?, ?)', (k, v))
    
    total = 0
    west, south, east, north = BOUNDS
    
    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        x_min = lon2tile(west, z)
        x_max = lon2tile(east, z)
        y_min = lat2tile(north, z)  # north = smaller y
        y_max = lat2tile(south, z)  # south = larger y
        
        tiles_in_zoom = (x_max - x_min + 1) * (y_max - y_min + 1)
        print(f"  Zoom {z}: {tiles_in_zoom} тайлов ({x_min}-{x_max} x {y_min}-{y_max})")
        
        for x in range(x_min, x_max + 1):
            for y in range(y_min, y_max + 1):
                # Создаём тайл: полупрозрачная синяя подложка с сеткой
                # Градация цвета по позиции
                r_val = int(30 + (x - x_min) / max(1, x_max - x_min) * 40)
                g_val = int(80 + (y - y_min) / max(1, y_max - y_min) * 60)
                b_val = int(180 + z * 5)
                
                img = Image.new('RGBA', (256, 256), (r_val, g_val, min(b_val, 255), 180))
                draw = ImageDraw.Draw(img)
                
                # Рамка тайла
                draw.rectangle([0, 0, 255, 255], outline=(255, 255, 255, 80), width=1)
                
                # Сетка 64x64
                for gx in range(0, 256, 64):
                    draw.line([(gx, 0), (gx, 255)], fill=(255, 255, 255, 30), width=1)
                for gy in range(0, 256, 64):
                    draw.line([(0, gy), (255, gy)], fill=(255, 255, 255, 30), width=1)
                
                # Координаты тайла
                draw.text((8, 8), f"z={z}", fill=(255, 255, 255, 220))
                draw.text((8, 24), f"x={x}", fill=(255, 255, 255, 220))
                draw.text((8, 40), f"y={y}", fill=(255, 255, 255, 220))
                
                # Сохраняем в PNG
                buf = io.BytesIO()
                img.save(buf, 'PNG', optimize=True)
                
                # TMS: y инвертирован
                tms_y = (1 << z) - 1 - y
                db.execute('INSERT OR REPLACE INTO tiles VALUES (?, ?, ?, ?)',
                          (z, x, tms_y, buf.getvalue()))
                total += 1
    
    db.commit()
    db.close()
    
    print(f"\n✅ Создано {total} тайлов → {OUTPUT}")
    print(f"   Формат: PNG")
    print(f"   Bounds: {BOUNDS}")
    print(f"   Zoom: {MIN_ZOOM}-{MAX_ZOOM}")

if __name__ == '__main__':
    generate()
