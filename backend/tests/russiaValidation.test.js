import {
  isWithinRussiaBounds,
  checkCoordinates,
  getRussiaBounds,
} from '../src/middleware/russiaValidation.js';

describe('Russia Validation', () => {
  describe('isWithinRussiaBounds', () => {
    // Точки внутри России
    test('Moscow is within Russia', () => {
      expect(isWithinRussiaBounds(55.7558, 37.6173)).toBe(true);
    });

    test('Saint Petersburg is within Russia', () => {
      expect(isWithinRussiaBounds(59.9343, 30.3351)).toBe(true);
    });

    test('Vladivostok is within Russia', () => {
      expect(isWithinRussiaBounds(43.1155, 131.8855)).toBe(true);
    });

    test('Kaliningrad is within Russia', () => {
      expect(isWithinRussiaBounds(54.7104, 20.4522)).toBe(true);
    });

    test('Norilsk (far north) is within Russia', () => {
      expect(isWithinRussiaBounds(69.3558, 88.1893)).toBe(true);
    });

    test('Dagestan (south) is within Russia', () => {
      expect(isWithinRussiaBounds(42.0638, 47.0959)).toBe(true);
    });

    // Точки за пределами России
    test('Paris is NOT within Russia', () => {
      expect(isWithinRussiaBounds(48.8566, 2.3522)).toBe(false);
    });

    test('New York is NOT within Russia', () => {
      expect(isWithinRussiaBounds(40.7128, -74.006)).toBe(false);
    });

    test('Tokyo is NOT within Russia', () => {
      expect(isWithinRussiaBounds(35.6762, 139.6503)).toBe(false);
    });

    test('point too far south is NOT within Russia', () => {
      expect(isWithinRussiaBounds(30.0, 50.0)).toBe(false);
    });

    // Чукотка (отрицательная долгота)
    test('Chukotka region (negative longitude) is within Russia', () => {
      expect(isWithinRussiaBounds(66.0, -175.0)).toBe(true);
    });

    test('point outside Chukotka range is NOT within Russia', () => {
      expect(isWithinRussiaBounds(50.0, -175.0)).toBe(false);
    });
  });

  describe('checkCoordinates', () => {
    test('returns isValid=true for Russian coordinates', () => {
      const result = checkCoordinates(55.7558, 37.6173);
      expect(result.isValid).toBe(true);
      expect(result.coordinates.latitude).toBe(55.7558);
      expect(result.coordinates.longitude).toBe(37.6173);
    });

    test('returns isValid=false for non-Russian coordinates', () => {
      const result = checkCoordinates(48.8566, 2.3522);
      expect(result.isValid).toBe(false);
    });

    test('returns bounds object', () => {
      const result = checkCoordinates(55.0, 37.0);
      expect(result.bounds).toHaveProperty('north');
      expect(result.bounds).toHaveProperty('south');
      expect(result.bounds).toHaveProperty('east');
      expect(result.bounds).toHaveProperty('west');
    });
  });

  describe('getRussiaBounds', () => {
    test('returns bounds with all edges', () => {
      const bounds = getRussiaBounds();
      expect(bounds.north).toBeGreaterThan(bounds.south);
      expect(bounds.east).toBeGreaterThan(bounds.west);
    });
  });
});
