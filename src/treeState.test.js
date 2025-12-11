import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeState } from './treeState.js';
import { TreeData } from './treeData.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js';

describe('TreeState', () => {
  let treeState;
  let treeData;
  let textSizeEstimator;
  let simpleNewick;
  let complexNewick;
  let metadataTable;

  beforeEach(() => {
    simpleNewick = '((A:0.1,B:0.2)C:0.3,D:0.4)E;';
    complexNewick = '((A:0.1,B:0.2)C:0.3,(D:0.4,E:0.5)F:0.6)G;';

    metadataTable = `node_id\tvalue1\tcategory1
A\t10\tred
B\t20\tblue
C\t15\tred
D\t25\tgreen`;

    treeData = new TreeData(simpleNewick, [metadataTable]);
    textSizeEstimator = new TextSizeEstimator();

    treeState = new TreeState({
      treeData: treeData,
      viewWidth: 800,
      viewHeight: 600
    }, textSizeEstimator);
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(treeState.state.layout).toBe('rectangular');
      expect(treeState.state.viewWidth).toBe(800);
      expect(treeState.state.viewHeight).toBe(600);
      expect(treeState.displayedRoot).toBeDefined();
      console.log(treeState);
    });

    it('should initialize with provided tree data', () => {
      expect(treeState.state.treeData).toBe(treeData);
      expect(treeState.displayedRoot).toBe(treeData.tree);
    });

    it('should initialize text size estimator', () => {
      expect(treeState.textSizeEstimator).toBe(textSizeEstimator);
    });

    it('should initialize aesthetics scales', () => {
      expect(treeState.aestheticsScales).toBeDefined();
      expect(typeof treeState.aestheticsScales).toBe('object');
    });

    it('should initialize with all aesthetic properties', () => {
      expect(treeState.state.aesthetics.tipLabelText).toBeNull();
      expect(treeState.state.aesthetics.tipLabelColor).toBeNull();
      expect(treeState.state.aesthetics.tipLabelSize).toBeNull();
      expect(treeState.state.aesthetics.tipLabelFont).toBeNull();
      expect(treeState.state.aesthetics.tipLabelStyle).toBeNull();
    });
  });

  describe('Layout Management', () => {
    it('should set layout to rectangular', () => {
      treeState.setLayout('rectangular');
      expect(treeState.state.layout).toBe('rectangular');
    });

    it('should set layout to circular', () => {
      treeState.setLayout('circular');
      expect(treeState.state.layout).toBe('circular');
    });

    it('should warn on invalid layout type', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
      treeState.setLayout('invalid');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid layout type: invalid');
      consoleSpy.mockRestore();
    });

    it('should not update if layout is the same', () => {
      const initialLayout = treeState.state.layout;
      treeState.setLayout(initialLayout);
      expect(treeState.state.layout).toBe(initialLayout);
    });

    it('should update coordinates when layout changes', () => {
      const callback = vi.fn();
      treeState.subscribe('coordinateChange', callback);

      treeState.setLayout('circular');

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Aesthetics', () => {
    it('should set aesthetics with null value', () => {
      treeState.setAesthetics({ tipLabelColor: null });
      expect(treeState.state.aesthetics.tipLabelColor).toBeNull();
    });

    it('should set aesthetics with column id', () => {
      const columnId = Array.from(treeData.columnType.keys()).find(
        key => treeData.columnType.get(key) === 'categorical'
      );

      treeState.setAesthetics({ tipLabelColor: columnId });
      expect(treeState.state.aesthetics.tipLabelColor).toBe(columnId);
    });

    it('should create color scale for categorical data', () => {
      const columnId = Array.from(treeData.columnType.keys()).find(
        key => treeData.columnType.get(key) === 'categorical'
      );

      treeState.setAesthetics({ tipLabelColor: columnId });
      expect(treeState.aestheticsScales.tipLabelColor).toBeDefined();
      expect(typeof treeState.aestheticsScales.tipLabelColor.getValue).toBe('function');
    });

    it('should create size scale for continuous data', () => {
      treeState.setAesthetics({ tipLabelSize: 'value1' });
      expect(treeState.aestheticsScales.tipLabelSize).toBeDefined();
      expect(typeof treeState.aestheticsScales.tipLabelSize.getValue).toBe('function');
    });

    it('should apply aesthetic values to tree nodes', () => {
      const columnId = Array.from(treeData.columnType.keys()).find(
        key => treeData.columnType.get(key) === 'categorical'
      );

      treeState.setAesthetics({ tipLabelColor: columnId });

      treeData.tree.each(node => {
        expect(node.tipLabelColor).toBeDefined();
      });
    });

    it('should use default values when aesthetic is null', () => {
      treeState.setAesthetics({ tipLabelColor: null });

      const scale = treeState.aestheticsScales.tipLabelColor;
      expect(scale.getValue()).toBe('#000000');
    });
  });

  describe('Tree Dimensions', () => {
    it('should set target tree dimensions', () => {
      treeState.setTargetTreeDimensions(1000, 800);
      expect(treeState.state.viewWidth).toBe(1000);
      expect(treeState.state.viewHeight).toBe(800);
    });

    it('should have scaling factors after initialization', () => {
      expect(treeState.branchLenToPxFactor).toBeDefined();
      expect(treeState.labelSizeToPxFactor).toBeDefined();
      expect(treeState.branchLenToPxFactor).toBeGreaterThan(0);
      expect(treeState.labelSizeToPxFactor).toBeGreaterThan(0);
    });

    it('should recalculate scaling factors when dimensions change', () => {
      const oldBranchFactor = treeState.branchLenToPxFactor;
      treeState.setTargetTreeDimensions(1600, 1200);
      expect(treeState.branchLenToPxFactor).not.toBe(oldBranchFactor);
    });
  });

  describe('Subtree Collapse/Expand', () => {
    it('should collapse a subtree', () => {
      const nodeToCollapse = treeData.tree.children[1];
      const originalChildren = nodeToCollapse.children;

      treeState.collapseSubtree(nodeToCollapse);

      expect(nodeToCollapse.children).toBeNull();
      expect(nodeToCollapse.collapsedChildren).toBe(originalChildren);
    });

    it('should expand a collapsed subtree', () => {
      const nodeToCollapse = treeData.tree.children[1];
      const originalChildren = nodeToCollapse.children;

      treeState.collapseSubtree(nodeToCollapse);
      treeState.expandSubtree(nodeToCollapse);

      expect(nodeToCollapse.children).toBe(originalChildren);
      expect(nodeToCollapse.collapsedChildren).toBeNull();
    });

    it('should not collapse a node without children', () => {
      const leafNode = treeData.tree.leaves()[0];
      treeState.collapseSubtree(leafNode);
      expect(leafNode.collapsedChildren).toBeUndefined();
    });

    it('should not expand a node without collapsed children', () => {
      const nodeWithoutCollapsed = treeData.tree.children[1];
      treeState.expandSubtree(nodeWithoutCollapsed);
      expect(nodeWithoutCollapsed.children).toBeDefined();
    });

    it('should update layout after collapsing subtree', () => {
      const callback = vi.fn();
      treeState.subscribe('coordinateChange', callback);

      const nodeToCollapse = treeData.tree.children[1];
      treeState.collapseSubtree(nodeToCollapse);

      expect(callback).toHaveBeenCalled();
    });

    it('should update layout after expanding subtree', () => {
      const nodeToCollapse = treeData.tree.children[1];
      treeState.collapseSubtree(nodeToCollapse);

      const callback = vi.fn();
      treeState.subscribe('coordinateChange', callback);

      treeState.expandSubtree(nodeToCollapse);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Root Collapse/Expand', () => {
    it('should collapse root to a child node', () => {
      const newRoot = treeData.tree.children[0];
      const originalParent = newRoot.parent;

      treeState.collapseRoot(newRoot);

      expect(treeState.displayedRoot).toBe(newRoot);
      expect(newRoot.collapsedParent).toBe(originalParent);
      expect(newRoot.parent).toBeNull();
    });

    it('should expand collapsed root', () => {
      const newRoot = treeData.tree.children[0];

      treeState.collapseRoot(newRoot);
      treeState.expandRoot();

      expect(treeState.displayedRoot).toBe(treeData.tree);
      expect(newRoot.collapsedParent).toBeNull();
    });

    it('should not collapse root if node is already displayed root', () => {
      const currentRoot = treeState.displayedRoot;
      treeState.collapseRoot(currentRoot);
      expect(treeState.displayedRoot).toBe(currentRoot);
    });

    it('should not expand root if no collapsed parent exists', () => {
      const currentRoot = treeState.displayedRoot;
      treeState.expandRoot();
      expect(treeState.displayedRoot).toBe(currentRoot);
    });

    it('should update layout after collapsing root', () => {
      const callback = vi.fn();
      treeState.subscribe('coordinateChange', callback);

      const newRoot = treeData.tree.children[0];
      treeState.collapseRoot(newRoot);

      expect(callback).toHaveBeenCalled();
    });

    it('should update layout after expanding root', () => {
      const newRoot = treeData.tree.children[0];
      treeState.collapseRoot(newRoot);

      const callback = vi.fn();
      treeState.subscribe('coordinateChange', callback);

      treeState.expandRoot();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers on coordinate change', () => {
      const callback = vi.fn();
      treeState.subscribe('coordinateChange', callback);

      treeState.setTargetTreeDimensions(1000, 800);

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = treeState.subscribe('coordinateChange', callback);

      unsubscribe();
      treeState.setTargetTreeDimensions(1000, 800);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      treeState.subscribe('coordinateChange', callback1);
      treeState.subscribe('coordinateChange', callback2);

      treeState.setTargetTreeDimensions(1000, 800);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization without tree data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      new TreeState({}, textSizeEstimator);

      expect(consoleSpy).toHaveBeenCalledWith('TreeState initialized without valid tree data');
      consoleSpy.mockRestore();
    });

    it('should handle initialization without text size estimator', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      new TreeState({ treeData: treeData }, null);

      expect(consoleSpy).toHaveBeenCalledWith('TreeState initialized without textSizeEstimator');
      consoleSpy.mockRestore();
    });
  });

  describe('Complex Tree Operations', () => {
    beforeEach(() => {
      treeData = new TreeData(complexNewick, [metadataTable]);
      treeState = new TreeState({
        treeData: treeData,
        viewWidth: 800,
        viewHeight: 600
      }, textSizeEstimator);
    });

    it('should handle multiple collapse operations', () => {
      const node1 = treeData.tree.children[0];
      const node2 = treeData.tree.children[1];

      treeState.collapseSubtree(node1);
      treeState.collapseSubtree(node2);

      expect(node1.children).toBeNull();
      expect(node2.children).toBeNull();
      expect(node1.collapsedChildren).toBeDefined();
      expect(node2.collapsedChildren).toBeDefined();
    });

    it('should handle nested root collapse', () => {
      const level1 = treeData.tree.children[0];
      const level2 = level1.children[0];

      treeState.collapseRoot(level1);
      expect(treeState.displayedRoot).toBe(level1);

      treeState.collapseRoot(level2);
      expect(treeState.displayedRoot).toBe(level2);
    });

    it('should restore full tree after multiple root expansions', () => {
      const level1 = treeData.tree.children[0];
      const level2 = level1.children[0];

      treeState.collapseRoot(level1);
      treeState.collapseRoot(level2);

      treeState.expandRoot();
      expect(treeState.displayedRoot).toBe(level1);

      treeState.expandRoot();
      expect(treeState.displayedRoot).toBe(treeData.tree);
    });
  });

  describe('Coordinate Calculations', () => {
    it('should calculate pixel coordinates for all nodes', () => {
      treeData.tree.each(node => {
        if (treeState.state.layout === 'rectangular') {
          expect(node.xPx).toBeDefined();
          expect(node.yPx).toBeDefined();
        } else {
          expect(node.radiusPx).toBeDefined();
          expect(node.xPx).toBeDefined();
          expect(node.yPx).toBeDefined();
        }
      });
    });

    it('should calculate bounds for all nodes', () => {
      treeData.tree.each(node => {
        expect(node.bounds).toBeDefined();
        if (treeState.state.layout === 'rectangular') {
          expect(node.bounds.minX).toBeDefined();
          expect(node.bounds.maxX).toBeDefined();
          expect(node.bounds.minY).toBeDefined();
          expect(node.bounds.maxY).toBeDefined();
        } else {
          expect(node.bounds.minRadius).toBeDefined();
          expect(node.bounds.maxRadius).toBeDefined();
          expect(node.bounds.minAngle).toBeDefined();
          expect(node.bounds.maxAngle).toBeDefined();
        }
      });
    });

    it('should update coordinates when switching layouts', () => {
      const rectXPx = treeData.tree.xPx;

      treeState.setLayout('circular');

      const circRadiusPx = treeData.tree.radiusPx;
      expect(circRadiusPx).toBeDefined();
      expect(treeData.tree.angle).toBeDefined();
    });
  });
});
