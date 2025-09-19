import { describe, it, expect } from 'vitest';
import { parseNewick } from './parsers.js';

describe('parseNewick', () => {

  it('should parse a simple newick string', () => {
    const tree = parseNewick('((A,B)C);');
    expect(tree).toEqual({
      name: 'C',
      children: [
        { name: 'A' },
        { name: 'B' }
      ]
    });
  });

  it('should handle missing root parentheses and semicolon', () => {
    const tree = parseNewick('(A,B)C;');
    expect(tree).toEqual({
      name: 'C',
      children: [
        { name: 'A' },
        { name: 'B' }
      ]
    });
  });

  it('should handle branch lengths', () => {
    const tree = parseNewick('(A:0.1,B:0.2)C:0.3;');
    expect(tree).toEqual({
      name: 'C',
      length: 0.3,
      children: [
        { name: 'A', length: 0.1 },
        { name: 'B', length: 0.2 }
      ]
    });
  });

  it('should handle nested structures', () => {
    const tree = parseNewick('((A,B),(C,D));');
    expect(tree).toEqual({
      children: [
        {
          children: [
            { name: 'A' },
            { name: 'B' }
          ]
        },
        {
          children: [
            { name: 'C' },
            { name: 'D' }
          ]
        }
      ]
    });
  });

  it('should handle node labels with special characters', () => {
    const tree = parseNewick("('test_node',B_123);");
    expect(tree).toEqual({
      children: [
        { name: "'test_node'" }, // Parser preserves quotes
        { name: 'B_123' }
      ]
    });
  });

  it('should throw error for invalid input', () => {
    // Test missing closing paren
    expect(() => parseNewick('(A,B')).toThrow('Unexpected character');

    // Test missing opening paren
    expect(() => parseNewick('A,B);')).toThrow('Unexpected character');
  });
});
