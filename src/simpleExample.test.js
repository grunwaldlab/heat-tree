import { describe, it, expect } from 'vitest';
import { heatTree } from './index.js';

describe('Simple Tree Example', () => {
  it('should work with the simple tree example', () => {
    // Create a container element
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    
    try {
      const result = heatTree(
        '#test-container',
        {
          name: 'Simple Tree',
          tree: '(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);'
        },
        { manualZoomAndPanEnabled: false }
      );
      
      expect(result).toBeDefined();
      expect(result.treeDataInstances).toBeDefined();
      expect(result.treeDataInstances.size).toBe(1);
      
      const treeName = Array.from(result.treeDataInstances.keys())[0];
      expect(treeName).toBe('Simple Tree');
    } finally {
      document.body.removeChild(container);
    }
  });
});
