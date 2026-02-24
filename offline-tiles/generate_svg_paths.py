"""
Скачивание упрощённых контуров субъектов РФ из OpenStreetMap (Overpass API)
и генерация TypeScript-файла с SVG-path строками.

Требования:
    pip install requests shapely

Использование:
    python generate_svg_paths.py                # скачать все + сгенерировать .ts
    python generate_svg_paths.py --only-convert # только конвертировать уже скачанные
    python generate_svg_paths.py --id moscow_city  # один регион

Результат:
    frontend/src/data/russiaRegionsPaths.ts
"""

import os
import sys
import json
import time
import math
import argparse
import logging

try:
    import requests
except ImportError:
    print("❌  pip install requests")
    sys.exit(1)

try:
    from shapely.geometry import shape, mapping, MultiPolygon, Polygon
    from shapely.ops import unary_union, polygonize, transform as shapely_transform
    from shapely.geometry import LineString
except ImportError:
    print("❌  pip install shapely")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ─── Пути ────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BOUNDARY_DIR = os.path.join(SCRIPT_DIR, "boundaries")
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_TS = os.path.join(PROJECT_ROOT, "frontend", "src", "data", "russiaRegionsPaths.ts")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Альтернативные эндпоинты Overpass (fallback)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]

MAX_RETRIES = 3
RETRY_DELAY = 15  # секунд

# ─── SVG‑проекция: Albers Equal‑Area Conic для России ─────────────────
# Стандартные параллели и параметры подобраны для атласной карты РФ.
# Зеркало projectToSvg из russiaRegionsGeo.ts — менять синхронно!
SVG_W = 1000
SVG_H = 600

# Параметры Albers
_PHI1 = math.radians(52)    # стандартная параллель 1
_PHI2 = math.radians(64)    # стандартная параллель 2
_PHI0 = math.radians(56)    # широта начала координат
_LAM0 = math.radians(100)   # центральный меридиан

_n = (math.sin(_PHI1) + math.sin(_PHI2)) / 2
_C = math.cos(_PHI1) ** 2 + 2 * _n * math.sin(_PHI1)
_rho0 = math.sqrt(abs(_C - 2 * _n * math.sin(_PHI0))) / _n

# Границы «сырых» координат Albers для территории РФ (расчётные)
# Определяются при первом запуске convert_all и используются для масштабирования
_albers_bounds: dict | None = None


def _albers_raw(lon_deg: float, lat_deg: float) -> tuple[float, float]:
    """Albers Equal-Area Conic: (lon°, lat°) → (x, y) в безразмерных единицах."""
    lam = math.radians(lon_deg)
    phi = math.radians(lat_deg)
    theta = _n * (lam - _LAM0)
    rho = math.sqrt(abs(_C - 2 * _n * math.sin(phi))) / _n
    x = rho * math.sin(theta)
    y = _rho0 - rho * math.cos(theta)
    return x, y


def _compute_albers_bounds():
    """Вычисляет охват карты по имеющимся GeoJSON‑файлам."""
    global _albers_bounds
    xs, ys = [], []
    for rid in REGIONS:
        fpath = os.path.join(BOUNDARY_DIR, f"{rid}.geojson")
        if not os.path.exists(fpath):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        geom_raw = data.get("geometry") or (data["features"][0]["geometry"] if data.get("type") == "FeatureCollection" else data)
        geom = shape(geom_raw)
        # Нормализация антимеридиана (Чукотка и т.п.)
        geom = _normalize_antimeridian(geom)
        bounds = geom.bounds  # (minx, miny, maxx, maxy) = (minlon, minlat, maxlon, maxlat)
        for lon in [bounds[0], bounds[2]]:
            for lat in [bounds[1], bounds[3]]:
                ax, ay = _albers_raw(lon, lat)
                xs.append(ax)
                ys.append(ay)
    if not xs:
        # Фоллбэк: крайние точки России
        for lon, lat in [(18, 41), (18, 71), (180, 41), (180, 71), (100, 56)]:
            ax, ay = _albers_raw(lon, lat)
            xs.append(ax)
            ys.append(ay)
    PAD = 0.02  # 2% отступ
    x_range = max(xs) - min(xs)
    y_range = max(ys) - min(ys)
    _albers_bounds = {
        "xmin": min(xs) - x_range * PAD,
        "xmax": max(xs) + x_range * PAD,
        "ymin": min(ys) - y_range * PAD,
        "ymax": max(ys) + y_range * PAD,
    }
    log.info(f"  Albers bounds: x=[{_albers_bounds['xmin']:.4f}, {_albers_bounds['xmax']:.4f}]  "
             f"y=[{_albers_bounds['ymin']:.4f}, {_albers_bounds['ymax']:.4f}]")


def project(lon: float, lat: float) -> tuple[float, float]:
    """Проекция [lon, lat] → [x, y] для SVG viewBox 0 0 {SVG_W} {SVG_H}.
    Используется Albers Equal-Area Conic (атласная проекция РФ)."""
    global _albers_bounds
    if _albers_bounds is None:
        _compute_albers_bounds()
    ax, ay = _albers_raw(lon, lat)
    b = _albers_bounds
    x_range = b["xmax"] - b["xmin"]
    y_range = b["ymax"] - b["ymin"]
    # Вписываем с сохранением пропорций
    scale = min(SVG_W / x_range, SVG_H / y_range)
    cx = (b["xmin"] + b["xmax"]) / 2
    cy = (b["ymin"] + b["ymax"]) / 2
    x = SVG_W / 2 + (ax - cx) * scale
    y = SVG_H / 2 - (ay - cy) * scale  # Y flipped: north = top
    return round(x, 1), round(y, 1)


# ─── Каталог субъектов РФ (OSM relation id) ──────────────────────────
REGIONS = {
    "adygea":               {"name": "Республика Адыгея",                "osm_id": 253256},
    "altai_krai":           {"name": "Алтайский край",                   "osm_id": 144764},
    "altai_republic":       {"name": "Республика Алтай",                 "osm_id": 145194},
    "amur_oblast":          {"name": "Амурская область",                 "osm_id": 147166},
    "arkhangelsk_oblast":   {"name": "Архангельская область",            "osm_id": 140337},
    "astrakhan_oblast":     {"name": "Астраханская область",             "osm_id": 112819},
    "bashkortostan":        {"name": "Республика Башкортостан",          "osm_id": 77677},
    "belgorod_oblast":      {"name": "Белгородская область",             "osm_id": 83184},
    "bryansk_oblast":       {"name": "Брянская область",                 "osm_id": 81997},
    "buryatia":             {"name": "Республика Бурятия",               "osm_id": 145729},
    "chelyabinsk_oblast":   {"name": "Челябинская область",              "osm_id": 77687},
    "chechnya":             {"name": "Чеченская Республика",             "osm_id": 109877},
    "chukotka_ao":          {"name": "Чукотский АО",                     "osm_id": 151231},
    "chuvashia":            {"name": "Чувашская Республика",             "osm_id": 80513},
    "crimea":               {"name": "Республика Крым",                  "osm_id": 3795586},
    "dagestan":             {"name": "Республика Дагестан",              "osm_id": 109876},
    "ingushetia":           {"name": "Республика Ингушетия",             "osm_id": 253252},
    "irkutsk_oblast":       {"name": "Иркутская область",               "osm_id": 145454},
    "ivanovo_oblast":       {"name": "Ивановская область",              "osm_id": 85617},
    "jewish_ao":            {"name": "Еврейская АО",                     "osm_id": 147167},
    "kabardino_balkaria":   {"name": "Кабардино-Балкарская Республика",  "osm_id": 109879},
    "kaliningrad_oblast":   {"name": "Калининградская область",          "osm_id": 103906},
    "kalmykia":             {"name": "Республика Калмыкия",              "osm_id": 108083},
    "kaluga_oblast":        {"name": "Калужская область",                "osm_id": 81995},
    "kamchatka_krai":       {"name": "Камчатский край",                  "osm_id": 151233},
    "karachay_cherkessia":  {"name": "Карачаево-Черкесская Республика",  "osm_id": 109878},
    "karelia":              {"name": "Республика Карелия",               "osm_id": 393980},
    "kemerovo_oblast":      {"name": "Кемеровская область",              "osm_id": 144763},
    "khabarovsk_krai":      {"name": "Хабаровский край",                 "osm_id": 151223},
    "khakassia":            {"name": "Республика Хакасия",               "osm_id": 190911},
    "khanty_mansi_ao":      {"name": "ХМАО — Югра",                      "osm_id": 140296},
    "kirov_oblast":         {"name": "Кировская область",                "osm_id": 115100},
    "komi":                 {"name": "Республика Коми",                  "osm_id": 115136},
    "kostroma_oblast":      {"name": "Костромская область",              "osm_id": 85963},
    "krasnodar_krai":       {"name": "Краснодарский край",               "osm_id": 108082},
    "krasnoyarsk_krai":     {"name": "Красноярский край",                "osm_id": 190090},
    "kurgan_oblast":        {"name": "Курганская область",              "osm_id": 140290},
    "kursk_oblast":         {"name": "Курская область",                  "osm_id": 72223},
    "leningrad_oblast":     {"name": "Ленинградская область",            "osm_id": 176095},
    "lipetsk_oblast":       {"name": "Липецкая область",                 "osm_id": 72169},
    "magadan_oblast":       {"name": "Магаданская область",              "osm_id": 151228},
    "mari_el":              {"name": "Республика Марий Эл",              "osm_id": 115114},
    "mordovia":             {"name": "Республика Мордовия",              "osm_id": 72196},
    "moscow_city":          {"name": "Москва",                           "osm_id": 102269},
    "moscow_oblast":        {"name": "Московская область",               "osm_id": 51490},
    "murmansk_oblast":      {"name": "Мурманская область",               "osm_id": 2099216},
    "nenets_ao":            {"name": "Ненецкий АО",                      "osm_id": 274048},
    "nizhny_novgorod_oblast":{"name":"Нижегородская область",            "osm_id": 72195},
    "novgorod_oblast":      {"name": "Новгородская область",             "osm_id": 89331},
    "novosibirsk_oblast":   {"name": "Новосибирская область",            "osm_id": 140294},
    "north_ossetia":        {"name": "Северная Осетия — Алания",         "osm_id": 110032},
    "omsk_oblast":          {"name": "Омская область",                   "osm_id": 140292},
    "orenburg_oblast":      {"name": "Оренбургская область",             "osm_id": 77669},
    "oryol_oblast":         {"name": "Орловская область",                "osm_id": 72224},
    "penza_oblast":         {"name": "Пензенская область",               "osm_id": 72182},
    "perm_krai":            {"name": "Пермский край",                    "osm_id": 115135},
    "primorsky_krai":       {"name": "Приморский край",                  "osm_id": 151225},
    "pskov_oblast":         {"name": "Псковская область",                "osm_id": 155262},
    "rostov_oblast":        {"name": "Ростовская область",               "osm_id": 85606},
    "ryazan_oblast":        {"name": "Рязанская область",                "osm_id": 71950},
    "sakhalin_oblast":      {"name": "Сахалинская область",              "osm_id": 394235},
    "samara_oblast":        {"name": "Самарская область",                "osm_id": 72194},
    "saratov_oblast":       {"name": "Саратовская область",              "osm_id": 72193},
    "sevastopol":           {"name": "Севастополь",                      "osm_id": 1574364},
    "smolensk_oblast":      {"name": "Смоленская область",               "osm_id": 81996},
    "spb":                  {"name": "Санкт-Петербург",                  "osm_id": 337422},
    "stavropol_krai":       {"name": "Ставропольский край",              "osm_id": 108081},
    "sverdlovsk_oblast":    {"name": "Свердловская область",             "osm_id": 79379},
    "tambov_oblast":        {"name": "Тамбовская область",               "osm_id": 72180},
    "tatarstan":            {"name": "Республика Татарстан",             "osm_id": 79374},
    "tomsk_oblast":         {"name": "Томская область",                  "osm_id": 140295},
    "tula_oblast":          {"name": "Тульская область",                 "osm_id": 81993},
    "tuva":                 {"name": "Республика Тыва",                  "osm_id": 145195},
    "tver_oblast":          {"name": "Тверская область",                 "osm_id": 2095259},
    "tyumen_oblast":        {"name": "Тюменская область",                "osm_id": 140291},
    "udmurtia":             {"name": "Удмуртская Республика",            "osm_id": 115134},
    "ulyanovsk_oblast":     {"name": "Ульяновская область",              "osm_id": 72192},
    "vladimir_oblast":      {"name": "Владимирская область",             "osm_id": 72197},
    "volgograd_oblast":     {"name": "Волгоградская область",            "osm_id": 77665},
    "vologda_oblast":       {"name": "Вологодская область",              "osm_id": 115106},
    "voronezh_oblast":      {"name": "Воронежская область",              "osm_id": 72181},
    "yakutia":              {"name": "Республика Саха (Якутия)",         "osm_id": 151234},
    "yamal_ao":             {"name": "Ямало-Ненецкий АО",                "osm_id": 191706},
    "yaroslavl_oblast":     {"name": "Ярославская область",              "osm_id": 81994},
    "zabaykalsky_krai":     {"name": "Забайкальский край",               "osm_id": 145730},
}

# ─── Порог упрощения границ (в градусах) ─────────────────────────────
# Чем больше — тем грубее контур, но меньше вес файла.
# 0.02° ≈ 1–2 км — хороший компромисс для обзорной SVG‑карты
SIMPLIFY_TOLERANCE = 0.02


# ═════════════════════════════════════════════════════════════════════
# 1. Скачивание из OSM
# ═════════════════════════════════════════════════════════════════════

def fetch_boundary(osm_id: int, name: str) -> dict | None:
    """Скачивает контур региона из Overpass API → GeoJSON dict (с ретраями)."""
    query = f"[out:json][timeout:180];relation({osm_id});out geom;"
    log.info(f"  Overpass → {name}  (relation/{osm_id}) …")

    data = None
    for attempt in range(MAX_RETRIES):
        # Ротация эндпоинтов
        url = OVERPASS_ENDPOINTS[attempt % len(OVERPASS_ENDPOINTS)]
        try:
            resp = requests.post(url, data={"data": query}, timeout=240)
            resp.raise_for_status()
            data = resp.json()
            break
        except Exception as e:
            log.warning(f"  ⚠️  Попытка {attempt+1}/{MAX_RETRIES} ({url.split('//')[1].split('/')[0]}): {e}")
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_DELAY * (attempt + 1)
                log.info(f"  ⏳  Ждём {wait} сек перед повтором...")
                time.sleep(wait)

    if data is None:
        log.error(f"  ❌  Все {MAX_RETRIES} попыток неудачны для {name}")
        return None

    elements = data.get("elements", [])
    if not elements:
        log.warning(f"  ⚠️  Пустой ответ для relation/{osm_id}")
        return None

    relation = elements[0]
    members = relation.get("members", [])

    outer_rings = []
    for m in members:
        if m.get("role") == "outer" and m.get("type") == "way":
            geom = m.get("geometry", [])
            if geom:
                ring = [[pt["lon"], pt["lat"]] for pt in geom]
                outer_rings.append(ring)

    if not outer_rings:
        log.warning(f"  ⚠️  Нет outer ways для {name}")
        return None

    try:
        lines = [LineString(r) for r in outer_rings]
        polys = list(polygonize(lines))
        if not polys:
            polys = []
            for ring in outer_rings:
                if len(ring) >= 4:
                    if ring[0] != ring[-1]:
                        ring.append(ring[0])
                    try:
                        p = Polygon(ring)
                        polys.append(p.buffer(0) if not p.is_valid else p)
                    except Exception:
                        pass
        merged = unary_union(polys) if polys else None
        if merged is None or merged.is_empty:
            return None
    except Exception as e:
        log.error(f"  ❌  Ошибка сборки: {e}")
        return None

    feature = {
        "type": "Feature",
        "properties": {"name": name, "osm_id": osm_id},
        "geometry": mapping(merged),
    }
    return feature


def download_all(only_ids: list[str] | None = None):
    """Скачивает GeoJSON‑файлы в boundaries/."""
    os.makedirs(BOUNDARY_DIR, exist_ok=True)
    targets = {k: v for k, v in REGIONS.items() if only_ids is None or k in only_ids}
    total = len(targets)

    for i, (rid, info) in enumerate(sorted(targets.items()), 1):
        fpath = os.path.join(BOUNDARY_DIR, f"{rid}.geojson")
        if os.path.exists(fpath):
            log.info(f"[{i}/{total}] ⏭️  {info['name']} — уже есть")
            continue

        log.info(f"[{i}/{total}] {info['name']}")
        feature = fetch_boundary(info["osm_id"], info["name"])
        if feature:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(feature, f, ensure_ascii=False)
            kb = os.path.getsize(fpath) / 1024
            log.info(f"  ✅  {fpath}  ({kb:.0f} КБ)")
        else:
            log.error(f"  ❌  Не удалось скачать {info['name']}")

        # Пауза между запросами к Overpass
        time.sleep(5)


# ═════════════════════════════════════════════════════════════════════
# 2. Конвертация GeoJSON → SVG path‑строки
# ═════════════════════════════════════════════════════════════════════

def _normalize_antimeridian(geom):
    """Нормализация геометрии, пересекающей антимеридиан (180°).
    Если геометрия содержит координаты и > 150° и < -150°,
    сдвигаем отрицательные долготы на +360° для непрерывности."""
    bounds = geom.bounds  # (minlon, minlat, maxlon, maxlat)
    if bounds[0] < -150 and bounds[2] > 150:
        # Пересекает антимеридиан — сдвигаем все отрицательные lon на +360°
        def _shift_lon(x, y, z=None):
            new_x = [xi + 360 if xi < 0 else xi for xi in x]
            return (new_x, y, z) if z is not None else (new_x, y)
        geom = shapely_transform(_shift_lon, geom)
    return geom


def geojson_to_svg_path(geojson_geom: dict, tolerance: float) -> str:
    """Конвертирует GeoJSON geometry → SVG path string (d=…)."""
    geom = shape(geojson_geom)

    # Нормализация антимеридиана (Чукотка и т.п.)
    geom = _normalize_antimeridian(geom)

    # Упрощаем
    geom = geom.simplify(tolerance, preserve_topology=True)

    # Убеждаемся что это MultiPolygon
    if isinstance(geom, Polygon):
        geom = MultiPolygon([geom])

    parts: list[str] = []

    for poly in geom.geoms:
        # Внешнее кольцо
        ring = list(poly.exterior.coords)
        if len(ring) < 3:
            continue
        pts = [project(lon, lat) for lon, lat in ring]
        svg_pts = " ".join(f"{x},{y}" for x, y in pts)
        parts.append(f"M {svg_pts} Z")

        # Внутренние кольца (дырки — озёра и т.п.)
        for interior in poly.interiors:
            iring = list(interior.coords)
            if len(iring) < 3:
                continue
            ipts = [project(lon, lat) for lon, lat in iring]
            svg_ipts = " ".join(f"{x},{y}" for x, y in ipts)
            parts.append(f"M {svg_ipts} Z")

    return " ".join(parts)


def compute_centroid_svg(geojson_geom: dict) -> tuple[float, float]:
    """Вычисляет центроид полигона в SVG-координатах."""
    geom = shape(geojson_geom)
    # Нормализация антимеридиана (Чукотка и т.п.)
    geom = _normalize_antimeridian(geom)
    c = geom.centroid
    return project(c.x, c.y)


def convert_all(tolerance: float = SIMPLIFY_TOLERANCE) -> dict[str, dict]:
    """Конвертирует все скачанные GeoJSON → dict region_id → {path, cx, cy}."""
    # Сначала вычисляем охват всех регионов для масштабирования Albers
    log.info("  Вычисляю охват карты (Albers bounds)…")
    _compute_albers_bounds()

    result = {}

    for rid in sorted(REGIONS.keys()):
        fpath = os.path.join(BOUNDARY_DIR, f"{rid}.geojson")
        if not os.path.exists(fpath):
            log.warning(f"  ⚠️  Нет файла {fpath}, пропускаем {rid}")
            continue

        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        # GeoJSON может быть Feature или FeatureCollection
        if data.get("type") == "FeatureCollection":
            geom = data["features"][0]["geometry"]
        elif data.get("type") == "Feature":
            geom = data["geometry"]
        else:
            geom = data

        svg_path = geojson_to_svg_path(geom, tolerance)
        cx, cy = compute_centroid_svg(geom)

        result[rid] = {
            "path": svg_path,
            "cx": cx,
            "cy": cy,
        }

        log.info(f"  ✅  {rid:30s}  path={len(svg_path):>6} chars   center=({cx:.1f}, {cy:.1f})")

    return result


# ═════════════════════════════════════════════════════════════════════
# 3. Генерация TypeScript‑файла
# ═════════════════════════════════════════════════════════════════════

def generate_ts(paths: dict[str, dict], tolerance: float = SIMPLIFY_TOLERANCE):
    """Генерирует russiaRegionsPaths.ts."""
    b = _albers_bounds
    lines: list[str] = []
    lines.append("/**")
    lines.append(" * SVG-path контуры субъектов РФ.")
    lines.append(" * Сгенерировано автоматически из GeoJSON (OSM Overpass).")
    lines.append(f" * Проекция: Albers Equal-Area Conic (φ1=52° φ2=64° λ0=100° φ0=56°)")
    lines.append(f" * Регионов: {len(paths)}")
    lines.append(f" * Упрощение: {tolerance}° (≈ {tolerance * 111:.0f} км)")
    lines.append(" *")
    lines.append(" * Перегенерация:  cd offline-tiles && python generate_svg_paths.py")
    lines.append(" */")
    lines.append("")
    lines.append(f"export const SVG_WIDTH = {SVG_W};")
    lines.append(f"export const SVG_HEIGHT = {SVG_H};")
    lines.append("")
    lines.append("/** Параметры проекции Albers для масштабирования (для projectToSvg) */")
    lines.append("export const ALBERS_BOUNDS = {")
    if b:
        lines.append(f"  xmin: {b['xmin']},")
        lines.append(f"  xmax: {b['xmax']},")
        lines.append(f"  ymin: {b['ymin']},")
        lines.append(f"  ymax: {b['ymax']},")
    lines.append("};")
    lines.append("")
    lines.append("export interface RegionPath {")
    lines.append("  /** SVG path d-attribute */")
    lines.append("  d: string;")
    lines.append("  /** Центроид в SVG-координатах (для подписи) */")
    lines.append("  cx: number;")
    lines.append("  cy: number;")
    lines.append("}")
    lines.append("")
    lines.append("export const REGION_PATHS: Record<string, RegionPath> = {")

    for rid in sorted(paths.keys()):
        p = paths[rid]
        # Длинные path-строки оборачиваем
        d_escaped = p["path"].replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"  '{rid}': {{")
        lines.append(f"    d: '{d_escaped}',")
        lines.append(f"    cx: {p['cx']}, cy: {p['cy']},")
        lines.append(f"  }},")

    lines.append("};")
    lines.append("")

    os.makedirs(os.path.dirname(OUTPUT_TS), exist_ok=True)
    with open(OUTPUT_TS, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    size_kb = os.path.getsize(OUTPUT_TS) / 1024
    log.info(f"\n✅  Сгенерирован {OUTPUT_TS}")
    log.info(f"   Размер: {size_kb:.0f} КБ,  регионов: {len(paths)}")


# ═════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="GeoJSON → SVG path конвертер для карты субъектов РФ"
    )
    parser.add_argument("--only-convert", action="store_true",
                        help="Только конвертировать уже скачанные GeoJSON (не качать)")
    parser.add_argument("--id", nargs="*",
                        help="ID конкретного региона (можно несколько)")
    parser.add_argument("--tolerance", type=float, default=SIMPLIFY_TOLERANCE,
                        help=f"Порог упрощения в градусах (default: {SIMPLIFY_TOLERANCE})")
    parser.add_argument("--list", action="store_true",
                        help="Показать список регионов")
    args = parser.parse_args()

    tolerance = args.tolerance

    if args.list:
        print(f"\n{'ID':<30} {'Название':<40} {'OSM ID'}")
        print("-" * 80)
        for rid, info in sorted(REGIONS.items()):
            print(f"{rid:<30} {info['name']:<40} {info['osm_id']}")
        print(f"\nВсего: {len(REGIONS)} регионов")
        return

    # Шаг 1: скачиваем (если нужно)
    if not args.only_convert:
        log.info("═══ Шаг 1: Скачивание контуров из OSM Overpass ═══")
        log.info("⚠️  Это может занять ~30-60 мин из-за лимитов API")
        download_all(args.id)

    # Шаг 2: конвертируем
    log.info("\n═══ Шаг 2: Конвертация GeoJSON → SVG paths ═══")
    paths = convert_all(tolerance)

    if not paths:
        log.error("❌  Нет данных для конвертации. Сначала скачайте границы.")
        return

    # Шаг 3: генерируем TS
    log.info("\n═══ Шаг 3: Генерация TypeScript ═══")
    generate_ts(paths, tolerance)

    log.info("\n🎉  Готово!")


if __name__ == "__main__":
    main()
