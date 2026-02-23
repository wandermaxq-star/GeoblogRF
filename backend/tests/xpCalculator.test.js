import {
  calculateRequiredXP,
  calculateLevelFromTotalXP,
  createUserLevelFromTotalXP,
} from '../src/utils/xpCalculator.js';

describe('XP Calculator', () => {
  describe('calculateRequiredXP', () => {
    test('level 1 requires 100 XP', () => {
      expect(calculateRequiredXP(1)).toBe(100);
    });

    test('level 2 requires floor(100 * 2^1.5) = 282', () => {
      expect(calculateRequiredXP(2)).toBe(Math.floor(100 * Math.pow(2, 1.5)));
    });

    test('returns integer', () => {
      for (let lvl = 1; lvl <= 10; lvl++) {
        expect(Number.isInteger(calculateRequiredXP(lvl))).toBe(true);
      }
    });

    test('XP requirement grows with level', () => {
      let prev = 0;
      for (let lvl = 1; lvl <= 20; lvl++) {
        const xp = calculateRequiredXP(lvl);
        expect(xp).toBeGreaterThan(prev);
        prev = xp;
      }
    });
  });

  describe('calculateLevelFromTotalXP', () => {
    test('0 XP => level 1, rank novice', () => {
      const result = calculateLevelFromTotalXP(0);
      expect(result.level).toBe(1);
      expect(result.rank).toBe('novice');
      expect(result.currentLevelXP).toBe(0);
    });

    test('exactly 100 XP => level 2 (100 XP consumed for level 1)', () => {
      const result = calculateLevelFromTotalXP(100);
      expect(result.level).toBe(2);
      expect(result.currentLevelXP).toBe(0);
    });

    test('99 XP => still level 1 with 99 currentLevelXP', () => {
      const result = calculateLevelFromTotalXP(99);
      expect(result.level).toBe(1);
      expect(result.currentLevelXP).toBe(99);
    });

    test('rank progression: novice -> explorer -> traveler -> legend -> geoblogger', () => {
      // Accumulate XP to reach each rank threshold
      expect(calculateLevelFromTotalXP(0).rank).toBe('novice');

      // Find XP needed for level 6 (explorer starts at level 6)
      let xpForLevel6 = 0;
      for (let l = 1; l < 6; l++) xpForLevel6 += calculateRequiredXP(l);
      expect(calculateLevelFromTotalXP(xpForLevel6).rank).toBe('explorer');

      // Level 16 => traveler
      let xpForLevel16 = 0;
      for (let l = 1; l < 16; l++) xpForLevel16 += calculateRequiredXP(l);
      expect(calculateLevelFromTotalXP(xpForLevel16).rank).toBe('traveler');

      // Level 31 => legend
      let xpForLevel31 = 0;
      for (let l = 1; l < 31; l++) xpForLevel31 += calculateRequiredXP(l);
      expect(calculateLevelFromTotalXP(xpForLevel31).rank).toBe('legend');

      // Level 50 => geoblogger
      let xpForLevel50 = 0;
      for (let l = 1; l < 50; l++) xpForLevel50 += calculateRequiredXP(l);
      expect(calculateLevelFromTotalXP(xpForLevel50).rank).toBe('geoblogger');
    });

    test('requiredXP matches calculateRequiredXP for current level', () => {
      const result = calculateLevelFromTotalXP(150);
      expect(result.requiredXP).toBe(calculateRequiredXP(result.level));
    });
  });

  describe('createUserLevelFromTotalXP', () => {
    test('returns all expected fields', () => {
      const result = createUserLevelFromTotalXP(500);
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('currentXP');
      expect(result).toHaveProperty('requiredXP');
      expect(result).toHaveProperty('totalXP', 500);
      expect(result).toHaveProperty('rank');
      expect(result).toHaveProperty('progress');
    });

    test('progress is between 0 and 100', () => {
      for (const xp of [0, 50, 100, 500, 5000, 100000]) {
        const result = createUserLevelFromTotalXP(xp);
        expect(result.progress).toBeGreaterThanOrEqual(0);
        expect(result.progress).toBeLessThanOrEqual(100);
      }
    });

    test('totalXP is preserved', () => {
      expect(createUserLevelFromTotalXP(1234).totalXP).toBe(1234);
    });

    test('progress is 0 at start of level', () => {
      // Exact XP for reaching level 2
      const result = createUserLevelFromTotalXP(100);
      expect(result.level).toBe(2);
      expect(result.currentXP).toBe(0);
      expect(result.progress).toBe(0);
    });
  });
});
