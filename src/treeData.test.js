import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeData } from './treeData.js';
import {
  NullScale,
  ContinuousSizeScale,
  ContinuousColorScale,
  CategoricalColorScale
} from './scales.js';

describe('TreeData', () => {
  let simpleNewick;
  let complexNewick;
  let metadataTable1;
  let metadataTable2;

  beforeEach(() => {
    simpleNewick = '((A:1,B:2)C:3,D:4)E;';

    complexNewick = '((A:0.1,B:0.2)C:0.3,(D:0.4,E:0.5)F:0.6)G;';

    metadataTable1 = `node_id\tvalue1\tcategory1
A\t10\tred
B\t20\tblue
C\t15\tred`;

    metadataTable2 = `node_id\tvalue2\tcategory2
A\t100\talpha
B\t200\tbeta
D\t300\talpha`;
  });

  describe('constructor', () => {
    it('should create a TreeData instance with a tree', () => {
      const treeData = new TreeData(simpleNewick);
      expect(treeData.tree).toBeDefined();
      expect(treeData.tree.data.name).toBe('E');
      expect(treeData.metadata.size).toBe(0);
    });

    it('should create a TreeData instance with multiple metadata tables', () => {
      const treeData = new TreeData(simpleNewick, [metadataTable1, metadataTable2]);
      expect(treeData.metadata.size).toBe(2);
    });
  });

  describe('parseTree', () => {
    it('should parse a simple Newick string', () => {
      const treeData = new TreeData(simpleNewick);
      const root = treeData.tree;

      expect(root.data.name).toBe('E');
      expect(root.children).toHaveLength(2);
    });

    it('should parse branch lengths', () => {
      const treeData = new TreeData(simpleNewick);
      const root = treeData.tree;

      const leafA = root.descendants().find(d => d.data.name === 'A');
      expect(leafA.data.length).toBe(1);

      const leafB = root.descendants().find(d => d.data.name === 'B');
      expect(leafB.data.length).toBe(2);
    });

    it('should assign unique IDs to all nodes', () => {
      const treeData = new TreeData(complexNewick);
      const ids = new Set();

      treeData.tree.each(d => {
        expect(d.id).toBeDefined();
        expect(typeof d.id).toBe('number');
        ids.add(d.id);
      });

      // All IDs should be unique
      expect(ids.size).toBe(treeData.tree.descendants().length);
    });

    it('should calculate leaf counts for all nodes', () => {
      const treeData = new TreeData(complexNewick);
      const root = treeData.tree;

      expect(root.leafCount).toBe(4); // A, B, D, E

      const nodeC = root.descendants().find(d => d.data.name === 'C');
      expect(nodeC.leafCount).toBe(2); // A, B

      const leafA = root.descendants().find(d => d.data.name === 'A');
      expect(leafA.leafCount).toBe(1);
    });

  });

  describe('setTree', () => {
    it('should replace the existing tree', () => {
      const treeData = new TreeData(simpleNewick);
      const oldRoot = treeData.tree;

      treeData.setTree(complexNewick);

      expect(treeData.tree).not.toBe(oldRoot);
      expect(treeData.tree.data.name).toBe('G');
    });

    it('should notify subscribers when tree is set', () => {
      const treeData = new TreeData(simpleNewick);
      const callback = vi.fn();
      treeData.subscribe('treeUpdated', callback);

      treeData.setTree(complexNewick);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining(treeData));
    });
  });

  describe('addTable', () => {
    it('should add a metadata table with auto-generated ID', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      expect(tableId).toBe('table_0');
      expect(treeData.metadata.has(tableId)).toBe(true);
    });

    it('should increment auto-generated IDs', () => {
      const treeData = new TreeData(simpleNewick);
      const id1 = treeData.addTable(metadataTable1);
      const id2 = treeData.addTable(metadataTable2);

      expect(id1).toBe('table_0');
      expect(id2).toBe('table_1');
    });

    it('should generate unique column IDs', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      const columns = Array.from(treeData.columnName.keys());

      expect(columns).toContain(`${tableId}_value1`);
      expect(columns).toContain(`${tableId}_category1`);
    });

    it('should store original column names', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      expect(treeData.columnName.get(`${tableId}_value1`)).toBe('value1');
      expect(treeData.columnName.get(`${tableId}_category1`)).toBe('category1');
    });

    it('should store display column names', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      expect(treeData.columnDisplayName.get(`${tableId}_value1`)).toBe('Value1');
      expect(treeData.columnDisplayName.get(`${tableId}_category1`)).toBe('Category1');
    });

    it('should notify subscribers when table is added and enabled', () => {
      const treeData = new TreeData(simpleNewick);
      const callback = vi.fn();
      treeData.subscribe('metadataAdded', callback);

      treeData.addTable(metadataTable1);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('deleteTable', () => {
    it('should remove a metadata table', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      treeData.deleteTable(tableId);

      expect(treeData.metadata.has(tableId)).toBe(false);
    });

    it('should remove column name mappings', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const uniqueId = `${tableId}_value1`;

      expect(treeData.columnType.has(uniqueId)).toBe(true);
      expect(treeData.columnName.has(uniqueId)).toBe(true);
      expect(treeData.columnDisplayName.has(uniqueId)).toBe(true);

      treeData.deleteTable(tableId);

      expect(treeData.columnType.has(uniqueId)).toBe(false);
      expect(treeData.columnName.has(uniqueId)).toBe(false);
      expect(treeData.columnDisplayName.has(uniqueId)).toBe(false);
    });

    it('should warn if table does not exist', () => {
      const treeData = new TreeData(simpleNewick);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      treeData.deleteTable('nonexistent');

      expect(warnSpy).toHaveBeenCalledWith('Table nonexistent does not exist');
      warnSpy.mockRestore();
    });

    it('should notify subscribers when table is deleted', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const callback = vi.fn();
      treeData.subscribe('metadataRemoved', callback);

      callback.mockClear(); // Clear the subscription call
      treeData.deleteTable(tableId);

      expect(callback).toHaveBeenCalled();
    });

    it('should remove associated color scales when table is deleted', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      // Access the scale to create it
      const scale = treeData.getColorScale(columnId);
      expect(scale).toBeDefined();

      // Delete the table
      treeData.deleteTable(tableId);

      // The scale should no longer exist
      expect(treeData.columnColorScale.has(columnId)).not.toBe(true);
    });

    it('should remove associated size scales when table is deleted', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      // Access the scale to create it
      const scale = treeData.getSizeScale(columnId);
      expect(scale).toBeDefined();

      // Delete the table
      treeData.deleteTable(tableId);

      // The scale should no longer exist
      expect(treeData.columnSizeScale.has(columnId)).not.toBe(true);
    });
  });

  describe('getColorScale', () => {
    it('should create a continuous color scale for continuous columns', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const scale = treeData.getColorScale(columnId);

      expect(scale).toBeInstanceOf(ContinuousColorScale);
    });

    it('should create a categorical color scale for categorical columns', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_category1`;

      const scale = treeData.getColorScale(columnId);

      expect(scale).toBeInstanceOf(CategoricalColorScale);
    });

    it('should return the same scale instance on subsequent calls', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const scale1 = treeData.getColorScale(columnId);
      const scale2 = treeData.getColorScale(columnId);

      expect(scale1).toBe(scale2);
    });

  });

  describe('setColorScale', () => {
    it('should set a custom color scale for a column', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const customScale = new NullScale('#FF0000');
      treeData.setColorScale(columnId, customScale);

      const retrievedScale = treeData.getColorScale(columnId);
      expect(retrievedScale).toBe(customScale);
    });

    it('should override automatically created scales', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      // Get the auto-created scale
      const autoScale = treeData.getColorScale(columnId);
      expect(autoScale).toBeInstanceOf(ContinuousColorScale);

      // Override with custom scale
      const customScale = new NullScale('#00FF00');
      treeData.setColorScale(columnId, customScale);

      const retrievedScale = treeData.getColorScale(columnId);
      expect(retrievedScale).toBe(customScale);
      expect(retrievedScale).not.toBe(autoScale);
    });
  });

  describe('getSizeScale', () => {
    it('should create a continuous size scale for continuous columns', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const scale = treeData.getSizeScale(columnId);

      expect(scale).toBeInstanceOf(ContinuousSizeScale);
    });

    it('should return the same scale instance on subsequent calls', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const scale1 = treeData.getSizeScale(columnId);
      const scale2 = treeData.getSizeScale(columnId);

      expect(scale1).toBe(scale2);
    });
  });

  describe('setSizeScale', () => {
    it('should set a custom size scale for a column', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const customScale = new NullScale(5);
      treeData.setSizeScale(columnId, customScale);

      const retrievedScale = treeData.getSizeScale(columnId);
      expect(retrievedScale).toBe(customScale);
    });

    it('should override automatically created scales', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      // Get the auto-created scale
      const autoScale = treeData.getSizeScale(columnId);
      console.log(treeData);
      expect(autoScale).toBeInstanceOf(ContinuousSizeScale);

      // Override with custom scale
      const customScale = new NullScale(10);
      treeData.setSizeScale(columnId, customScale);

      const retrievedScale = treeData.getSizeScale(columnId);
      expect(retrievedScale).toBe(customScale);
      expect(retrievedScale).not.toBe(autoScale);
    });
  });

});
