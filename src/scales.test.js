import { describe, it, expect } from 'vitest';
import { ContinuousSizeScale, ContinuousColorScale, CategoricalColorScale } from '../src/scales.js';

describe('ContinuousSizeScale', () => {

  describe('getValue', () => {
    it('should return minimum size for minimum data value', () => {
      const scale = new ContinuousSizeScale(0, 100, 10, 50);
      expect(scale.getValue(0)).toBe(10);
    });

    it('should return maximum size for maximum data value', () => {
      const scale = new ContinuousSizeScale(0, 100, 10, 50);
      expect(scale.getValue(100)).toBe(50);
    });

    it('should interpolate linearly for middle values', () => {
      const scale = new ContinuousSizeScale(0, 100, 10, 50);
      expect(scale.getValue(50)).toBe(30);
      expect(scale.getValue(25)).toBe(20);
      expect(scale.getValue(75)).toBe(40);
    });

    it('should clamp values below minimum', () => {
      const scale = new ContinuousSizeScale(0, 100, 10, 50);
      expect(scale.getValue(-10)).toBe(10);
      expect(scale.getValue(-100)).toBe(10);
    });

    it('should clamp values above maximum', () => {
      const scale = new ContinuousSizeScale(0, 100, 10, 50);
      expect(scale.getValue(110)).toBe(50);
      expect(scale.getValue(200)).toBe(50);
    });

    it('should handle negative data ranges', () => {
      const scale = new ContinuousSizeScale(-100, -50, 10, 50);
      expect(scale.getValue(-100)).toBe(10);
      expect(scale.getValue(-50)).toBe(50);
      expect(scale.getValue(-75)).toBe(30);
    });

    it('should handle when dataMin equals dataMax', () => {
      const scale = new ContinuousSizeScale(50, 50, 10, 50);
      expect(scale.getValue(50)).toBe(30);
      expect(scale.getValue(0)).toBe(10);
      expect(scale.getValue(100)).toBe(50);
    });

  });
});

describe('ContinuousColorScale', () => {
  describe('constructor', () => {

    it('should create equally spaced color positions by default', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const scale = new ContinuousColorScale(0, 100, 0, 1, colors);
      expect(scale.colorPositions).toEqual([0, 0.5, 1]);
    });

    it('should throw error if less than 1 color provided', () => {
      expect(() => {
        new ContinuousColorScale(0, 100, 0, 1, []);
      }).toThrow('At least 1 color is required');
    });

    it('should throw error if colorPositions length does not match colors', () => {
      expect(() => {
        new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#00ff00'], [0, 0.5, 1]);
      }).toThrow('colorPositions must have the same length as colors');
    });

    it('should auto-sort colorPositions and reorder colors', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const positions = [1, 0, 0.5];
      const scale = new ContinuousColorScale(0, 100, 0, 1, colors, positions);

      expect(scale.colorPositions).toEqual([0, 0.5, 1]);
      expect(scale.colors).toEqual(
        [
          { "b": 0, "g": 255, "r": 0 },
          { "b": 255, "g": 0, "r": 0 },
          { "b": 0, "g": 0, "r": 255, }
        ]
      );
    });

    it('should normalize colorPositions to [0, 1]', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const positions = [10, 20, 30];
      const scale = new ContinuousColorScale(0, 100, 0, 1, colors, positions);

      expect(scale.colorPositions).toEqual([0, 0.5, 1]);
    });

  });

  describe('getValue', () => {
    it('should return first color for minimum data value', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      expect(scale.getValue(0)).toBe('#ff0000');
    });

    it('should return last color for maximum data value', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      expect(scale.getValue(100)).toBe('#0000ff');
    });

    it('should interpolate colors for middle values', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      const midColor = scale.getValue(50);
      expect(midColor).toBe('#800080');
    });

    it('should clamp values below minimum', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      expect(scale.getValue(-10)).toBe('#ff0000');
    });

    it('should clamp values above maximum', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      expect(scale.getValue(110)).toBe('#0000ff');
    });

    it('should handle when dataMin equals dataMax - equal value returns middle color', () => {
      const scale = new ContinuousColorScale(50, 50, 0, 1, ['#ff0000', '#00ff00', '#0000ff']);
      expect(scale.getValue(50)).toBe('#00ff00'); // Middle color
    });

    it('should handle when dataMin equals dataMax - less than returns first color', () => {
      const scale = new ContinuousColorScale(50, 50, 0, 1, ['#ff0000', '#00ff00', '#0000ff']);
      expect(scale.getValue(0)).toBe('#ff0000');
    });

    it('should handle when dataMin equals dataMax - greater than returns last color', () => {
      const scale = new ContinuousColorScale(50, 50, 0, 1, ['#ff0000', '#00ff00', '#0000ff']);
      expect(scale.getValue(100)).toBe('#0000ff');
    });

    it('should respect transform range', () => {
      const scale = new ContinuousColorScale(0, 100, 0.25, 0.75, ['#000000', '#ffffff']);
      expect(scale.getValue(0)).toBe('#404040');
      expect(scale.getValue(100)).toBe('#bfbfbf');
    });

    it('should handle multiple color stops', () => {
      const scale = new ContinuousColorScale(
        0, 100, 0, 1,
        ['#ff0000', '#00ff00', '#0000ff'],
        [0, 0.5, 1]
      );

      expect(scale.getValue(0)).toBe('#ff0000');
      expect(scale.getValue(50)).toBe('#00ff00');
      expect(scale.getValue(100)).toBe('#0000ff');
      expect(scale.getValue(25)).toBe('#808000');
    });

    it('should handle unequal color positions', () => {
      const scale = new ContinuousColorScale(
        0, 100, 0, 1,
        ['#ff0000', '#00ff00', '#0000ff'],
        [0, 0.2, 1]
      );

      expect(scale.getValue(0)).toBe('#ff0000');
      expect(scale.getValue(20)).toBe('#00ff00');
      expect(scale.getValue(100)).toBe('#0000ff');
    });

    it('should return single color when only one color provided', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000']);
      expect(scale.getValue(0)).toBe('#ff0000');
      expect(scale.getValue(50)).toBe('#ff0000');
      expect(scale.getValue(100)).toBe('#ff0000');
    });

    it('should return grey for null values', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      expect(scale.getValue(null)).toBe('#808080');
    });

    it('should return grey for undefined values', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      expect(scale.getValue(undefined)).toBe('#808080');
    });

    it('should return grey for empty string values', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#0000ff']);
      expect(scale.getValue('')).toBe('#808080');
    });

    it('should return nearest color when value maps below colorPositions range', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#00ff00'], [0.2, 1]);
      // Value 0 maps to transform 0, which is below 0.2, so should get first color
      expect(scale.getValue(0)).toBe('#ff0000');
    });

    it('should return nearest color when value maps above colorPositions range', () => {
      const scale = new ContinuousColorScale(0, 100, 0, 1, ['#ff0000', '#00ff00'], [0, 0.8]);
      // Value 100 maps to transform 1, which is above 0.8, so should get last color
      expect(scale.getValue(100)).toBe('#00ff00');
    });

  });

});

describe('CategoricalColorScale', () => {
  describe('constructor', () => {
    it('should create a scale with given category data', () => {
      const categoryData = ['A', 'B', 'C', 'A', 'B', 'A'];
      const scale = new CategoricalColorScale(categoryData);
      expect(scale.categories).toEqual(['A', 'B', 'C']); // Sorted by frequency
      expect(scale.transformMin).toBe(0);
      expect(scale.transformMax).toBe(1);
    });

    it('should calculate frequencies correctly', () => {
      const categoryData = ['A', 'B', 'C', 'A', 'B', 'A'];
      const scale = new CategoricalColorScale(categoryData);
      expect(scale.frequencyMap.get('A')).toBe(3);
      expect(scale.frequencyMap.get('B')).toBe(2);
      expect(scale.frequencyMap.get('C')).toBe(1);
    });

    it('should sort categories by descending frequency', () => {
      const categoryData = ['C', 'A', 'B', 'A', 'C', 'C', 'C'];
      const scale = new CategoricalColorScale(categoryData);
      expect(scale.categories).toEqual(['C', 'A', 'B']);
    });

    it('should assign colors to all categories', () => {
      const categoryData = ['A', 'B', 'C'];
      const scale = new CategoricalColorScale(categoryData);
      expect(scale.categoryColorMap.size).toBe(3);
      expect(scale.categoryColorMap.has('A')).toBe(true);
      expect(scale.categoryColorMap.has('B')).toBe(true);
      expect(scale.categoryColorMap.has('C')).toBe(true);
    });

    it('should throw error for empty category data array', () => {
      expect(() => {
        new CategoricalColorScale([]);
      }).toThrow('categoryData must be a non-empty array');
    });

    it('should throw error for non-array category data', () => {
      expect(() => {
        new CategoricalColorScale('not an array');
      }).toThrow('categoryData must be a non-empty array');
    });

    it('should throw error if less than 1 color provided', () => {
      expect(() => {
        new CategoricalColorScale(['A', 'B'], 0, 1, []);
      }).toThrow('At least 1 color is required');
    });

    it('should handle single category', () => {
      const scale = new CategoricalColorScale(['A', 'A', 'A']);
      expect(scale.categoryColorMap.size).toBe(1);
      expect(scale.categoryColorMap.has('A')).toBe(true);
    });

    it('should handle single color', () => {
      const scale = new CategoricalColorScale(['A', 'B', 'C'], 0, 1, ['#ff0000']);
      expect(scale.getValue('A')).toBe('#ff0000');
      expect(scale.getValue('B')).toBe('#ff0000');
      expect(scale.getValue('C')).toBe('#ff0000');
    });

    it('should auto-sort colorPositions and reorder colors', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const positions = [1, 0, 0.5];
      const scale = new CategoricalColorScale(['A', 'B', 'C'], 0, 1, colors, positions);

      expect(scale.colorPositions).toEqual([0, 0.5, 1]);
      expect(scale.colors).toEqual(
        [
          { "b": 0, "g": 255, "r": 0 },
          { "b": 255, "g": 0, "r": 0 },
          { "b": 0, "g": 0, "r": 255, }
        ]
      );
    });

    it('should normalize colorPositions to [0, 1]', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const positions = [10, 20, 30];
      const scale = new CategoricalColorScale(['A', 'B', 'C'], 0, 1, colors, positions);

      expect(scale.colorPositions).toEqual([0, 0.5, 1]);
    });
  });

  describe('getValue', () => {
    it('should return assigned color for known category', () => {
      const scale = new CategoricalColorScale(['A', 'B', 'C']);
      const colorA = scale.getValue('A');
      const colorB = scale.getValue('B');
      const colorC = scale.getValue('C');

      expect(colorA).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colorB).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colorC).toMatch(/^#[0-9a-f]{6}$/i);

      // Colors should be different
      expect(colorA).not.toBe(colorB);
      expect(colorB).not.toBe(colorC);
    });

    it('should throw error for unknown category', () => {
      const scale = new CategoricalColorScale(['A', 'B', 'C']);
      expect(() => {
        scale.getValue('Z');
      }).toThrow('Unknown category: Z');
    });

    it('should return grey for null values', () => {
      const scale = new CategoricalColorScale(['A', 'B', 'C']);
      expect(scale.getValue(null)).toBe('#808080');
    });

    it('should return grey for undefined values', () => {
      const scale = new CategoricalColorScale(['A', 'B', 'C']);
      expect(scale.getValue(undefined)).toBe('#808080');
    });

    it('should return grey for empty string values', () => {
      const scale = new CategoricalColorScale(['A', 'B', 'C']);
      expect(scale.getValue('')).toBe('#808080');
    });
  });

  describe('edge cases', () => {
    it('should handle numeric categories', () => {
      const scale = new CategoricalColorScale([1, 2, 3]);
      expect(scale.getValue(1)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scale.getValue(2)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scale.getValue(3)).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle mixed type categories', () => {
      const scale = new CategoricalColorScale(['A', 1, true, null]);
      expect(scale.getValue('A')).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scale.getValue(1)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scale.getValue(true)).toMatch(/^#[0-9a-f]{6}$/i);
      // null as a category value (not as getValue input)
      expect(scale.categoryColorMap.has(null)).toBe(true);
    });
  });
});
