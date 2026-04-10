// Static presets for curated route packs used by ProPage MVP and backend API

// NOTE: this file mirrors frontend/src/data/proRoutePacks.ts and is intentionally
// duplicated for now. When a proper database is available, these objects will be
// migrated into a table and this module will become just a loader.

export default [
  {
    id: 'golden-ring',
    slug: 'golden-ring-russia',
    title: 'Золотое кольцо России',
    subtitle: 'Исторические города с готовым оффлайн-сценарием поездки',
    summary: 'Маршрут для тех, кто хочет заранее собрать оффлайн-пакет по главным историческим городам и не скачивать лишние области целиком.',
    routeKind: 'federal',
    regions: ['moscow_oblast', 'vladimir_oblast', 'ivanovo_oblast', 'kostroma_oblast', 'yaroslavl_oblast'],
    highlight: 'Маршрут федерального масштаба с понятной ценностью для Premium.',
    heroMetric: '5 ключевых городов в базовой версии',
    tags: ['федеральный маршрут', 'история', 'города России'],
    variants: [
      {
        id: 'golden-ring-classic',
        title: 'Классическая дуга',
        summary: 'Базовая версия с историческими городами, которые пользователь чаще всего ожидает увидеть в первом знакомстве с маршрутом.',
        durationLabel: '2-4 дня',
        distanceLabel: '≈ 780 км',
        estimatedBaseSizeMb: 18,
        recommendedNights: '2-3 ночи',
        waypoints: [
          { id: 'moscow-start', title: 'Старт из Москвы', regionId: 'moscow_oblast', coordinates: [55.7558, 37.6176], kind: 'city', isRequired: true, isDefaultEnabled: true, estimatedTileWeightMb: 6, note: 'Точка старта и логистический узел.' },
          { id: 'vladimir', title: 'Владимир', regionId: 'vladimir_oblast', coordinates: [56.129, 40.4066], kind: 'city', isRequired: true, isDefaultEnabled: true, estimatedTileWeightMb: 8, note: 'Опорный город маршрута.' },
          { id: 'suzdal', title: 'Суздаль', regionId: 'vladimir_oblast', coordinates: [56.4164, 40.4235], kind: 'city', isRequired: false, isDefaultEnabled: true, estimatedTileWeightMb: 7, note: 'Можно исключить, если нужен более лёгкий пакет.' },
          { id: 'kostroma', title: 'Кострома', regionId: 'kostroma_oblast', coordinates: [57.7679, 40.9269], kind: 'city', isRequired: true, isDefaultEnabled: true, estimatedTileWeightMb: 8, note: 'Подходит как точка событийных сценариев.' },
          { id: 'yaroslavl', title: 'Ярославль', regionId: 'yaroslavl_oblast', coordinates: [57.6261, 39.8845], kind: 'city', isRequired: true, isDefaultEnabled: true, estimatedTileWeightMb: 7, note: 'Завершение дуги по верхней Волге.' },
        ],
      },
    ],
  },
  {
    id: 'vladimir-suzdal',
    slug: 'vladimir-suzdal-weekend',
    title: 'Владимир и Суздаль',
    subtitle: 'Маршрут выходного дня без перегруза по тайлам',
    summary: 'Компактный маршрут для первого MVP: легко показать пользу, выбор города и исключение лишнего из оффлайн-пакета.',
    routeKind: 'regional',
    regions: ['vladimir_oblast'],
    highlight: 'Идеальный маршрут для демонстрации того, что важен не регион, а конкретные города внутри поездки.',
    heroMetric: 'Можно отключить Суздаль и сразу уменьшить пакет',
    tags: ['выходные', 'MVP-маршрут', 'исторические города'],
    variants: [
      {
        id: 'vladimir-suzdal-base',
        title: 'Базовый уикенд',
        summary: 'Маршрут на 1-2 дня с двумя главными узлами и дорожным сценарием между ними.',
        durationLabel: '1-2 дня',
        distanceLabel: '≈ 70 км',
        estimatedBaseSizeMb: 10,
        recommendedNights: '1 ночь',
        waypoints: [
          { id: 'vladimir-main', title: 'Владимир', regionId: 'vladimir_oblast', coordinates: [56.129, 40.4066], kind: 'city', isRequired: true, isDefaultEnabled: true, estimatedTileWeightMb: 7, note: 'Основной город для навигации и ночёвки.' },
          { id: 'suzdal-main', title: 'Суздаль', regionId: 'vladimir_oblast', coordinates: [56.4164, 40.4235], kind: 'city', isRequired: false, isDefaultEnabled: true, estimatedTileWeightMb: 6, note: 'Ключевая точка, которая не должна теряться внутри области.' },
        ],
      },
    ],
  },
  {
    id: 'kostroma-event',
    slug: 'kostroma-event-journey',
    title: 'Кострома на событие',
    subtitle: 'Событийный маршрут с вариативными заездами',
    summary: 'Пакет для поездки на известное публичное событие с опциональными остановками, как у экскурсионных компаний.',
    routeKind: 'event',
    regions: ['kostroma_oblast', 'ivanovo_oblast'],
    highlight: 'Хорошая модель для будущих федеральных событийных пакетов и маршрутов гидов.',
    heroMetric: '2 вариативные остановки можно включать и отключать',
    tags: ['событие', 'вариативность', 'будущий гидовый формат'],
    variants: [
      {
        id: 'kostroma-event-flex',
        title: 'Гибкий событийный вариант',
        summary: 'Пользователь едет в Кострому и может выбрать, нужен ли заезд в Плёс или отдельная тематическая остановка.',
        durationLabel: '2-3 дня',
        distanceLabel: '≈ 340 км',
        estimatedBaseSizeMb: 16,
        recommendedNights: '1-2 ночи',
        waypoints: [
          { id: 'kostroma-anchor', title: 'Кострома', regionId: 'kostroma_oblast', coordinates: [57.7679, 40.9269], kind: 'event_anchor', isRequired: true, isDefaultEnabled: true, estimatedTileWeightMb: 8, note: 'Главная событийная точка маршрута.' },
          { id: 'ples-optional', title: 'Плёс', regionId: 'ivanovo_oblast', coordinates: [57.4607, 41.5129], kind: 'city', isRequired: false, isDefaultEnabled: true, estimatedTileWeightMb: 5, note: 'Опциональный живописный заезд.' },
          { id: 'farm-optional', title: 'Лосиная ферма', regionId: 'kostroma_oblast', coordinates: [57.899, 41.031], kind: 'poi', isRequired: false, isDefaultEnabled: false, estimatedTileWeightMb: 4, note: 'Дополнительная тематическая точка вместо перегруза городами.' },
        ],
      },
    ],
  },
];