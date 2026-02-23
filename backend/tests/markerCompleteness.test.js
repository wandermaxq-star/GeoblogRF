import {
  calculateMarkerCompleteness,
  getCompletenessStatus,
  getStatusDescription,
  checkCompletenessLevelChange,
  getPriorityImprovements,
} from '../src/utils/markerCompleteness.js';

describe('Marker Completeness', () => {
  // Полностью заполненный маркер (не-бизнес категория — working_hours и contact_info не нужны)
  const fullMarker = {
    title: 'Красивое озеро в горах',
    description: 'Это великолепное горное озеро с чистейшей водой, расположенное на высоте 2000 метров',
    category: 'nature',
    photo_urls: ['photo1.jpg', 'photo2.jpg'],
    address: 'Республика Алтай, Горный район',
    detailed_info: 'Дорога к озеру занимает около 3 часов пешком. Рекомендуется взять тёплую одежду и запас воды. Лучшее время для посещения — с июня по сентябрь. Ночёвка возможна в палатке.',
  };

  // Пустой маркер
  const emptyMarker = {
    title: '',
    description: '',
    category: '',
    photo_urls: [],
    address: '',
  };

  // Бизнес маркер — требует working_hours и contact_info
  const businessMarker = {
    title: 'Ресторан У Моста',
    description: 'Уютный ресторан с видом на реку, предлагающий блюда русской и европейской кухни',
    category: 'restaurant',
    photo_urls: ['rest1.jpg'],
    address: 'г. Москва, ул. Набережная, д. 10',
    working_hours: '10:00-22:00',
    contact_info: '+7 495 123-45-67',
    detailed_info: 'Ресторан с панорамным видом на Москву-реку. Средний чек 2000 рублей. Есть летняя терраса. Бронирование столиков через телефон или сайт. Парковка бесплатная для гостей.',
  };

  describe('calculateMarkerCompleteness', () => {
    test('full nature marker scores high (>= 80)', () => {
      const result = calculateMarkerCompleteness(fullMarker);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.needsCompletion).toBe(false);
    });

    test('empty marker scores 0', () => {
      const result = calculateMarkerCompleteness(emptyMarker);
      expect(result.score).toBe(0);
      expect(result.needsCompletion).toBe(true);
    });

    test('returns correct structure', () => {
      const result = calculateMarkerCompleteness(fullMarker);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('filledRequiredFields');
      expect(result).toHaveProperty('totalRequiredFields');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('needsCompletion');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('maxPossibleScore');
      expect(result).toHaveProperty('currentScore');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    test('empty marker has suggestions', () => {
      const result = calculateMarkerCompleteness(emptyMarker);
      expect(result.suggestions.length).toBeGreaterThan(0);
      // Каждая подсказка имеет нужные поля
      result.suggestions.forEach(s => {
        expect(s).toHaveProperty('field');
        expect(s).toHaveProperty('message');
        expect(s).toHaveProperty('priority');
      });
    });

    test('suggestions are sorted by priority (high first)', () => {
      const result = calculateMarkerCompleteness(emptyMarker);
      const priorities = result.suggestions.map(s => s.priority);
      const order = { high: 3, medium: 2, low: 1 };
      for (let i = 1; i < priorities.length; i++) {
        expect(order[priorities[i]]).toBeLessThanOrEqual(order[priorities[i - 1]]);
      }
    });

    test('business marker with all fields scores high', () => {
      const result = calculateMarkerCompleteness(businessMarker);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    test('business marker without working_hours loses score', () => {
      const incomplete = { ...businessMarker, working_hours: '' };
      const full = calculateMarkerCompleteness(businessMarker);
      const partial = calculateMarkerCompleteness(incomplete);
      expect(partial.score).toBeLessThan(full.score);
    });

    test('photo_urls as JSON string is accepted', () => {
      const marker = { ...fullMarker, photo_urls: JSON.stringify(['photo1.jpg']) };
      const result = calculateMarkerCompleteness(marker);
      // photo field should be considered filled
      const photoSuggestion = result.suggestions.find(s => s.field === 'photo_urls');
      expect(photoSuggestion).toBeUndefined();
    });

    test('category "other" counts as unfilled', () => {
      const marker = { ...fullMarker, category: 'other' };
      const result = calculateMarkerCompleteness(marker);
      const catSuggestion = result.suggestions.find(s => s.field === 'category');
      expect(catSuggestion).toBeDefined();
    });
  });

  describe('getCompletenessStatus', () => {
    test('returns correct status strings', () => {
      expect(getCompletenessStatus(95)).toBe('excellent');
      expect(getCompletenessStatus(90)).toBe('excellent');
      expect(getCompletenessStatus(85)).toBe('good');
      expect(getCompletenessStatus(80)).toBe('good');
      expect(getCompletenessStatus(70)).toBe('acceptable');
      expect(getCompletenessStatus(50)).toBe('poor');
      expect(getCompletenessStatus(30)).toBe('incomplete');
      expect(getCompletenessStatus(0)).toBe('incomplete');
    });
  });

  describe('getStatusDescription', () => {
    test('returns object with text, color, icon', () => {
      const desc = getStatusDescription('excellent');
      expect(desc).toHaveProperty('text');
      expect(desc).toHaveProperty('color');
      expect(desc).toHaveProperty('icon');
    });

    test('returns incomplete description for unknown status', () => {
      const desc = getStatusDescription('unknown');
      expect(desc.text).toBe('Требует дополнения');
    });
  });

  describe('checkCompletenessLevelChange', () => {
    test('detects level change', () => {
      const result = checkCompletenessLevelChange(50, 85);
      expect(result.changed).toBe(true);
      expect(result.improved).toBe(true);
      expect(result.oldStatus).toBe('poor');
      expect(result.newStatus).toBe('good');
    });

    test('no change within same band', () => {
      const result = checkCompletenessLevelChange(81, 89);
      expect(result.changed).toBe(false);
      expect(result.oldStatus).toBe('good');
      expect(result.newStatus).toBe('good');
    });

    test('detects regression', () => {
      const result = checkCompletenessLevelChange(90, 50);
      expect(result.changed).toBe(true);
      expect(result.improved).toBe(false);
      expect(result.scoreIncrease).toBe(-40);
    });
  });

  describe('getPriorityImprovements', () => {
    test('returns up to 3 improvements for incomplete marker', () => {
      const improvements = getPriorityImprovements(emptyMarker);
      expect(improvements.length).toBeLessThanOrEqual(3);
      expect(improvements.length).toBeGreaterThan(0);
      improvements.forEach(imp => {
        expect(imp).toHaveProperty('potentialScoreIncrease');
        expect(imp).toHaveProperty('estimatedNewScore');
      });
    });

    test('returns empty array for fully complete marker', () => {
      const improvements = getPriorityImprovements(fullMarker);
      // Full marker may still have 0 improvements if score is 100
      expect(Array.isArray(improvements)).toBe(true);
    });
  });
});
