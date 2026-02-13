# Инструкция: перенарезка векторных тайлов (PBF) → растровые (PNG)

## Проблема
Ваши MBTiles файлы содержат **векторные тайлы** (формат PBF/MVT), сгенерированные OpenMapTiles или подобным инструментом.
Для отображения через Leaflet нужны **растровые** тайлы (PNG).

## Решение: tileserver-gl на Ubuntu

### 1. Установка tileserver-gl

```bash
# Через Docker (рекомендуется)
docker pull maptiler/tileserver-gl

# Или через npm (если нет Docker)
npm install -g tileserver-gl
```

### 2. Генерация PNG тайлов из PBF

#### Вариант A: Через Docker + tileserver-gl (рекомендуется)

```bash
# Запуск tileserver-gl с вашим MBTiles
docker run --rm -it \
  -v /path/to/your/tiles:/data \
  -p 8080:8080 \
  maptiler/tileserver-gl \
  --file /data/vla.mbtiles

# После запуска откройте http://localhost:8080 — там будет превью карты
# tileserver-gl автоматически рендерит PNG из PBF
# URL тайлов: http://localhost:8080/styles/basic-preview/{z}/{x}/{y}.png
```

#### Вариант B: Массовая генерация PNG через tileserver-gl + скрипт

```bash
# 1. Запустите tileserver-gl
docker run -d --name tileserver \
  -v /path/to/tiles:/data \
  -p 8080:8080 \
  maptiler/tileserver-gl \
  --file /data/vla.mbtiles

# 2. Скачайте все тайлы в PNG
# Параметры: minzoom=4, maxzoom=12, bounds как в метаданных

python3 << 'EOF'
import os, math, urllib.request

TILESERVER = "http://localhost:8080"
STYLE = "basic-preview"  # стиль по умолчанию tileserver-gl
OUTPUT_DIR = "/path/to/output/vla-png"

# Из метаданных вашего MBTiles:
MIN_ZOOM = 4
MAX_ZOOM = 12
# bounds: west, south, east, north
BOUNDS = (35.045065, 54.270611, 48.982268, 57.90209)

def lon2tile(lon, z):
    return int((lon + 180.0) / 360.0 * (1 << z))

def lat2tile(lat, z):
    lat_rad = math.radians(lat)
    return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * (1 << z))

total = 0
for z in range(MIN_ZOOM, MAX_ZOOM + 1):
    x_min = lon2tile(BOUNDS[0], z)
    x_max = lon2tile(BOUNDS[2], z)
    y_min = lat2tile(BOUNDS[3], z)  # north → меньший y
    y_max = lat2tile(BOUNDS[1], z)  # south → больший y
    
    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            url = f"{TILESERVER}/styles/{STYLE}/{z}/{x}/{y}.png"
            outdir = f"{OUTPUT_DIR}/{z}/{x}"
            outfile = f"{outdir}/{y}.png"
            
            os.makedirs(outdir, exist_ok=True)
            
            try:
                urllib.request.urlretrieve(url, outfile)
                total += 1
                if total % 100 == 0:
                    print(f"  ... скачано {total} тайлов")
            except Exception as e:
                print(f"  SKIP {z}/{x}/{y}: {e}")

print(f"\nГотово! Скачано {total} тайлов в {OUTPUT_DIR}")
EOF

# 3. Упаковка обратно в MBTiles (PNG формат)
# Нужен mb-util:
pip3 install mbutil

# Создаём MBTiles из директории тайлов
mb-util /path/to/output/vla-png /path/to/output/vla-raster.mbtiles --image_format=png --scheme=xyz
```

#### Вариант C: Через OpenMapTiles (если есть исходные данные)

Если у вас есть исходные данные OpenStreetMap (osm.pbf), можно сгенерировать растровые тайлы напрямую:

```bash
# Используем tippecanoe + magnacarto или аналог
# Это более сложный путь, рекомендуется Вариант A или B
```

### 3. Замена файлов

После генерации PNG MBTiles:

```bash
# Замените файлы в проекте
cp vla-raster.mbtiles /path/to/project/offline-tiles/vla.mbtiles
cp vlacity-raster.mbtiles /path/to/project/offline-tiles/vlacity.mbtiles
```

### 4. Проверка

```bash
# Запустите бэкенд
cd backend
SKIP_DB=true node server.js

# Откройте тестовую страницу
# http://localhost:3002/test-tiles.html

# Проверьте метаданные (формат должен быть png)
curl http://localhost:3002/api/tiles/vla/metadata | jq .format
# Ожидаем: "png"
```

## Параметры тайлсетов

### vla (Владимирская область)
- **Bounds**: 35.05, 54.27, 48.98, 57.90
- **Zoom**: 4-12
- **Назначение**: общий обзор региона

### vlacity (город Владимир)
- **Bounds**: 35.05, 55.40, 42.12, 57.90
- **Zoom**: 8-14  
- **Назначение**: детальная карта столицы региона

## Рекомендации по нарезке остальных регионов

При нарезке тайлов для других регионов используйте:

```bash
# Формат: PNG (не PBF!)
# Рекомендуемые zoom-уровни:
#   Область: 4-12 (обзор)
#   Город:   8-16 (детальный)
#
# Размер оценка:
#   Zoom 4-12, один регион: ~100-200 МБ (PNG)
#   Zoom 8-16, один город:  ~50-150 МБ (PNG)
```

## Быстрый тест (без перенарезки)

Если хотите быстро проверить, что tile server работает, можно скачать готовые PNG тайлы:

```bash
# Скачать тестовые растровые тайлы России (OpenStreetMap)
wget -O /path/to/offline-tiles/test-osm.mbtiles \
  "https://download.maptiler.com/osm/planet_z0-z5_2023.mbtiles"
```

Или сгенерировать маленький тестовый MBTiles через Python:

```bash
pip install Pillow
python3 -c "
import sqlite3, io
from PIL import Image, ImageDraw, ImageFont

db = sqlite3.connect('test-raster.mbtiles')
db.execute('CREATE TABLE IF NOT EXISTS metadata (name TEXT, value TEXT)')
db.execute('CREATE TABLE IF NOT EXISTS tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)')
db.execute(\"INSERT INTO metadata VALUES ('format', 'png')\")
db.execute(\"INSERT INTO metadata VALUES ('bounds', '39.5,55.5,41.5,56.8')\")
db.execute(\"INSERT INTO metadata VALUES ('center', '40.4,56.1,10')\")
db.execute(\"INSERT INTO metadata VALUES ('minzoom', '8')\")
db.execute(\"INSERT INTO metadata VALUES ('maxzoom', '12')\")
db.execute(\"INSERT INTO metadata VALUES ('name', 'test-raster')\")
db.execute(\"INSERT INTO metadata VALUES ('description', 'Test raster tileset')\")

# Генерируем несколько тестовых тайлов (цветные квадраты с координатами)
import math
for z in range(8, 13):
    x_min = int((39.5 + 180) / 360 * (1 << z))
    x_max = int((41.5 + 180) / 360 * (1 << z))
    y_min_slippy = int((1 - math.asinh(math.tan(math.radians(56.8))) / math.pi) / 2 * (1 << z))
    y_max_slippy = int((1 - math.asinh(math.tan(math.radians(55.5))) / math.pi) / 2 * (1 << z))
    for x in range(x_min, x_max + 1):
        for y in range(y_min_slippy, y_max_slippy + 1):
            img = Image.new('RGBA', (256, 256), (59, 130, 246, 40))
            draw = ImageDraw.Draw(img)
            draw.rectangle([0, 0, 255, 255], outline=(59, 130, 246, 120), width=1)
            draw.text((10, 10), f'{z}/{x}/{y}', fill=(255, 255, 255, 200))
            buf = io.BytesIO()
            img.save(buf, 'PNG')
            tms_y = (1 << z) - 1 - y
            db.execute('INSERT INTO tiles VALUES (?, ?, ?, ?)', (z, x, tms_y, buf.getvalue()))

db.commit()
db.close()
print('Создан test-raster.mbtiles')
"
# Скопируйте в offline-tiles/
mv test-raster.mbtiles /путь/к/проекту/offline-tiles/
```
