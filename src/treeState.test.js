import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TreeState } from './treeState.js';
import { TreeData } from './treeData.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js';

// Mock the scaling functions
vi.mock('./scaling.js', () => ({
  calculateScalingFactors: vi.fn(() => ({
    branchLenToPxFactor_max: 100,
    labelSizeToPxFactor_min: 16
  })),
  calculateCircularScalingFactors: vi.fn(() => ({
    branchLenToPxFactor_max: 100,
    labelSizeToPxFactor_min: 16
  }))
}));

describe('TreeState', () => {
  let treeData;
  let treeState;
  let textSizeEstimator;
  let simpleNewick;
  let metadataTable;

  beforeEach(() => {
    simpleNewick = '((A:1,B:2)C:3,D:4)E;';
    metadataTable = `node_id\tvalue1\tcategory1\tstyle1
A\t10\tred\tbold
B\t20\tblue\titalic
C\t15\tred\tnormal
D\t25\tgreen\tbold italic`;

    treeData = new TreeData(simpleNewick, [metadataTable]);
    textSizeEstimator = new TextSizeEstimator();
    treeState = new TreeState(treeData, textSizeEstimator);
  });

  describe('constructor', () => {
    it('should initialize with default layout', () => {
      expect(treeState.layout).toBe('rectangular');
    });

    it('should initialize with null label sources', () => {
      expect(treeState.labelTextSource).toBeNull();
      expect(treeState.labelColorSource).toBeNull();
      expect(treeState.labelSizeSource).toBeNull();
      expect(treeState.labelFontSource).toBeNull();
      expect(treeState.labelStyleSource).toBeNull();
    });

    it('should initialize with tree copy', () => {
      expect(treeState.tree).toBeDefined();
      expect(treeState.tree).not.toBe(treeData.tree);
    });

    it('should set displayedRoot to full tree', () => {
      expect(treeState.displayedRoot).toBe(treeData.tree);
    });
  });

  describe('setLayout', () => {
    it('should change layout from rectangular to circular', () => {
      treeState.setLayout('circular');
      expect(treeState.layout).toBe('circular');
    });

    it('should change layout from circular to rectangular', () => {
      treeState.setLayout('circular');
      treeState.setLayout('rectangular');
      expect(treeState.layout).toBe('rectangular');
    });

    it('should warn on invalid layout type', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
      treeState.setLayout('invalid');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid layout type: invalid');
      expect(treeState.layout).toBe('rectangular');
      consoleSpy.mockRestore();
    });

    it('should not trigger update if layout unchanged', () => {
      const notifySpy = vi.spyOn(treeState, 'notify');
      treeState.setLayout('rectangular');
      expect(notifySpy).not.toHaveBeenCalled();
    });
  });

  describe('setTipLabelTextSource', () => {
    it('should set label text source', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      treeState.setTipLabelTextSource(columnId);
      expect(treeState.labelTextSource).toBe(columnId);
    });

    it('should clear label text source when null', () => {
      treeState.setTipLabelTextSource(null);
      expect(treeState.labelTextSource).toBeNull();
    });
  });

  describe('setTipLabelColorSource', () => {
    it('should set label color source', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_category1`;

      treeState.setTipLabelColorSource(columnId);
      expect(treeState.labelColorSource).toBe(columnId);
    });

    it('should notify subscribers of font change', () => {
      const notifySpy = vi.spyOn(treeState, 'notify');
      treeState.setTipLabelColorSource('column1');
      expect(notifySpy).toHaveBeenCalledWith('fontChange');
    });
  });

  describe('setTipLabelSizeSource', () => {
    it('should set label size source', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      treeState.setTipLabelSizeSource(columnId);
      expect(treeState.labelSizeSource).toBe(columnId);
    });
  });

  describe('setTipLabelFontSource', () => {
    it('should set label font source', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_category1`;

      treeState.setTipLabelFontSource(columnId);
      expect(treeState.labelFontSource).toBe(columnId);
    });
  });

  describe('setTipLabelStyleSource', () => {
    it('should set label style source', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_style1`;

      treeState.setTipLabelStyleSource(columnId);
      expect(treeState.labelStyleSource).toBe(columnId);
    });

    it('should notify subscribers of font change', () => {
      const notifySpy = vi.spyOn(treeState, 'notify');
      treeState.setTipLabelStyleSource('styleColumn');
      expect(notifySpy).toHaveBeenCalledWith('fontChange');
    });
  });

  describe('setTargetTreeDimensions', () => {
    it('should update target dimensions', () => {
      treeState.setTargetTreeDimensions(1000, 800);
      expect(treeState.targetViewWidth).toBe(1000);
      expect(treeState.targetViewHeight).toBe(800);
    });
  });

  describe('setLabelOffset', () => {
    it('should update label offset', () => {
      treeState.setLabelOffset(10);
      expect(treeState.labelOffsetPx).toBe(10);
    });
  });

  describe('getTreeDimensions', () => {
    it('should return dimensions for rectangular layout', () => {
      treeState.setLayout('rectangular');
      treeState.updateCoordinates();

      const dims = treeState.getTreeDimensions();
      expect(dims).toHaveProperty('width');
      expect(dims).toHaveProperty('height');
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('should return dimensions for circular layout', () => {
      treeState.setLayout('circular');
      treeState.updateCoordinates();

      const dims = treeState.getTreeDimensions();
      expect(dims).toHaveProperty('width');
      expect(dims).toHaveProperty('height');
    });

    it('should return zero dimensions when tree is null', () => {
      treeState.tree = null;
      const dims = treeState.getTreeDimensions();
      expect(dims.width).toBe(0);
      expect(dims.height).toBe(0);
    });

    it('should return zero dimensions when bounds are missing', () => {
      treeState.tree.data.bounds = null;
      const dims = treeState.getTreeDimensions();
      expect(dims.width).toBe(0);
      expect(dims.height).toBe(0);
    });
  });

  describe('_updateColorScale', () => {
    it('should create continuous color scale for continuous data', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      treeState.labelColorSource = columnId;
      treeState._updateColorScale();

      expect(treeState.labelColorScale).toBeDefined();
      expect(treeState.labelColorScale.constructor.name).toBe('ContinuousColorScale');
    });

    it('should create categorical color scale for categorical data', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_category1`;

      treeState.labelColorSource = columnId;
      treeState._updateColorScale();

      expect(treeState.labelColorScale).toBeDefined();
      expect(treeState.labelColorScale.constructor.name).toBe('CategoricalColorScale');
    });

    it('should clear color scale when no source specified', () => {
      treeState.labelColorSource = null;
      treeState._updateColorScale();
      expect(treeState.labelColorScale).toBeNull();
    });

    it('should clear color scale when column type not found', () => {
      treeState.labelColorSource = 'nonexistent';
      treeState._updateColorScale();
      expect(treeState.labelColorScale).toBeNull();
    });

    it('should clear color scale when no values found', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      // Clear all metadata
      treeState.tree.each(node => {
        node.metadata = {};
      });

      treeState.labelColorSource = columnId;
      treeState._updateColorScale();
      expect(treeState.labelColorScale).toBeNull();
    });
  });

  describe('_updateSizeScale', () => {
    it('should create size scale for continuous data', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      treeState.labelSizeSource = columnId;
      treeState._updateSizeScale();

      expect(treeState.labelSizeScale).toBeDefined();
      expect(treeState.labelSizeScale.constructor.name).toBe('ContinuousSizeScale');
    });

    it('should not create size scale for categorical data', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_category1`;

      treeState.labelSizeSource = columnId;
      treeState._updateSizeScale();

      expect(treeState.labelSizeScale).toBeNull();
    });

    it('should clear size scale when no source specified', () => {
      treeState.labelSizeSource = null;
      treeState._updateSizeScale();
      expect(treeState.labelSizeScale).toBeNull();
    });

    it('should clear size scale when no numeric values found', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      // Clear all metadata
      treeState.tree.each(node => {
        node.metadata = {};
      });

      treeState.labelSizeSource = columnId;
      treeState._updateSizeScale();
      expect(treeState.labelSizeScale).toBeNull();
    });
  });

  describe('updateScaling', () => {
    it('should update scaling factors', () => {
      treeState.updateScaling();
      expect(treeState.branchLenToPxFactor).toBeDefined();
      expect(treeState.labelSizeToPxFactor).toBeDefined();
    });

    it('should set node labels from metadata when source specified', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_category1`;

      treeState.setTipLabelTextSource(columnId);

      const leafA = treeState.tree.leaves().find(d => d.data.name === 'A');
      expect(leafA.data.tipLabel).toBe('red');
    });

    it('should use node names when no label source specified', () => {
      treeState.setTipLabelTextSource(null);

      const leafA = treeState.tree.leaves().find(d => d.data.name === 'A');
      expect(leafA.data.tipLabel).toBe('A');
    });

    it('should set collapsed subtree labels', () => {
      const internalNode = treeState.tree.children[0];
      internalNode.collapsed_children = internalNode.children;
      internalNode.collapsed_children_name = 'CollapsedGroup';
      internalNode.children = null;

      treeState.updateScaling();

      expect(internalNode.data.nodeLabel).toBe('CollapsedGroup');
      expect(internalNode.data.tipLabel).toBe('');
    });

    it('should set collapsed root labels', () => {
      const node = treeState.tree.children[0];
      node.collapsed_parent = treeState.tree;
      node.collapsed_parent_name = 'RootGroup';

      treeState.updateScaling();

      expect(node.data.nodeLabel).toBe('RootGroup');
      expect(node.data.tipLabel).toBe('');
    });
  });

  describe('updateCoordinates', () => {
    it('should calculate coordinates for rectangular layout', () => {
      treeState.setLayout('rectangular');
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        expect(node.data.x).toBeDefined();
        expect(node.data.y).toBeDefined();
        expect(node.data.lengthPx).toBeDefined();
        expect(node.data.angle).toBeNull();
        expect(node.data.radiusPx).toBeNull();
      });
    });

    it('should calculate coordinates for circular layout', () => {
      treeState.setLayout('circular');
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        expect(node.data.lengthPx).toBeDefined();
        expect(node.data.x).toBeDefined();
        expect(node.data.y).toBeDefined();
        expect(node.data.radiusPx).toBeDefined();
        expect(node.data.angle).toBeDefined();
        expect(node.data.cos).toBeDefined();
        expect(node.data.sin).toBeDefined();
      });
    });

    it('should set label properties', () => {
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        expect(node.data.tipLabelSize).toBeDefined();
        expect(node.data.tipLabelColor).toBeDefined();
        expect(node.data.tipLabelFont).toBeDefined();
        expect(node.data.tipLabelStyle).toBeDefined();
      });
    });

    it('should apply size scale when specified', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      treeState.setTipLabelSizeSource(columnId);
      treeState.updateCoordinates();

      const leaf1 = treeState.tree.leaves().find(d => d.data.name === 'A');
      const leaf2 = treeState.tree.leaves().find(d => d.data.name === 'B');

      expect(leaf1.data.tipLabelSize).toBeDefined();
      expect(leaf2.data.tipLabelSize).toBeDefined();
      expect(leaf2.data.tipLabelSize).toBeGreaterThan(leaf1.data.tipLabelSize);
    });

    it('should apply color scale when specified', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_category1`;

      treeState.setTipLabelColorSource(columnId);
      treeState.updateCoordinates();

      const leafA = treeState.tree.leaves().find(d => d.data.name === 'A');
      const leafB = treeState.tree.leaves().find(d => d.data.name === 'B');

      expect(leafA.data.tipLabelColor).toBeDefined();
      expect(leafB.data.tipLabelColor).toBeDefined();
      expect(leafA.data.tipLabelColor).not.toBe('#000');
      expect(leafB.data.tipLabelColor).not.toBe('#000');
    });

    it('should apply font style when specified', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_style1`;

      treeState.setTipLabelStyleSource(columnId);
      treeState.updateCoordinates();

      const leafA = treeState.tree.leaves().find(d => d.data.name === 'A');
      const leafB = treeState.tree.leaves().find(d => d.data.name === 'B');
      const leafD = treeState.tree.leaves().find(d => d.data.name === 'D');

      expect(leafA.data.tipLabelStyle).toBe('bold');
      expect(leafB.data.tipLabelStyle).toBe('italic');
      expect(leafD.data.tipLabelStyle).toBe('bold italic');
    });

    it('should use default style when no style source specified', () => {
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        expect(node.data.tipLabelStyle).toBe('normal');
      });
    });

    it('should set collapsed flags', () => {
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        expect(node.data.isCollapsedSubtree).toBeDefined();
        expect(node.data.isCollapsedRoot).toBeDefined();
      });
    });

    it('should notify subscribers of tree change', () => {
      const notifySpy = vi.spyOn(treeState, 'notify');
      treeState.updateCoordinates();
      expect(notifySpy).toHaveBeenCalledWith('treeChange');
    });

    it('should update occupied dimensions', () => {
      treeState.updateCoordinates();
      expect(treeState.occupiedViewWidth).toBeGreaterThan(0);
      expect(treeState.occupiedViewHeight).toBeGreaterThan(0);
    });
  });

  describe('_calculateBounds', () => {
    it('should calculate bounds for all nodes in rectangular layout', () => {
      treeState.setLayout('rectangular');
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        expect(node.data.bounds).toBeDefined();
        expect(node.data.bounds.minX).toBeDefined();
        expect(node.data.bounds.maxX).toBeDefined();
        expect(node.data.bounds.minY).toBeDefined();
        expect(node.data.bounds.maxY).toBeDefined();
      });
    });

    it('should calculate bounds for all nodes in circular layout', () => {
      treeState.setLayout('circular');
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        expect(node.data.bounds).toBeDefined();
        expect(node.data.bounds.minRadius).toBeDefined();
        expect(node.data.bounds.maxRadius).toBeDefined();
        expect(node.data.bounds.minAngle).toBeDefined();
        expect(node.data.bounds.maxAngle).toBeDefined();
      });
    });

    it('should have parent bounds encompassing child bounds in rectangular layout', () => {
      treeState.setLayout('rectangular');
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        if (node.children) {
          node.children.forEach(child => {
            expect(node.data.bounds.minX).toBeLessThanOrEqual(child.data.bounds.minX);
            expect(node.data.bounds.maxX).toBeGreaterThanOrEqual(child.data.bounds.maxX);
            expect(node.data.bounds.minY).toBeLessThanOrEqual(child.data.bounds.minY);
            expect(node.data.bounds.maxY).toBeGreaterThanOrEqual(child.data.bounds.maxY);
          });
        }
      });
    });

    it('should have parent bounds encompassing child bounds in circular layout', () => {
      treeState.setLayout('circular');
      treeState.updateCoordinates();

      treeState.tree.each(node => {
        if (node.children) {
          node.children.forEach(child => {
            expect(node.data.bounds.minRadius).toBeLessThanOrEqual(child.data.bounds.minRadius);
            expect(node.data.bounds.maxRadius).toBeGreaterThanOrEqual(child.data.bounds.maxRadius);
            expect(node.data.bounds.minAngle).toBeLessThanOrEqual(child.data.bounds.minAngle);
            expect(node.data.bounds.maxAngle).toBeGreaterThanOrEqual(child.data.bounds.maxAngle);
          });
        }
      });
    });
  });

  describe('collapseSubtree', () => {
    it('should collapse a subtree', () => {
      const internalNode = treeState.tree.children[0];
      const childCount = internalNode.children ? internalNode.children.length : 0;

      treeState.collapseSubtree(internalNode);

      expect(internalNode.children).toBeNull();
      expect(internalNode.collapsed_children).toBeDefined();
      expect(internalNode.collapsed_children.length).toBe(childCount);
    });

    it('should not collapse a leaf node', () => {
      const leaf = treeState.tree.leaves()[0];
      treeState.collapseSubtree(leaf);

      expect(leaf.collapsed_children).toBeUndefined();
    });

    it('should handle null node gracefully', () => {
      expect(() => treeState.collapseSubtree(null)).not.toThrow();
    });

    it('should update tree after collapsing', () => {
      const internalNode = treeState.tree.children[0];
      const notifySpy = vi.spyOn(treeState, 'notify');

      treeState.collapseSubtree(internalNode);

      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('expandSubtree', () => {
    it('should expand a collapsed subtree', () => {
      const internalNode = treeState.tree.children[0];
      treeState.collapseSubtree(internalNode);

      const collapsedCount = internalNode.collapsed_children.length;
      treeState.expandSubtree(internalNode);

      expect(internalNode.children).toBeDefined();
      expect(internalNode.children.length).toBe(collapsedCount);
      expect(internalNode.collapsed_children).toBeNull();
    });

    it('should not expand a non-collapsed node', () => {
      const internalNode = treeState.tree.children[0];
      const childCount = internalNode.children ? internalNode.children.length : 0;

      treeState.expandSubtree(internalNode);

      expect(internalNode.children ? internalNode.children.length : 0).toBe(childCount);
    });

    it('should handle null node gracefully', () => {
      expect(() => treeState.expandSubtree(null)).not.toThrow();
    });

    it('should update tree after expanding', () => {
      const internalNode = treeState.tree.children[0];
      treeState.collapseSubtree(internalNode);

      const notifySpy = vi.spyOn(treeState, 'notify');
      treeState.expandSubtree(internalNode);

      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('collapseRoot', () => {
    it('should collapse to a subtree root', () => {
      const newRoot = treeState.tree.children[0];
      const originalRoot = treeState.displayedRoot;

      treeState.collapseRoot(newRoot);

      expect(treeState.displayedRoot).toBe(newRoot);
      expect(newRoot.collapsed_parent).toBe(originalRoot);
      expect(newRoot.parent).toBeNull();
    });

    it('should not collapse if node is already displayed root', () => {
      const currentRoot = treeState.displayedRoot;
      treeState.collapseRoot(currentRoot);

      expect(treeState.displayedRoot).toBe(currentRoot);
    });

    it('should handle null node gracefully', () => {
      const originalRoot = treeState.displayedRoot;
      treeState.collapseRoot(null);
      expect(treeState.displayedRoot).toBe(originalRoot);
    });

    it('should update tree after collapsing root', () => {
      const newRoot = treeState.tree.children[0];
      const notifySpy = vi.spyOn(treeState, 'notify');

      treeState.collapseRoot(newRoot);

      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('expandRoot', () => {
    it('should expand a collapsed root', () => {
      const newRoot = treeState.tree.children[0];
      treeState.collapseRoot(newRoot);

      const collapsedParent = newRoot.collapsed_parent;
      treeState.expandRoot();

      expect(treeState.displayedRoot).toBe(collapsedParent);
      expect(newRoot.collapsed_parent).toBeNull();
    });

    it('should not expand if no collapsed parent exists', () => {
      const currentRoot = treeState.displayedRoot;
      treeState.expandRoot();

      expect(treeState.displayedRoot).toBe(currentRoot);
    });

    it('should update tree after expanding root', () => {
      const newRoot = treeState.tree.children[0];
      treeState.collapseRoot(newRoot);

      const notifySpy = vi.spyOn(treeState, 'notify');
      treeState.expandRoot();

      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('_copyTree', () => {
    it('should create a copy of the tree', () => {
      const originalTree = treeState.tree;
      treeState._copyTree();

      expect(treeState.tree).not.toBe(originalTree);
      expect(treeState.tree.descendants().length).toBe(originalTree.descendants().length);
    });

    it('should copy metadata', () => {
      const tableId = treeData.addTable(metadataTable);
      treeState._copyTree();

      const leafA = treeState.tree.leaves().find(d => d.data.name === 'A');
      expect(leafA.metadata).toBeDefined();
      expect(leafA.metadata[`${tableId}_value1`]).toBe('10');
    });

    it('should copy leafCount', () => {
      treeState._copyTree();

      treeState.tree.each(node => {
        expect(node.leafCount).toBeDefined();
      });
    });

    it('should copy collapsed properties', () => {
      const internalNode = treeState.displayedRoot.children[0];
      internalNode.collapsed_children = internalNode.children;
      internalNode.collapsed_children_name = 'TestGroup';
      internalNode.children = null;

      treeState._copyTree();

      const copiedNode = treeState.tree.children[0];
      expect(copiedNode.collapsed_children).toBeDefined();
      expect(copiedNode.collapsed_children_name).toBe('TestGroup');
    });

    it('should handle null displayedRoot gracefully', () => {
      treeState.displayedRoot = null;
      expect(() => treeState._copyTree()).not.toThrow();
    });
  });

  describe('Subscribable integration', () => {
    it('should allow subscribing to treeChange events', () => {
      const callback = vi.fn();
      treeState.subscribe('treeChange', callback);

      treeState.updateCoordinates();

      expect(callback).toHaveBeenCalled();
    });

    it('should allow subscribing to fontChange events', () => {
      const callback = vi.fn();
      treeState.subscribe('fontChange', callback);

      treeState.setTipLabelColorSource('someColumn');

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn();
      const unsubscribe = treeState.subscribe('treeChange', callback);
      unsubscribe();

      callback.mockClear();
      treeState.updateCoordinates();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      treeState.subscribe('treeChange', callback1);
      treeState.subscribe('treeChange', callback2);

      treeState.updateCoordinates();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('integration with TreeData', () => {
    it('should respond to TreeData updates', () => {
      const notifySpy = vi.spyOn(treeState, 'updateScaling');

      // Subscribe to TreeData updates
      treeData.subscribe('update', () => {
        treeState.updateScaling();
      });

      // Add a table to trigger update
      treeData.addTable(metadataTable);

      expect(notifySpy).toHaveBeenCalled();
    });

    it('should use metadata from TreeData', () => {
      const tableId = treeData.addTable(metadataTable);
      const columnId = `${tableId}_value1`;

      treeState.setTipLabelTextSource(columnId);

      const leafA = treeState.tree.leaves().find(d => d.data.name === 'A');
      expect(leafA.data.tipLabel).toBe('10');
    });
  });
});
