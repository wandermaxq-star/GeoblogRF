import {
  calculateEventCompleteness,
  computeEventPoints,
} from '../src/utils/eventCompleteness.js';

describe('Event Completeness', () => {
  const fullEvent = {
    title: 'Фестиваль народной музыки',
    description: 'Ежегодный фестиваль народной музыки и танцев, который собирает лучших артистов со всей России. Программа включает концерты, мастер-классы и выставки.',
    date: '2026-06-15',
    city: 'Москва',
    latitude: 55.7558,
    longitude: 37.6173,
    photo_urls: ['festival1.jpg'],
    category: 'culture',
  };

  const emptyEvent = {};

  describe('calculateEventCompleteness', () => {
    test('full event scores high (>= 80)', () => {
      const result = calculateEventCompleteness(fullEvent);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.needsCompletion).toBe(false);
    });

    test('empty event scores 0', () => {
      const result = calculateEventCompleteness(emptyEvent);
      expect(result.score).toBe(0);
      expect(result.needsCompletion).toBe(true);
      expect(result.status).toBe('incomplete');
    });

    test('returns correct structure', () => {
      const result = calculateEventCompleteness(fullEvent);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('filledRequiredFields');
      expect(result).toHaveProperty('totalRequiredFields');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('maxPossibleScore');
      expect(result).toHaveProperty('currentScore');
      expect(result).toHaveProperty('needsCompletion');
    });

    test('partial event has suggestions', () => {
      const partial = { title: 'Тест' }; // title too short
      const result = calculateEventCompleteness(partial);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('title must be >= 5 chars', () => {
      const short = { ...fullEvent, title: 'AB' };
      const ok = { ...fullEvent, title: 'ABCDE' };
      const rShort = calculateEventCompleteness(short);
      const rOk = calculateEventCompleteness(ok);
      expect(rShort.score).toBeLessThan(rOk.score);
    });

    test('description must be >= 80 chars', () => {
      const short = { ...fullEvent, description: 'Короткое описание' };
      const result = calculateEventCompleteness(short);
      const suggestion = result.suggestions.find(s => s.field === 'description');
      expect(suggestion).toBeDefined();
    });

    test('coordinates via lat/lng also accepted', () => {
      const event = { ...fullEvent, latitude: undefined, longitude: undefined, lat: 55.7, lng: 37.6 };
      const result = calculateEventCompleteness(event);
      const coordSuggestion = result.suggestions.find(s => s.field === 'coordinates');
      expect(coordSuggestion).toBeUndefined();
    });

    test('photos via photos array also accepted', () => {
      const event = { ...fullEvent, photo_urls: undefined, photos: ['pic.jpg'] };
      const result = calculateEventCompleteness(event);
      const photoSuggestion = result.suggestions.find(s => s.field === 'cover_photo');
      expect(photoSuggestion).toBeUndefined();
    });

    test('status mapping is correct', () => {
      // Score 100 => excellent
      const full = calculateEventCompleteness(fullEvent);
      expect(['excellent', 'good']).toContain(full.status);

      // Score 0 => incomplete
      const empty = calculateEventCompleteness(emptyEvent);
      expect(empty.status).toBe('incomplete');
    });
  });

  describe('computeEventPoints', () => {
    test('full event gets high base points', () => {
      const completeness = calculateEventCompleteness(fullEvent);
      const points = computeEventPoints(fullEvent, completeness);
      expect(points.basePoints).toBeGreaterThanOrEqual(35);
      expect(points.totalPoints).toBe(points.basePoints + points.attachmentPoints);
    });

    test('empty event gets 0 base points', () => {
      const completeness = calculateEventCompleteness(emptyEvent);
      const points = computeEventPoints(emptyEvent, completeness);
      expect(points.basePoints).toBe(0);
    });

    test('attachments add bonus points', () => {
      const eventWithAttachments = {
        ...fullEvent,
        attached_hotels: [1, 2],
        attached_parking: [3],
        attached_routes: [4],
        attached_restaurants: [5, 6, 7],
      };
      const completeness = calculateEventCompleteness(eventWithAttachments);
      const points = computeEventPoints(eventWithAttachments, completeness);
      // 2 hotels * 5 + 1 parking * 3 + 1 route * 8 + 3 restaurants * 4 = 10+3+8+12=33
      expect(points.attachmentPoints).toBe(33);
      expect(points.breakdown.hotels).toBe(2);
      expect(points.breakdown.parking).toBe(1);
      expect(points.breakdown.routes).toBe(1);
      expect(points.breakdown.restaurants).toBe(3);
    });

    test('handles JSON string attachments', () => {
      const event = { ...fullEvent, hotels: JSON.stringify([1, 2, 3]) };
      const completeness = calculateEventCompleteness(event);
      const points = computeEventPoints(event, completeness);
      expect(points.breakdown.hotels).toBe(3);
    });

    test('handles missing attachments gracefully', () => {
      const completeness = calculateEventCompleteness(fullEvent);
      const points = computeEventPoints(fullEvent, completeness);
      expect(points.attachmentPoints).toBe(0);
      expect(points.breakdown.hotels).toBe(0);
    });
  });
});
