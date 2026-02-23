"""
Скачивание контуров границ субъектов РФ и их столиц
из OpenStreetMap (Overpass API) в формате GeoJSON.

Требования:
    pip install requests shapely

Использование:
    python download_boundaries.py               # скачать все 85+ регионов
    python download_boundaries.py --id vladimir  # только Владимирскую область
    python download_boundaries.py --list         # показать список доступных регионов
"""

import os
import sys
import json
import time
import argparse
import logging

try:
    import requests
except ImportError:
    print("❌ pip install requests")
    sys.exit(1)

try:
    from shapely.geometry import shape, mapping, MultiPolygon, Polygon
    from shapely.ops import unary_union
except ImportError:
    print("❌ pip install shapely")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
log = logging.getLogger(__name__)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "boundaries")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ─────────────────────────────────────────────────────────
# Каталог субъектов РФ
# id → { name_ru, osm_relation_id, capital_name_ru, capital_osm_relation_id }
#
# OSM relation ID берём из:
#   https://wiki.openstreetmap.org/wiki/RU:Россия/Субъекты
# ─────────────────────────────────────────────────────────
REGIONS = {
    "altai_krai":           {"name": "Алтайский край",                   "osm_id": 144764,  "capital": "Барнаул",               "capital_osm_id": 1878613},
    "altai_republic":       {"name": "Республика Алтай",                 "osm_id": 145194,  "capital": "Горно-Алтайск",         "capital_osm_id": 1878620},
    "amur_oblast":          {"name": "Амурская область",                 "osm_id": 147166,  "capital": "Благовещенск",           "capital_osm_id": 1907790},
    "arkhangelsk_oblast":   {"name": "Архангельская область",            "osm_id": 140337,  "capital": "Архангельск",            "capital_osm_id": 1755790},
    "astrakhan_oblast":     {"name": "Астраханская область",             "osm_id": 112819,  "capital": "Астрахань",              "capital_osm_id": 1691720},
    "bashkortostan":        {"name": "Республика Башкортостан",          "osm_id": 77665,   "capital": "Уфа",                   "capital_osm_id": 1734810},
    "belgorod_oblast":      {"name": "Белгородская область",             "osm_id": 83184,   "capital": "Белгород",              "capital_osm_id": 1691810},
    "bryansk_oblast":       {"name": "Брянская область",                 "osm_id": 81997,   "capital": "Брянск",                "capital_osm_id": 1691830},
    "buryatia":             {"name": "Республика Бурятия",               "osm_id": 145729,  "capital": "Улан-Удэ",              "capital_osm_id": 1907800},
    "chelyabinsk_oblast":   {"name": "Челябинская область",              "osm_id": 77687,   "capital": "Челябинск",             "capital_osm_id": 1734820},
    "chechnya":             {"name": "Чеченская Республика",             "osm_id": 109877,  "capital": "Грозный",               "capital_osm_id": 1741780},
    "chukotka_ao":          {"name": "Чукотский автономный округ",       "osm_id": 151228,  "capital": "Анадырь",               "capital_osm_id": None},
    "chuvashia":            {"name": "Чувашская Республика",             "osm_id": 80513,   "capital": "Чебоксары",             "capital_osm_id": 1734830},
    "crimea":               {"name": "Республика Крым",                  "osm_id": 3795586, "capital": "Симферополь",            "capital_osm_id": None},
    "dagestan":             {"name": "Республика Дагестан",              "osm_id": 109876,  "capital": "Махачкала",             "capital_osm_id": 1741790},
    "ingushetia":           {"name": "Республика Ингушетия",             "osm_id": 253252,  "capital": "Магас",                 "capital_osm_id": None},
    "irkutsk_oblast":       {"name": "Иркутская область",               "osm_id": 145454,  "capital": "Иркутск",               "capital_osm_id": 1907810},
    "ivanovo_oblast":       {"name": "Ивановская область",              "osm_id": 85617,   "capital": "Иваново",               "capital_osm_id": 1691840},
    "jewish_ao":            {"name": "Еврейская автономная область",     "osm_id": 147167,  "capital": "Биробиджан",            "capital_osm_id": None},
    "kabardino_balkaria":   {"name": "Кабардино-Балкарская Республика",  "osm_id": 109879,  "capital": "Нальчик",               "capital_osm_id": 1741800},
    "kaliningrad_oblast":   {"name": "Калининградская область",          "osm_id": 103906,  "capital": "Калининград",           "capital_osm_id": 1691850},
    "kalmykia":             {"name": "Республика Калмыкия",              "osm_id": 108083,  "capital": "Элиста",                "capital_osm_id": 1691860},
    "kaluga_oblast":        {"name": "Калужская область",                "osm_id": 81995,   "capital": "Калуга",                "capital_osm_id": 1691870},
    "kamchatka_krai":       {"name": "Камчатский край",                  "osm_id": 151233,  "capital": "Петропавловск-Камчатский","capital_osm_id": None},
    "karachay_cherkessia":  {"name": "Карачаево-Черкесская Республика",  "osm_id": 109878,  "capital": "Черкесск",              "capital_osm_id": None},
    "karelia":              {"name": "Республика Карелия",               "osm_id": 393980,  "capital": "Петрозаводск",          "capital_osm_id": 1755800},
    "kemerovo_oblast":      {"name": "Кемеровская область",              "osm_id": 144763,  "capital": "Кемерово",              "capital_osm_id": 1878630},
    "khabarovsk_krai":      {"name": "Хабаровский край",                 "osm_id": 151223,  "capital": "Хабаровск",             "capital_osm_id": 1907820},
    "khakassia":            {"name": "Республика Хакасия",               "osm_id": 190090,  "capital": "Абакан",                "capital_osm_id": 1878640},
    "khanty_mansi_ao":      {"name": "Ханты-Мансийский АО — Югра",       "osm_id": 140296,  "capital": "Ханты-Мансийск",        "capital_osm_id": None},
    "kirov_oblast":         {"name": "Кировская область",                "osm_id": 115100,  "capital": "Киров",                 "capital_osm_id": 1734840},
    "komi":                 {"name": "Республика Коми",                  "osm_id": 115136,  "capital": "Сыктывкар",             "capital_osm_id": 1755810},
    "kostroma_oblast":      {"name": "Костромская область",              "osm_id": 85963,   "capital": "Кострома",              "capital_osm_id": 1691880},
    "krasnodar_krai":       {"name": "Краснодарский край",               "osm_id": 108082,  "capital": "Краснодар",             "capital_osm_id": 1691890},
    "krasnoyarsk_krai":     {"name": "Красноярский край",                "osm_id": 190090,  "capital": "Красноярск",            "capital_osm_id": 1878650},
    "kurgan_oblast":        {"name": "Курганская область",               "osm_id": 140295,  "capital": "Курган",                "capital_osm_id": 1734850},
    "kursk_oblast":         {"name": "Курская область",                  "osm_id": 72223,   "capital": "Курск",                 "capital_osm_id": 1691900},
    "leningrad_oblast":     {"name": "Ленинградская область",            "osm_id": 176095,  "capital": "Гатчина",               "capital_osm_id": None},
    "lipetsk_oblast":       {"name": "Липецкая область",                 "osm_id": 72169,   "capital": "Липецк",                "capital_osm_id": 1691910},
    "magadan_oblast":       {"name": "Магаданская область",              "osm_id": 151225,  "capital": "Магадан",               "capital_osm_id": None},
    "mari_el":              {"name": "Республика Марий Эл",              "osm_id": 115114,  "capital": "Йошкар-Ола",            "capital_osm_id": 1734860},
    "mordovia":             {"name": "Республика Мордовия",              "osm_id": 72196,   "capital": "Саранск",               "capital_osm_id": 1691920},
    "moscow_city":          {"name": "Москва",                           "osm_id": 102269,  "capital": "Москва",                "capital_osm_id": 102269},
    "moscow_oblast":        {"name": "Московская область",               "osm_id": 51490,   "capital": "Красногорск",           "capital_osm_id": None},
    "murmansk_oblast":      {"name": "Мурманская область",               "osm_id": 2099216, "capital": "Мурманск",              "capital_osm_id": 1755820},
    "nenets_ao":            {"name": "Ненецкий АО",                      "osm_id": 274048,  "capital": "Нарьян-Мар",            "capital_osm_id": None},
    "nizhny_novgorod_oblast":{"name":"Нижегородская область",            "osm_id": 72195,   "capital": "Нижний Новгород",       "capital_osm_id": 1691930},
    "novgorod_oblast":      {"name": "Новгородская область",             "osm_id": 89331,   "capital": "Великий Новгород",      "capital_osm_id": 1755830},
    "novosibirsk_oblast":   {"name": "Новосибирская область",            "osm_id": 140294,  "capital": "Новосибирск",           "capital_osm_id": 1878660},
    "omsk_oblast":          {"name": "Омская область",                   "osm_id": 140292,  "capital": "Омск",                  "capital_osm_id": 1878670},
    "orenburg_oblast":      {"name": "Оренбургская область",             "osm_id": 77669,   "capital": "Оренбург",              "capital_osm_id": 1734870},
    "oryol_oblast":         {"name": "Орловская область",                "osm_id": 72224,   "capital": "Орёл",                  "capital_osm_id": 1691940},
    "penza_oblast":         {"name": "Пензенская область",               "osm_id": 72182,   "capital": "Пенза",                 "capital_osm_id": 1691950},
    "perm_krai":            {"name": "Пермский край",                    "osm_id": 115135,  "capital": "Пермь",                 "capital_osm_id": 1734880},
    "primorsky_krai":       {"name": "Приморский край",                  "osm_id": 151222,  "capital": "Владивосток",           "capital_osm_id": 1907830},
    "pskov_oblast":         {"name": "Псковская область",                "osm_id": 155262,  "capital": "Псков",                 "capital_osm_id": 1755840},
    "rostov_oblast":        {"name": "Ростовская область",               "osm_id": 85606,   "capital": "Ростов-на-Дону",        "capital_osm_id": 1691960},
    "ryazan_oblast":        {"name": "Рязанская область",                "osm_id": 71950,   "capital": "Рязань",                "capital_osm_id": 1691970},
    "sakhalin_oblast":      {"name": "Сахалинская область",              "osm_id": 394235,  "capital": "Южно-Сахалинск",        "capital_osm_id": None},
    "samara_oblast":        {"name": "Самарская область",                "osm_id": 72194,   "capital": "Самара",                "capital_osm_id": 1691980},
    "saratov_oblast":       {"name": "Саратовская область",              "osm_id": 72193,   "capital": "Саратов",               "capital_osm_id": 1691990},
    "sevastopol":           {"name": "Севастополь",                      "osm_id": 1574364, "capital": "Севастополь",            "capital_osm_id": 1574364},
    "smolensk_oblast":      {"name": "Смоленская область",               "osm_id": 81996,   "capital": "Смоленск",              "capital_osm_id": 1691600},
    "spb":                  {"name": "Санкт-Петербург",                  "osm_id": 337422,  "capital": "Санкт-Петербург",        "capital_osm_id": 337422},
    "stavropol_krai":       {"name": "Ставропольский край",              "osm_id": 108081,  "capital": "Ставрополь",            "capital_osm_id": 1741810},
    "sverdlovsk_oblast":    {"name": "Свердловская область",             "osm_id": 140293,  "capital": "Екатеринбург",          "capital_osm_id": 1734890},
    "tambov_oblast":        {"name": "Тамбовская область",               "osm_id": 72180,   "capital": "Тамбов",                "capital_osm_id": 1692000},
    "tatarstan":            {"name": "Республика Татарстан",             "osm_id": 79374,   "capital": "Казань",                "capital_osm_id": 1734900},
    "tomsk_oblast":         {"name": "Томская область",                  "osm_id": 140295,  "capital": "Томск",                 "capital_osm_id": 1878680},
    "tula_oblast":          {"name": "Тульская область",                 "osm_id": 81993,   "capital": "Тула",                  "capital_osm_id": 1692010},
    "tuva":                 {"name": "Республика Тыва",                  "osm_id": 145195,  "capital": "Кызыл",                 "capital_osm_id": 1878690},
    "tver_oblast":          {"name": "Тверская область",                 "osm_id": 2095259, "capital": "Тверь",                 "capital_osm_id": 1692020},
    "tyumen_oblast":        {"name": "Тюменская область",                "osm_id": 140291,  "capital": "Тюмень",                "capital_osm_id": 1734910},
    "udmurtia":             {"name": "Удмуртская Республика",            "osm_id": 115134,  "capital": "Ижевск",                "capital_osm_id": 1734920},
    "ulyanovsk_oblast":     {"name": "Ульяновская область",              "osm_id": 72192,   "capital": "Ульяновск",             "capital_osm_id": 1692030},
    "vladimir_oblast":      {"name": "Владимирская область",             "osm_id": 72197,   "capital": "Владимир",              "capital_osm_id": 1692040},
    "volgograd_oblast":     {"name": "Волгоградская область",            "osm_id": 77665,   "capital": "Волгоград",             "capital_osm_id": 1692050},
    "vologda_oblast":       {"name": "Вологодская область",              "osm_id": 115106,  "capital": "Вологда",               "capital_osm_id": 1755850},
    "voronezh_oblast":      {"name": "Воронежская область",              "osm_id": 72181,   "capital": "Воронеж",               "capital_osm_id": 1692060},
    "north_ossetia":        {"name": "Северная Осетия — Алания",         "osm_id": 110032,  "capital": "Владикавказ",           "capital_osm_id": 1741820},
    "yakutia":              {"name": "Республика Саха (Якутия)",         "osm_id": 151231,  "capital": "Якутск",                "capital_osm_id": None},
    "yamal_ao":             {"name": "Ямало-Ненецкий АО",                "osm_id": 191706,  "capital": "Салехард",               "capital_osm_id": None},
    "yaroslavl_oblast":     {"name": "Ярославская область",              "osm_id": 81994,   "capital": "Ярославль",             "capital_osm_id": 1692070},
    "zabaykalsky_krai":     {"name": "Забайкальский край",               "osm_id": 145730,  "capital": "Чита",                  "capital_osm_id": 1907840},
    "adygea":               {"name": "Республика Адыгея",                "osm_id": 253256,  "capital": "Майкоп",                "capital_osm_id": None},
}


def fetch_boundary_geojson(osm_relation_id: int, name: str) -> dict | None:
    """Скачивает контур из OSM Overpass API и возвращает GeoJSON FeatureCollection."""
    query = f"""
[out:json][timeout:120];
relation({osm_relation_id});
out geom;
"""
    log.info(f"  Запрос Overpass для {name} (relation/{osm_relation_id})...")
    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        log.error(f"  ❌ Ошибка запроса: {e}")
        return None

    elements = data.get("elements", [])
    if not elements:
        log.warning(f"  ⚠️  Нет данных для relation/{osm_relation_id}")
        return None

    # Собираем все outer ways в полигон
    relation = elements[0]
    members = relation.get("members", [])

    outer_rings = []
    for member in members:
        if member.get("role") == "outer" and member.get("type") == "way":
            geom = member.get("geometry", [])
            if geom:
                ring = [[pt["lon"], pt["lat"]] for pt in geom]
                outer_rings.append(ring)

    if not outer_rings:
        log.warning(f"  ⚠️  Не найдены outer ways для {name}")
        return None

    # Пытаемся собрать кольца в полигоны
    try:
        from shapely.ops import polygonize
        from shapely.geometry import LineString

        lines = [LineString(r) for r in outer_rings]
        polys = list(polygonize(lines))

        if polys:
            merged = unary_union(polys)
        else:
            # Fallback: каждое кольцо — отдельный полигон
            polys = []
            for ring in outer_rings:
                if len(ring) >= 4:
                    # Замыкаем кольцо если нужно
                    if ring[0] != ring[-1]:
                        ring.append(ring[0])
                    try:
                        p = Polygon(ring)
                        if p.is_valid:
                            polys.append(p)
                        else:
                            polys.append(p.buffer(0))
                    except Exception:
                        pass
            merged = unary_union(polys) if polys else None

        if merged is None or merged.is_empty:
            log.warning(f"  ⚠️  Не удалось собрать полигон для {name}")
            return None

    except Exception as e:
        log.error(f"  ❌ Ошибка сборки полигона: {e}")
        return None

    feature = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {
                "name": name,
                "osm_relation_id": osm_relation_id,
            },
            "geometry": mapping(merged),
        }],
    }

    return feature


def save_geojson(data: dict, filepath: str):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size_kb = os.path.getsize(filepath) / 1024
    log.info(f"  ✅ Сохранено: {filepath} ({size_kb:.0f} КБ)")


def download_region(region_id: str, info: dict, download_capital: bool = True):
    """Скачивает контур региона и его столицы."""
    # Регион
    region_file = os.path.join(OUTPUT_DIR, f"{region_id}.geojson")
    if os.path.exists(region_file):
        log.info(f"  ⏭️  {info['name']} — уже скачан")
    else:
        geojson = fetch_boundary_geojson(info["osm_id"], info["name"])
        if geojson:
            save_geojson(geojson, region_file)
        else:
            log.error(f"  ❌ Не удалось скачать {info['name']}")

    # Столица
    if download_capital and info.get("capital_osm_id"):
        capital_file = os.path.join(OUTPUT_DIR, f"{region_id}_capital.geojson")
        if os.path.exists(capital_file):
            log.info(f"  ⏭️  {info['capital']} — уже скачан")
        else:
            geojson = fetch_boundary_geojson(info["capital_osm_id"], info["capital"])
            if geojson:
                save_geojson(geojson, capital_file)
            # Пауза чтобы не перегружать Overpass
            time.sleep(3)

    # Пауза между регионами
    time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description="Скачивание контуров субъектов РФ из OSM")
    parser.add_argument("--id", help="ID конкретного региона (например, vladimir_oblast)")
    parser.add_argument("--list", action="store_true", help="Показать список регионов")
    parser.add_argument("--no-capitals", action="store_true", help="Не скачивать контуры столиц")
    args = parser.parse_args()

    if args.list:
        print(f"\n{'ID':<30} {'Название':<40} {'Столица'}")
        print("-" * 100)
        for rid, info in sorted(REGIONS.items()):
            print(f"{rid:<30} {info['name']:<40} {info['capital']}")
        print(f"\nВсего: {len(REGIONS)} регионов")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if args.id:
        if args.id not in REGIONS:
            log.error(f"Регион '{args.id}' не найден. Используйте --list для списка.")
            sys.exit(1)
        download_region(args.id, REGIONS[args.id], not args.no_capitals)
    else:
        log.info(f"Скачивание контуров {len(REGIONS)} регионов...")
        log.info("⚠️  Это займёт ~30-60 мин из-за лимитов Overpass API")
        for i, (rid, info) in enumerate(sorted(REGIONS.items()), 1):
            log.info(f"\n[{i}/{len(REGIONS)}] {info['name']}")
            download_region(rid, info, not args.no_capitals)

    log.info("\n✅ Готово!")


if __name__ == "__main__":
    main()
