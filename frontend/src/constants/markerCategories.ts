// (file contains full implementation below) — removed temporary stub to avoid duplicate declarations
/**
 * Система категорий маркеров с цветами и иконками
 * Каждая категория имеет:
 * - key: уникальный идентификатор
 * - label: название на русском
 * - color: HEX цвет для маркера (капельки)
 * - iconName: имя файла иконки (без расширения), например "leaf" для pin-природа.png
 * - description: описание для попапа
 */

export interface MarkerCategory {
  key: string;
  label: string;
  color: string; // HEX цвет маркера
  iconName: string; // Имя файла иконки (pin-{iconName}.png)
  description?: string;
}

export const MARKER_CATEGORIES: MarkerCategory[] = [
  {
    key: 'nature',
    label: 'Природа',
    color: '#27ae60', // Зелёный
    iconName: 'nature', // pin-nature.png - зелёный листочек
    description: 'Природные объекты, парки, заповедники'
  },
  {
    key: 'restaurant',
    label: 'Ресторан',
    color: '#8B0000', // Бордовый/тёмно-красный
    iconName: 'restaurant', // pin-restaurant.png - значок ресторана/вилки
    description: 'Рестораны, кафе, бары, столовые'
  },
  {
    key: 'hotel',
    label: 'Отель',
    color: '#8e44ad', // Фиолетовый
    iconName: 'hotel', // pin-hotel.png - значок отеля/кровати
    description: 'Отели, хостелы, гостевые дома'
  },
  {
    key: 'attraction',
    label: 'Достопримечательность',
    color: '#3498db', // Синий
    iconName: 'attraction', // pin-attraction.png - звезда
    description: 'Памятники, музеи, исторические места'
  },
  {
    key: 'culture',
    label: 'Культура',
    color: '#f1c40f', // Жёлтый
    iconName: 'culture', // pin-culture.png - достопримечательность/культура
    description: 'Театры, галереи, культурные центры'
  },
  {
    key: 'entertainment',
    label: 'Развлечения',
    color: '#f39c12', // Оранжевый
    iconName: 'entertainment', // pin-entertainment.png - развлечения/театр
    description: 'Развлекательные центры, парки аттракционов'
  },
  {
    key: 'transport',
    label: 'Транспорт',
    color: '#16a085', // Бирюзовый/тёмно-зелёный
    iconName: 'transport', // pin-transport.png - автобус/транспорт
    description: 'Остановки, вокзалы, аэропорты'
  },
  {
    key: 'shopping',
    label: 'Торговля',
    color: '#e67e22', // Тёмно-оранжевый
    iconName: 'shopping', // pin-shopping.png - кошелёк/магазин
    description: 'Магазины, торговые центры, рынки'
  },
  {
    key: 'healthcare',
    label: 'Здравоохранение',
    color: '#e74c3c', // Красный
    iconName: 'healthcare', // pin-healthcare.png - сердце/медицина
    description: 'Больницы, аптеки, медицинские центры'
  },
  {
    key: 'education',
    label: 'Образование',
    color: '#3498db', // Синий (можно другой оттенок)
    iconName: 'education', // pin-education.png - пользователи/книга
    description: 'Школы, университеты, библиотеки'
  },
  {
    key: 'service',
    label: 'Сервис',
    color: '#34495e', // Тёмно-серый
    iconName: 'service', // pin-service.png - здание/сервис
    description: 'Банки, почта, сервисные центры'
  },
  {
    key: 'event',
    label: 'Событие',
    color: '#9b59b6', // Фиолетовый
    iconName: 'event', // pin-event.png - календарь
    description: 'События, фестивали, мероприятия'
  },

  {
    key: 'route',
    label: 'Маршрут',
    color: '#f39c12', // Оранжевый
    iconName: 'route', // pin-route.png - маршрут
    description: 'Точки маршрутов'
  },
  {
    key: 'other',
    label: 'Другое',
    color: '#7f8c8d', // Серый
    iconName: 'other', // pin-other.png - вопрос
    description: 'Прочие места'
  },
  {
    key: 'user_poi',
    label: 'Пользовательские',
    color: '#e67e22', // Оранжево-коричневый
    iconName: 'user', // pin-user.png - метка пользователя
    description: 'Пользовательские метки'
  }
];

/**
 * Получить категорию по ключу
 */
export function getCategoryByKey(key: string): MarkerCategory | undefined {
  return MARKER_CATEGORIES.find(cat => cat.key === key);
}

/**
 * Получить цвет категории
 */
export function getCategoryColor(key: string): string {
  const category = getCategoryByKey(key);
  return category?.color || '#7f8c8d'; // default grey
}

/**
 * Получить путь к иконке маркера
 */
export function getMarkerIconPath(key: string): string {
  const category = getCategoryByKey(key);
  const iconName = category?.iconName || 'other';
  return `/markers/pin-${iconName}.png`;
}

/**
 * Получить путь к иконке для попапа (может отличаться)
 */
export function getPopupIconPath(key: string): string {
  const category = getCategoryByKey(key);
  const iconName = category?.iconName || 'other';
  return `/markers/popup-${iconName}.png`;
}

/**
 * Получить имя FontAwesome иконки для категории (для попапов)
 * Все иконки уникальны для каждой категории
 */
export function getFontAwesomeIconName(key: string): string {
  const iconMap: { [key: string]: string } = {
    'nature': 'fa-leaf',
    'restaurant': 'fa-utensils',
    'hotel': 'fa-hotel',
    'attraction': 'fa-star',
    'culture': 'fa-landmark',
    'entertainment': 'fa-gem',
    'transport': 'fa-bus',
    'shopping': 'fa-wallet',
    'healthcare': 'fa-heart',
    'education': 'fa-users',
    'service': 'fa-building', // Здание для банков, почты, сервисных центров
    'event': 'fa-calendar-check',
    
    'route': 'fa-route',
    'other': 'fa-question', // Вопрос для "Другое"
    'user_poi': 'fa-map-pin'
  };
  return iconMap[key] || 'fa-map-marker-alt';
}

/**
 * Преобразует текстовое название типа/категории в ключ категории
 * Используется для маппинга данных из избранного (где type может быть "Достопримечательность")
 * в ключи категорий (например, "attraction")
 */
export function normalizeCategoryKey(typeOrCategory: string | undefined | null): string {
  if (!typeOrCategory) return 'other';
  
  const normalized = typeOrCategory.toLowerCase().trim();
  
  // Маппинг русских названий на ключи категорий
  const russianToKey: { [key: string]: string } = {
    'природа': 'nature',
    'природный объект': 'nature',
    'парк': 'nature',
    'заповедник': 'nature',
    'ресторан': 'restaurant',
    'кафе': 'restaurant',
    'бар': 'restaurant',
    'столовая': 'restaurant',
    'отель': 'hotel',
    'гостиница': 'hotel',
    'хостел': 'hotel',
    'достопримечательность': 'attraction',
    'памятник': 'attraction',
    'историческое место': 'attraction',
    'площадь': 'attraction',
    'красная площадь': 'attraction',
    'музей': 'culture',
    'культура': 'culture',
    'культурный центр': 'culture',
    'театр': 'culture',
    'галерея': 'culture',
    'развлечения': 'entertainment',
    'развлекательный центр': 'entertainment',
    'транспорт': 'transport',
    'остановка': 'transport',
    'вокзал': 'transport',
    'аэропорт': 'transport',
    'торговля': 'shopping',
    'магазин': 'shopping',
    'торговый центр': 'shopping',
    'рынок': 'shopping',
    'здравоохранение': 'healthcare',
    'больница': 'healthcare',
    'аптека': 'healthcare',
    'медицинский центр': 'healthcare',
    'образование': 'education',
    'школа': 'education',
    'университет': 'education',
    'библиотека': 'education',
    'сервис': 'service',
    'банк': 'service',
    'почта': 'service',
    'сервисный центр': 'service',
    'событие': 'event',
    'мероприятие': 'event',
    
    'маршрут': 'route',
    'другое': 'other',
    'прочее': 'other'
  };
  
  // Сначала проверяем русские названия
  if (russianToKey[normalized]) {
    return russianToKey[normalized];
  }
  
  // Если это уже ключ категории - возвращаем как есть
  if (MARKER_CATEGORIES.some(cat => cat.key === normalized)) {
    return normalized;
  }
  
  // Пытаемся найти по частичному совпадению
  for (const [russian, key] of Object.entries(russianToKey)) {
    if (normalized.includes(russian) || russian.includes(normalized)) {
      return key;
    }
  }
  
  // Если ничего не найдено - возвращаем 'other'
  return 'other';
}

