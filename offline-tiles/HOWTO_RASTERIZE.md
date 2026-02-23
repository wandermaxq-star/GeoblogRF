# Инструкция: нарезка тайлов по полигонам регионов РФ (PBF → PNG)

## Концепция

Каждый субъект РФ — **отдельный MBTiles**, нарезанный строго по контурам границ.
Никаких прямоугольников — только тайлы, реально попадающие внутрь полигона региона.
Буферная зона +2 км по умолчанию гарантирует плавные стыки.

```
┌──────────────────────────────┐
│  Прямоугольник bounds         │
│    ┌──╮                      │ ← Пропускаем (экономия ~70-80%)
│   ╱    ╲                     │
│  │ ████ │   ← Контур региона │ ← Сохраняем
│  │ ████ │     (GeoJSON)       │
│   ╲    ╱                     │
│    └──╯                      │
└──────────────────────────────┘
```

### Два уровня детализации для каждого региона:

| Файл | Zoom | Назначение | Примерный размер |
|------|------|-----------|-----------------|
| `vladimir_oblast.mbtiles` | 4–12 | Обзорная карта региона | ~20–40 МБ |
| `vladimir_oblast_capital.mbtiles` | 8–16 | Детальная карта столицы | ~10–25 МБ |

---

## 📋 Чеклист

- [ ] 1. Установить зависимости (`requests`, `shapely`, `tqdm`, Docker)
- [ ] 2. Скачать контуры границ нужных регионов (GeoJSON)
- [ ] 3. Запустить tileserver-gl с исходными PBF-тайлами
- [ ] 4. Нарезать тайлы по полигону (region → MBTiles)
- [ ] 5. Проверить результат (metadata, формат, визуально)
- [ ] 6. Разместить MBTiles в `offline-tiles/`
- [ ] 7. Проверить через бэкенд (`/api/tiles/`)

---

## 1. Подготовка

### Установка зависимостей

```bash
# Python (обязательно)
pip install requests shapely tqdm Pillow

# Docker (для tileserver-gl)
docker --version  # должен быть установлен

# Проверка версий
python3 -V; pip3 -V; docker --version
```

### Структура файлов

```
offline-tiles/
├── boundaries/                    ← GeoJSON контуры (скачиваются автоматически)
│   ├── vladimir_oblast.geojson
│   ├── vladimir_oblast_capital.geojson
│   ├── ivanovo_oblast.geojson
│   └── ...
├── download_boundaries.py         ← Скрипт скачивания контуров из OSM
├── generate_region_tiles.py       ← Основной генератор тайлов по полигону
├── generate_test_tiles.py         ← Генератор тестовых тайлов (без tileserver)
├── vladimir_oblast.mbtiles        ← Результат: обзор региона (z4-12)
├── vladimir_oblast_capital.mbtiles← Результат: детали столицы (z8-16)
└── HOWTO_RASTERIZE.md             ← Этот файл
```

---

## 2. Скачивание контуров границ

Контуры скачиваются из OpenStreetMap через Overpass API.

```bash
cd offline-tiles

# Посмотреть список доступных регионов
python download_boundaries.py --list

# Скачать контур одного региона (+ столица)
python download_boundaries.py --id vladimir_oblast

# Скачать ВСЕ регионы (⚠️ ~30-60 мин, Overpass лимитирует)
python download_boundaries.py

# Только регион без столицы
python download_boundaries.py --id arkhangelsk_oblast --no-capitals
```

Результат: `boundaries/vladimir_oblast.geojson` + `boundaries/vladimir_oblast_capital.geojson`

### Альтернативные источники контуров

Если Overpass недоступен или работает медленно:

| Источник | URL | Формат |
|----------|-----|--------|
| OSM Boundaries | https://osm-boundaries.com/ | GeoJSON, admin_level=4 |
| GADM | https://gadm.org/download_country.html | GeoJSON/SHP |
| NextGIS | https://data.nextgis.com/ | GeoJSON |

Скачайте GeoJSON и положите в `boundaries/<region_id>.geojson`.

---

## 3. Запуск tileserver-gl

Нужен исходный MBTiles с **векторными** тайлами (PBF/MVT) для всей территории (или нужного покрытия).

```bash
# Windows (PowerShell)
docker run --rm -it `
  -v d:/newgeoblogrf/offline-tiles:/data `
  -p 8080:8080 `
  maptiler/tileserver-gl `
  --file /data/vla.mbtiles

# Linux / macOS
docker run --rm -it \
  -v $(pwd):/data \
  -p 8080:8080 \
  maptiler/tileserver-gl \
  --file /data/vla.mbtiles
```

Проверка:
```bash
# Стили (определите точное имя STYLE)
curl http://localhost:8080/styles.json

# Один тайл
curl -o test.png http://localhost:8080/styles/basic-preview/10/620/335.png
```

---

## 4. Генерация тайлов по полигону

### Один регион (обзор)

```bash
python generate_region_tiles.py \
  --region boundaries/vladimir_oblast.geojson \
  --output vladimir_oblast.mbtiles \
  --name "Владимирская область" \
  --min-zoom 4 --max-zoom 12 \
  --buffer 2 \
  --threads 20
```

### Столица (детали)

```bash
python generate_region_tiles.py \
  --region boundaries/vladimir_oblast_capital.geojson \
  --output vladimir_oblast_capital.mbtiles \
  --name "г. Владимир" \
  --min-zoom 8 --max-zoom 16 \
  --buffer 3 \
  --threads 20
```

### Параметры

| Параметр | Описание | По умолчанию |
|----------|---------|-------------|
| `--region` | GeoJSON контура | **обязательный** |
| `--output` | Выходной .mbtiles | **обязательный** |
| `--name` | Название для метаданных | "Region" |
| `--min-zoom` | Минимальный zoom | 4 |
| `--max-zoom` | Максимальный zoom | 12 |
| `--buffer` | Буферная зона (км) | 2 |
| `--threads` | Потоков загрузки | 20 |
| `--tileserver` | URL tileserver-gl | http://localhost:8080 |
| `--style` | Имя стиля | basic-preview |
| `--batch-size` | Пакет для commit | 500 |

### Переменные окружения

```bash
export TILESERVER_URL=http://localhost:8080
export TILE_STYLE=basic-preview
```

### Пакетная генерация нескольких регионов

```powershell
# PowerShell
$regions = @("vladimir_oblast", "ivanovo_oblast", "moscow_oblast")
foreach ($r in $regions) {
    Write-Host "=== $r ===" -ForegroundColor Green
    python generate_region_tiles.py `
      --region "boundaries/$r.geojson" `
      --output "$r.mbtiles" `
      --name $r `
      --min-zoom 4 --max-zoom 12

    # Столица (если есть)
    if (Test-Path "boundaries/${r}_capital.geojson") {
        python generate_region_tiles.py `
          --region "boundaries/${r}_capital.geojson" `
          --output "${r}_capital.mbtiles" `
          --name "${r}_capital" `
          --min-zoom 8 --max-zoom 16
    }
}
```

```bash
# Bash
for r in vladimir_oblast ivanovo_oblast moscow_oblast; do
    echo "=== $r ==="
    python3 generate_region_tiles.py \
      --region "boundaries/${r}.geojson" \
      --output "${r}.mbtiles" \
      --name "$r" \
      --min-zoom 4 --max-zoom 12

    if [ -f "boundaries/${r}_capital.geojson" ]; then
        python3 generate_region_tiles.py \
          --region "boundaries/${r}_capital.geojson" \
          --output "${r}_capital.mbtiles" \
          --name "${r}_capital" \
          --min-zoom 8 --max-zoom 16
    fi
done
```

---

## 5. Проверка результатов

```bash
# Метаданные
sqlite3 vladimir_oblast.mbtiles "SELECT name, value FROM metadata;"
# Ожидаем: format = png, clip_type = polygon

# Тайлы по zoom
sqlite3 vladimir_oblast.mbtiles \
  "SELECT zoom_level, COUNT(*) FROM tiles GROUP BY zoom_level ORDER BY zoom_level;"

# Формат PNG?
sqlite3 vladimir_oblast.mbtiles "SELECT value FROM metadata WHERE name='format';"
```

---

## 6. Интеграция с проектом

```powershell
# Бэкап старых файлов
Copy-Item offline-tiles\vla.mbtiles offline-tiles\vla.mbtiles.bak

# Проверяем бэкенд
cd backend
$env:SKIP_DB="true"; node server.js

# API проверка
curl http://localhost:3002/api/tiles
curl http://localhost:3002/api/tiles/vladimir_oblast/metadata
```

Бэкенд автоматически находит все `.mbtiles` в `offline-tiles/` и отдаёт по имени файла.

---

## 7. Именование файлов

Имена MBTiles должны совпадать с `id` регионов из `regionsStore.ts`:

| region_id в коде | MBTiles файл | Содержимое |
|-----------------|-------------|-----------|
| `vladimir_oblast` | `vladimir_oblast.mbtiles` | Обзор z4-12 |
| `vladimir_oblast` | `vladimir_oblast_capital.mbtiles` | Столица z8-16 |
| `ivanovo_oblast` | `ivanovo_oblast.mbtiles` | Обзор z4-12 |
| `moscow_city` | `moscow_city.mbtiles` | Москва z4-12 |
| `moscow_city` | `moscow_city_capital.mbtiles` | Детали z8-16 |

---

## 8. Буферные зоны и стыки

По умолчанию `--buffer 2` добавляет ~2 км к контуру. Это гарантирует:
- Плавный переход между соседними регионами
- Нет белых полос на стыках
- При скачивании соседнего региона тайлы перекрываются — это нормально

Увеличьте буфер до 3–5 км для столиц (границы городов часто неточные).

---

## 9. Откат при ошибках

```bash
# Вернуть старый файл
Move-Item offline-tiles\vla.mbtiles.bak offline-tiles\vla.mbtiles

# Перезапустить бэкенд
```

---

## 10. Оценка размеров

| Тип региона | Zoom | Тайлов (полигон) | Примерный размер |
|------------|------|-----------------|-----------------|
| Средняя область (Владимирская) | 4–12 | ~15 000 | ~20–40 МБ |
| Большой край (Красноярский) | 4–12 | ~80 000 | ~100–150 МБ |
| Город-столица | 8–16 | ~5 000–15 000 | ~10–25 МБ |
| Москва | 4–12 + 8–16 | ~25 000 | ~40–60 МБ |

Сравнение с прямоугольной нарезкой: экономия **60–85%** дискового пространства.

---

## Частые проблемы

| Проблема | Решение |
|---------|---------|
| 404 на тайлы | Проверьте имя STYLE: `curl localhost:8080/styles.json` |
| shapely ошибка | `pip install shapely` (Windows: может потребовать Visual C++) |
| Overpass таймаут | Повторите через 5 мин или используйте альтернативный источник |
| Порт 8080 занят | `-p 9090:8080` и `--tileserver http://localhost:9090` |
| Много ошибок ERR | Уменьшите `--threads 5` |
| Docker mount Windows | Используйте `d:/path` (прямые слэши) |
| Пустой MBTiles | Проверьте что GeoJSON содержит валидный полигон |
