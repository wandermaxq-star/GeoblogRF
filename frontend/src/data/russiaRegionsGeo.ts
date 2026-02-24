/**
 * Географические данные регионов России для SVG-карты офлайн загрузок.
 * Центры регионов, федеральные округа, приблизительные площади.
 */

export type FederalDistrict = 'ЦФО' | 'СЗФО' | 'ЮФО' | 'СКФО' | 'ПФО' | 'УФО' | 'СФО' | 'ДФО';

export interface RegionGeo {
  /** [longitude, latitude] — приблизительный географический центр */
  center: [number, number];
  /** Федеральный округ */
  federalDistrict: FederalDistrict;
  /** Приблизительная площадь в км² — для масштабирования кругов */
  area: number;
  /** Короткое название для подписи на карте */
  label: string;
  /** Название столицы/административного центра */
  capital: string;
  /** [longitude, latitude] координаты столицы */
  capitalCoords: [number, number];
}

// ── Цвета федеральных округов ────────────────────────────────────────
export const FD_COLORS: Record<FederalDistrict, string> = {
  'ЦФО': '#43A047',   // зелёный
  'СЗФО': '#1E88E5',  // синий
  'ЮФО': '#FB8C00',   // оранжевый
  'СКФО': '#8E24AA',  // фиолетовый
  'ПФО': '#FDD835',   // жёлтый
  'УФО': '#00897B',   // бирюзовый
  'СФО': '#6D4C41',   // коричневый
  'ДФО': '#546E7A',   // серо-синий
};

export const FD_NAMES: Record<FederalDistrict, string> = {
  'ЦФО': 'Центральный ФО',
  'СЗФО': 'Северо-Западный ФО',
  'ЮФО': 'Южный ФО',
  'СКФО': 'Северо-Кавказский ФО',
  'ПФО': 'Приволжский ФО',
  'УФО': 'Уральский ФО',
  'СФО': 'Сибирский ФО',
  'ДФО': 'Дальневосточный ФО',
};

/** Порядок ФО для списка */
export const FD_ORDER: FederalDistrict[] = [
  'ЦФО', 'СЗФО', 'ЮФО', 'СКФО', 'ПФО', 'УФО', 'СФО', 'ДФО',
];

// ── Проекция geo → SVG: Albers Equal-Area Conic ─────────────────────
// Параметры — зеркало generate_svg_paths.py, менять синхронно!
import { SVG_WIDTH, SVG_HEIGHT, ALBERS_BOUNDS } from './russiaRegionsPaths';

const DEG2RAD = Math.PI / 180;
const _PHI1 = 52 * DEG2RAD;   // стандартная параллель 1
const _PHI2 = 64 * DEG2RAD;   // стандартная параллель 2
const _PHI0 = 56 * DEG2RAD;   // широта начала
const _LAM0 = 100 * DEG2RAD;  // центральный меридиан

const _n = (Math.sin(_PHI1) + Math.sin(_PHI2)) / 2;
const _C = Math.cos(_PHI1) ** 2 + 2 * _n * Math.sin(_PHI1);
const _rho0 = Math.sqrt(Math.abs(_C - 2 * _n * Math.sin(_PHI0))) / _n;

/** Проекция [lon, lat] → [x, y] в пространстве SVG viewBox 0 0 SVG_WIDTH SVG_HEIGHT.
 *  Используется Albers Equal-Area Conic (атласная проекция РФ). */
export function projectToSvg(lon: number, lat: number): [number, number] {
  const lam = lon * DEG2RAD;
  const phi = lat * DEG2RAD;
  const theta = _n * (lam - _LAM0);
  const rho = Math.sqrt(Math.abs(_C - 2 * _n * Math.sin(phi))) / _n;
  const ax = rho * Math.sin(theta);
  const ay = _rho0 - rho * Math.cos(theta);

  const b = ALBERS_BOUNDS;
  const xRange = b.xmax - b.xmin;
  const yRange = b.ymax - b.ymin;
  const scale = Math.min(SVG_WIDTH / xRange, SVG_HEIGHT / yRange);
  const cx = (b.xmin + b.xmax) / 2;
  const cy = (b.ymin + b.ymax) / 2;

  const x = SVG_WIDTH / 2 + (ax - cx) * scale;
  const y = SVG_HEIGHT / 2 - (ay - cy) * scale; // Y flipped: north = top
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/** Радиус круга региона по площади (логарифмическая шкала) */
export function getRegionRadius(area: number): number {
  if (area < 2000) return 3;
  if (area < 8000) return 5;
  if (area < 25000) return 7;
  if (area < 55000) return 9;
  if (area < 120000) return 11;
  if (area < 300000) return 13;
  if (area < 700000) return 16;
  return 19;
}

// ── Географические данные регионов ───────────────────────────────────
export const REGIONS_GEO: Record<string, RegionGeo> = {
  // ═══ ЦФО ═══
  moscow_city:       { center: [37.62, 55.76], federalDistrict: 'ЦФО', area: 2561,   label: 'Москва',              capital: 'Москва',           capitalCoords: [37.62, 55.76] },
  moscow_oblast:     { center: [38.2, 55.3],   federalDistrict: 'ЦФО', area: 44329,  label: 'Московская обл.',     capital: 'Красногорск',      capitalCoords: [37.33, 55.82] },
  belgorod_oblast:   { center: [37.0, 50.8],   federalDistrict: 'ЦФО', area: 27134,  label: 'Белгородская обл.',   capital: 'Белгород',         capitalCoords: [36.59, 50.60] },
  bryansk_oblast:    { center: [33.5, 53.0],   federalDistrict: 'ЦФО', area: 34857,  label: 'Брянская обл.',       capital: 'Брянск',           capitalCoords: [34.36, 53.24] },
  vladimir_oblast:   { center: [40.6, 56.3],   federalDistrict: 'ЦФО', area: 29084,  label: 'Владимирская обл.',   capital: 'Владимир',         capitalCoords: [40.41, 56.13] },
  voronezh_oblast:   { center: [40.0, 51.3],   federalDistrict: 'ЦФО', area: 52216,  label: 'Воронежская обл.',    capital: 'Воронеж',          capitalCoords: [39.20, 51.66] },
  ivanovo_oblast:    { center: [41.5, 57.1],   federalDistrict: 'ЦФО', area: 21437,  label: 'Ивановская обл.',     capital: 'Иваново',          capitalCoords: [40.97, 56.99] },
  kaluga_oblast:     { center: [35.8, 54.3],   federalDistrict: 'ЦФО', area: 29777,  label: 'Калужская обл.',      capital: 'Калуга',           capitalCoords: [36.27, 54.51] },
  kostroma_oblast:   { center: [43.5, 58.2],   federalDistrict: 'ЦФО', area: 60211,  label: 'Костромская обл.',    capital: 'Кострома',         capitalCoords: [40.93, 57.77] },
  kursk_oblast:      { center: [36.5, 51.7],   federalDistrict: 'ЦФО', area: 29997,  label: 'Курская обл.',        capital: 'Курск',            capitalCoords: [36.19, 51.73] },
  lipetsk_oblast:    { center: [39.5, 52.5],   federalDistrict: 'ЦФО', area: 24047,  label: 'Липецкая обл.',       capital: 'Липецк',           capitalCoords: [39.57, 52.61] },
  oryol_oblast:      { center: [36.3, 52.8],   federalDistrict: 'ЦФО', area: 24652,  label: 'Орловская обл.',      capital: 'Орёл',             capitalCoords: [36.06, 52.97] },
  ryazan_oblast:     { center: [40.5, 54.5],   federalDistrict: 'ЦФО', area: 39605,  label: 'Рязанская обл.',      capital: 'Рязань',           capitalCoords: [39.72, 54.63] },
  smolensk_oblast:   { center: [32.5, 55.0],   federalDistrict: 'ЦФО', area: 49779,  label: 'Смоленская обл.',     capital: 'Смоленск',         capitalCoords: [32.05, 54.78] },
  tambov_oblast:     { center: [41.5, 52.5],   federalDistrict: 'ЦФО', area: 34462,  label: 'Тамбовская обл.',     capital: 'Тамбов',           capitalCoords: [41.43, 52.72] },
  tver_oblast:       { center: [35.5, 57.0],   federalDistrict: 'ЦФО', area: 84201,  label: 'Тверская обл.',       capital: 'Тверь',            capitalCoords: [35.89, 56.86] },
  tula_oblast:       { center: [37.6, 54.0],   federalDistrict: 'ЦФО', area: 25679,  label: 'Тульская обл.',       capital: 'Тула',             capitalCoords: [37.62, 54.19] },
  yaroslavl_oblast:  { center: [39.5, 57.7],   federalDistrict: 'ЦФО', area: 36177,  label: 'Ярославская обл.',    capital: 'Ярославль',        capitalCoords: [39.89, 57.63] },

  // ═══ СЗФО ═══
  spb:               { center: [30.3, 59.9],   federalDistrict: 'СЗФО', area: 1439,   label: 'СПб',                 capital: 'Санкт-Петербург',  capitalCoords: [30.32, 59.94] },
  leningrad_oblast:  { center: [30.5, 60.5],   federalDistrict: 'СЗФО', area: 83908,  label: 'Ленинградская обл.',  capital: 'Гатчина',          capitalCoords: [30.13, 59.57] },
  arkhangelsk_oblast:{ center: [42.0, 63.5],   federalDistrict: 'СЗФО', area: 589913, label: 'Архангельская обл.',  capital: 'Архангельск',      capitalCoords: [40.54, 64.54] },
  vologda_oblast:    { center: [39.5, 59.5],   federalDistrict: 'СЗФО', area: 144527, label: 'Вологодская обл.',    capital: 'Вологда',          capitalCoords: [39.88, 59.22] },
  kaliningrad_oblast:{ center: [20.5, 54.7],   federalDistrict: 'СЗФО', area: 15125,  label: 'Калинингр. обл.',     capital: 'Калининград',      capitalCoords: [20.51, 54.71] },
  karelia:           { center: [33.0, 63.5],   federalDistrict: 'СЗФО', area: 180520, label: 'Карелия',             capital: 'Петрозаводск',     capitalCoords: [34.35, 61.79] },
  komi:              { center: [55.0, 63.0],   federalDistrict: 'СЗФО', area: 416774, label: 'Коми',                capital: 'Сыктывкар',        capitalCoords: [50.84, 61.67] },
  murmansk_oblast:   { center: [35.0, 68.5],   federalDistrict: 'СЗФО', area: 144900, label: 'Мурманская обл.',     capital: 'Мурманск',         capitalCoords: [33.09, 68.97] },
  nenets_ao:         { center: [53.0, 68.0],   federalDistrict: 'СЗФО', area: 176810, label: 'НАО',                 capital: 'Нарьян-Мар',       capitalCoords: [53.09, 67.64] },
  novgorod_oblast:   { center: [31.5, 58.3],   federalDistrict: 'СЗФО', area: 55300,  label: 'Новгородская обл.',   capital: 'Великий Новгород', capitalCoords: [31.28, 58.52] },
  pskov_oblast:      { center: [29.5, 57.0],   federalDistrict: 'СЗФО', area: 55300,  label: 'Псковская обл.',      capital: 'Псков',            capitalCoords: [28.33, 57.82] },

  // ═══ ЮФО ═══
  krasnodar_krai:    { center: [39.5, 45.5],   federalDistrict: 'ЮФО', area: 75485,  label: 'Краснодарский край',   capital: 'Краснодар',         capitalCoords: [38.98, 45.04] },
  adygea:            { center: [40.2, 44.8],   federalDistrict: 'ЮФО', area: 7792,   label: 'Адыгея',               capital: 'Майкоп',            capitalCoords: [40.10, 44.61] },
  astrakhan_oblast:  { center: [47.5, 46.5],   federalDistrict: 'ЮФО', area: 49024,  label: 'Астраханская обл.',    capital: 'Астрахань',         capitalCoords: [48.03, 46.35] },
  volgograd_oblast:  { center: [43.5, 49.5],   federalDistrict: 'ЮФО', area: 112877, label: 'Волгоградская обл.',   capital: 'Волгоград',         capitalCoords: [44.51, 48.71] },
  kalmykia:          { center: [45.0, 46.0],   federalDistrict: 'ЮФО', area: 74731,  label: 'Калмыкия',             capital: 'Элиста',            capitalCoords: [44.27, 46.31] },
  crimea:            { center: [34.0, 45.0],   federalDistrict: 'ЮФО', area: 26081,  label: 'Крым',                 capital: 'Симферополь',        capitalCoords: [34.10, 44.95] },
  rostov_oblast:     { center: [40.0, 47.5],   federalDistrict: 'ЮФО', area: 100967, label: 'Ростовская обл.',      capital: 'Ростов-на-Дону',    capitalCoords: [39.72, 47.24] },
  sevastopol:        { center: [33.5, 44.5],   federalDistrict: 'ЮФО', area: 864,    label: 'Севастополь',          capital: 'Севастополь',        capitalCoords: [33.52, 44.60] },

  // ═══ СКФО ═══
  stavropol_krai:    { center: [43.0, 44.5],   federalDistrict: 'СКФО', area: 66500, label: 'Ставропольский край',  capital: 'Ставрополь',        capitalCoords: [41.97, 45.04] },
  dagestan:          { center: [47.0, 43.0],   federalDistrict: 'СКФО', area: 50270, label: 'Дагестан',             capital: 'Махачкала',          capitalCoords: [47.50, 42.98] },
  ingushetia:        { center: [44.8, 43.2],   federalDistrict: 'СКФО', area: 3628,  label: 'Ингушетия',            capital: 'Магас',              capitalCoords: [44.81, 43.17] },
  kabardino_balkaria:{ center: [43.5, 43.5],   federalDistrict: 'СКФО', area: 12470, label: 'КБР',                  capital: 'Нальчик',           capitalCoords: [43.49, 43.50] },
  karachay_cherkessia:{ center: [42.0, 43.7],  federalDistrict: 'СКФО', area: 14277, label: 'КЧР',                  capital: 'Черкесск',          capitalCoords: [42.06, 44.23] },
  north_ossetia:     { center: [44.2, 43.0],   federalDistrict: 'СКФО', area: 7987,  label: 'С. Осетия',            capital: 'Владикавказ',       capitalCoords: [44.67, 43.02] },
  chechnya:          { center: [45.7, 43.3],   federalDistrict: 'СКФО', area: 15647, label: 'Чечня',                capital: 'Грозный',           capitalCoords: [45.69, 43.32] },

  // ═══ ПФО ═══
  bashkortostan:     { center: [56.5, 54.5],   federalDistrict: 'ПФО', area: 142947, label: 'Башкирия',             capital: 'Уфа',              capitalCoords: [55.97, 54.73] },
  kirov_oblast:      { center: [50.0, 58.5],   federalDistrict: 'ПФО', area: 120374, label: 'Кировская обл.',       capital: 'Киров',            capitalCoords: [49.66, 58.60] },
  mari_el:           { center: [48.0, 56.7],   federalDistrict: 'ПФО', area: 23375,  label: 'Марий Эл',             capital: 'Йошкар-Ола',       capitalCoords: [47.89, 56.63] },
  mordovia:          { center: [44.5, 54.2],   federalDistrict: 'ПФО', area: 26128,  label: 'Мордовия',             capital: 'Саранск',          capitalCoords: [45.18, 54.19] },
  nizhny_novgorod_oblast: { center: [44.0, 56.2], federalDistrict: 'ПФО', area: 76624, label: 'Нижегородская обл.', capital: 'Нижний Новгород', capitalCoords: [43.99, 56.33] },
  orenburg_oblast:   { center: [55.0, 51.8],   federalDistrict: 'ПФО', area: 123702, label: 'Оренбургская обл.',    capital: 'Оренбург',         capitalCoords: [55.10, 51.77] },
  penza_oblast:      { center: [44.5, 53.2],   federalDistrict: 'ПФО', area: 43352,  label: 'Пензенская обл.',      capital: 'Пенза',            capitalCoords: [45.02, 53.19] },
  perm_krai:         { center: [56.0, 58.5],   federalDistrict: 'ПФО', area: 160236, label: 'Пермский край',        capital: 'Пермь',            capitalCoords: [56.25, 58.01] },
  samara_oblast:     { center: [50.5, 53.3],   federalDistrict: 'ПФО', area: 53565,  label: 'Самарская обл.',       capital: 'Самара',           capitalCoords: [50.15, 53.20] },
  saratov_oblast:    { center: [46.5, 51.8],   federalDistrict: 'ПФО', area: 101240, label: 'Саратовская обл.',     capital: 'Саратов',          capitalCoords: [46.03, 51.53] },
  tatarstan:         { center: [50.0, 55.5],   federalDistrict: 'ПФО', area: 67847,  label: 'Татарстан',            capital: 'Казань',           capitalCoords: [49.11, 55.79] },
  udmurtia:          { center: [53.0, 57.0],   federalDistrict: 'ПФО', area: 42061,  label: 'Удмуртия',             capital: 'Ижевск',           capitalCoords: [53.23, 56.85] },
  ulyanovsk_oblast:  { center: [48.0, 54.0],   federalDistrict: 'ПФО', area: 37181,  label: 'Ульяновская обл.',     capital: 'Ульяновск',        capitalCoords: [48.40, 54.31] },
  chuvashia:         { center: [47.0, 55.8],   federalDistrict: 'ПФО', area: 18343,  label: 'Чувашия',              capital: 'Чебоксары',        capitalCoords: [47.25, 56.13] },

  // ═══ УФО ═══
  kurgan_oblast:     { center: [64.5, 55.3],   federalDistrict: 'УФО', area: 71488,  label: 'Курганская обл.',      capital: 'Курган',           capitalCoords: [65.33, 55.44] },
  sverdlovsk_oblast: { center: [61.0, 57.0],   federalDistrict: 'УФО', area: 194307, label: 'Свердловская обл.',    capital: 'Екатеринбург',     capitalCoords: [60.60, 56.84] },
  tyumen_oblast:     { center: [68.0, 58.0],   federalDistrict: 'УФО', area: 160122, label: 'Тюменская обл.',       capital: 'Тюмень',           capitalCoords: [68.25, 57.15] },
  chelyabinsk_oblast:{ center: [60.5, 54.7],   federalDistrict: 'УФО', area: 87900,  label: 'Челябинская обл.',     capital: 'Челябинск',        capitalCoords: [61.40, 55.15] },
  khanty_mansi_ao:   { center: [71.0, 62.0],   federalDistrict: 'УФО', area: 534801, label: 'ХМАО',                 capital: 'Ханты-Мансийск',   capitalCoords: [69.00, 61.00] },
  yamal_ao:          { center: [70.0, 68.0],   federalDistrict: 'УФО', area: 769250, label: 'ЯНАО',                 capital: 'Салехард',          capitalCoords: [66.60, 66.53] },

  // ═══ СФО ═══
  altai_republic:    { center: [86.5, 50.5],   federalDistrict: 'СФО', area: 92903,  label: 'Р. Алтай',             capital: 'Горно-Алтайск',    capitalCoords: [85.96, 51.96] },
  altai_krai:        { center: [83.0, 52.5],   federalDistrict: 'СФО', area: 167996, label: 'Алтайский край',       capital: 'Барнаул',          capitalCoords: [83.76, 53.35] },
  irkutsk_oblast:    { center: [106.0, 55.5],  federalDistrict: 'СФО', area: 774846, label: 'Иркутская обл.',       capital: 'Иркутск',          capitalCoords: [104.28, 52.29] },
  kemerovo_oblast:   { center: [86.5, 54.5],   federalDistrict: 'СФО', area: 95725,  label: 'Кемеровская обл.',     capital: 'Кемерово',         capitalCoords: [86.09, 55.35] },
  krasnoyarsk_krai:  { center: [95.0, 64.0],   federalDistrict: 'СФО', area: 2366797,label: 'Красноярский край',    capital: 'Красноярск',       capitalCoords: [92.87, 56.01] },
  novosibirsk_oblast:{ center: [79.5, 55.0],   federalDistrict: 'СФО', area: 177756, label: 'Новосибирская обл.',   capital: 'Новосибирск',      capitalCoords: [82.92, 55.03] },
  omsk_oblast:       { center: [73.5, 55.5],   federalDistrict: 'СФО', area: 141140, label: 'Омская обл.',          capital: 'Омск',             capitalCoords: [73.37, 54.99] },
  tomsk_oblast:      { center: [82.0, 58.5],   federalDistrict: 'СФО', area: 314391, label: 'Томская обл.',         capital: 'Томск',            capitalCoords: [84.97, 56.49] },
  tuva:              { center: [95.0, 51.5],   federalDistrict: 'СФО', area: 168604, label: 'Тыва',                 capital: 'Кызыл',            capitalCoords: [94.44, 51.72] },
  khakassia:         { center: [90.0, 53.5],   federalDistrict: 'СФО', area: 61569,  label: 'Хакасия',              capital: 'Абакан',           capitalCoords: [91.43, 53.72] },

  // ═══ ДФО ═══
  amur_oblast:       { center: [129.0, 53.0],  federalDistrict: 'ДФО', area: 361908, label: 'Амурская обл.',        capital: 'Благовещенск',     capitalCoords: [127.54, 50.29] },
  buryatia:          { center: [111.0, 53.0],  federalDistrict: 'ДФО', area: 351334, label: 'Бурятия',              capital: 'Улан-Удэ',         capitalCoords: [107.59, 51.83] },
  jewish_ao:         { center: [132.5, 48.5],  federalDistrict: 'ДФО', area: 36271,  label: 'ЕАО',                  capital: 'Биробиджан',       capitalCoords: [132.93, 48.79] },
  zabaykalsky_krai:  { center: [116.0, 52.5],  federalDistrict: 'ДФО', area: 431892, label: 'Забайкальский край',   capital: 'Чита',             capitalCoords: [113.50, 52.03] },
  kamchatka_krai:    { center: [159.0, 56.0],  federalDistrict: 'ДФО', area: 464275, label: 'Камчатский край',      capital: 'Петропавловск-Камч.',capitalCoords: [158.65, 53.01] },
  magadan_oblast:    { center: [152.0, 62.0],  federalDistrict: 'ДФО', area: 462464, label: 'Магаданская обл.',     capital: 'Магадан',           capitalCoords: [150.80, 59.56] },
  primorsky_krai:    { center: [134.0, 44.5],  federalDistrict: 'ДФО', area: 164673, label: 'Приморский край',      capital: 'Владивосток',       capitalCoords: [131.89, 43.12] },
  sakhalin_oblast:   { center: [143.0, 50.0],  federalDistrict: 'ДФО', area: 87101,  label: 'Сахалинская обл.',     capital: 'Южно-Сахалинск',    capitalCoords: [142.74, 46.96] },
  khabarovsk_krai:   { center: [135.0, 54.0],  federalDistrict: 'ДФО', area: 787633, label: 'Хабаровский край',     capital: 'Хабаровск',         capitalCoords: [135.07, 48.48] },
  chukotka_ao:       { center: [171.0, 66.0],  federalDistrict: 'ДФО', area: 721481, label: 'Чукотка',              capital: 'Анадырь',           capitalCoords: [177.51, 64.73] },
  yakutia:           { center: [127.0, 65.0],  federalDistrict: 'ДФО', area: 3083523,label: 'Якутия',               capital: 'Якутск',            capitalCoords: [129.73, 62.03] },
};

// ── Регионы по ФО для списка ─────────────────────────────────────────
export const FD_REGIONS: Record<FederalDistrict, string[]> = {
  'ЦФО': [
    'moscow_city', 'moscow_oblast', 'belgorod_oblast', 'bryansk_oblast',
    'vladimir_oblast', 'voronezh_oblast', 'ivanovo_oblast', 'kaluga_oblast',
    'kostroma_oblast', 'kursk_oblast', 'lipetsk_oblast', 'oryol_oblast',
    'ryazan_oblast', 'smolensk_oblast', 'tambov_oblast', 'tver_oblast',
    'tula_oblast', 'yaroslavl_oblast',
  ],
  'СЗФО': [
    'spb', 'leningrad_oblast', 'arkhangelsk_oblast', 'vologda_oblast',
    'kaliningrad_oblast', 'karelia', 'komi', 'murmansk_oblast',
    'nenets_ao', 'novgorod_oblast', 'pskov_oblast',
  ],
  'ЮФО': [
    'krasnodar_krai', 'adygea', 'astrakhan_oblast', 'volgograd_oblast',
    'kalmykia', 'crimea', 'rostov_oblast', 'sevastopol',
  ],
  'СКФО': [
    'stavropol_krai', 'dagestan', 'ingushetia', 'kabardino_balkaria',
    'karachay_cherkessia', 'north_ossetia', 'chechnya',
  ],
  'ПФО': [
    'bashkortostan', 'kirov_oblast', 'mari_el', 'mordovia',
    'nizhny_novgorod_oblast', 'orenburg_oblast', 'penza_oblast',
    'perm_krai', 'samara_oblast', 'saratov_oblast', 'tatarstan',
    'udmurtia', 'ulyanovsk_oblast', 'chuvashia',
  ],
  'УФО': [
    'kurgan_oblast', 'sverdlovsk_oblast', 'tyumen_oblast',
    'chelyabinsk_oblast', 'khanty_mansi_ao', 'yamal_ao',
  ],
  'СФО': [
    'altai_republic', 'altai_krai', 'irkutsk_oblast', 'kemerovo_oblast',
    'krasnoyarsk_krai', 'novosibirsk_oblast', 'omsk_oblast',
    'tomsk_oblast', 'tuva', 'khakassia',
  ],
  'ДФО': [
    'amur_oblast', 'buryatia', 'jewish_ao', 'zabaykalsky_krai',
    'kamchatka_krai', 'magadan_oblast', 'primorsky_krai',
    'sakhalin_oblast', 'khabarovsk_krai', 'chukotka_ao', 'yakutia',
  ],
};

// ── Упрощённый контур России (для SVG фона) ──────────────────────────
/** Основная территория: массив [lon, lat] */
export const RUSSIA_OUTLINE: [number, number][] = [
  [28, 69.5], [32, 69.5], [37, 68], [41, 67],
  [37, 66], [36, 64.5], [38, 63.5], [42, 65],
  [48, 66], [53, 67], [58, 67.5],
  [65, 66.5], [70, 67], [70, 70], [73, 72],
  [83, 73.5], [95, 77.5], [105, 76], [115, 74],
  [125, 73], [135, 71], [145, 70.5], [158, 70],
  [170, 66], [177, 65], [172, 61], [165, 59],
  [160, 56], [162, 53], [155, 49], [143, 48],
  [135, 44], [131, 43],
  [128, 49], [121, 50], [115, 50], [108, 50],
  [100, 50], [97, 50], [91, 50], [86, 49],
  [83, 51], [73, 54], [67, 54], [61, 54],
  [55, 52], [52, 52.5], [50, 46],
  [48, 44], [46.5, 43], [44.5, 42.5],
  [42.5, 43.5], [40, 43.5], [37.5, 44],
  [36, 45.5], [34, 45], [33, 44.5], [33, 46],
  [37, 47], [39, 48.5], [39, 50], [37, 51],
  [35, 52], [32, 52.5], [28, 53],
  [27, 55], [28, 57], [28, 59.5], [30, 61],
  [29, 63], [29, 66], [28, 69.5],
];

/** Калининградская область (эксклав) */
export const KALININGRAD_OUTLINE: [number, number][] = [
  [19.5, 54.3], [22.5, 54.3], [22.5, 55.3], [20, 55.3], [19.5, 54.3],
];
