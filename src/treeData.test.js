import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeData } from './treeData.js';
import { parseNewick } from './parsers.js';
import {
  NullScale,
  CategoricalTextScale,
  ContinuousSizeScale,
  ContinuousColorScale,
  CategoricalColorScale
} from './scales.js';

describe('TreeData', () => {
  let simpleNewick;
  let complexNewick;
  let simpleParsed;
  let complexParsed;
  let metadataTable1;
  let metadataTable2;

  beforeEach(() => {
    simpleNewick = '((A:1,B:2)C:3,D:4)E;';
    simpleParsed = parseNewick(simpleNewick);

    complexNewick = '((A:0.1,B:0.2)C:0.3,(D:0.4,E:0.5)F:0.6)G;';
    complexParsed = parseNewick(complexNewick);

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
      const treeData = new TreeData(simpleParsed);
      expect(treeData.tree).toBeDefined();
      expect(treeData.tree.data.name).toBe('E');
      expect(treeData.metadata.size).toBe(0);
    });

    it('should create a TreeData instance with multiple metadata tables', () => {
      const treeData = new TreeData(simpleParsed, [metadataTable1, metadataTable2]);
      expect(treeData.metadata.size).toBe(2);
    });
  });

  describe('fromTreeString', () => {
    it('should create a TreeData instance from a Newick string', () => {
      const treeData = TreeData.fromTreeString(simpleNewick);
      expect(treeData.tree).toBeDefined();
      expect(treeData.tree.data.name).toBe('E');
    });

    it('should create a TreeData instance with metadata from a Newick string', () => {
      const treeData = TreeData.fromTreeString(simpleNewick, [metadataTable1]);
      expect(treeData.metadata.size).toBe(1);
    });
  });

  describe('parseTrees', () => {
    it('should parse a single Newick string', () => {
      const trees = TreeData.parseTrees(simpleNewick, 'MyTree');
      expect(trees).toHaveLength(1);
      expect(trees[0].name).toBe('MyTree');
      expect(trees[0].treeData).toBeDefined();
    });

    it('should parse Newick string and return parsed tree data', () => {
      const trees = TreeData.parseTrees(simpleNewick, 'MyTree');
      expect(trees[0].treeData.name).toBe('E');
    });
  });

  describe('createHierarchy', () => {
    it('should create a D3 hierarchy from parsed tree data', () => {
      const treeData = new TreeData(simpleParsed);
      const root = treeData.tree;

      expect(root.data.name).toBe('E');
      expect(root.children).toHaveLength(2);
    });

    it('should parse branch lengths', () => {
      const treeData = new TreeData(simpleParsed);
      const root = treeData.tree;

      const leafA = root.descendants().find(d => d.data.name === 'A');
      expect(leafA.data.length).toBe(1);

      const leafB = root.descendants().find(d => d.data.name === 'B');
      expect(leafB.data.length).toBe(2);
    });

    it('should assign unique IDs to all nodes', () => {
      const treeData = new TreeData(complexParsed);
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
      const treeData = new TreeData(complexParsed);
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
      const treeData = new TreeData(simpleParsed);
      const oldRoot = treeData.tree;

      treeData.setTree(complexParsed);

      expect(treeData.tree).not.toBe(oldRoot);
      expect(treeData.tree.data.name).toBe('G');
    });

    it('should notify subscribers when tree is set', () => {
      const treeData = new TreeData(simpleParsed);
      const callback = vi.fn();
      treeData.subscribe('treeUpdated', callback);

      treeData.setTree(complexParsed);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining(treeData));
    });
  });

  describe('addTable', () => {
    it('should add a metadata table with auto-generated ID', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);

      expect(tableId).toBe('table_0');
      expect(treeData.metadata.has(tableId)).toBe(true);
    });

    it('should increment auto-generated IDs', () => {
      const treeData = new TreeData(simpleParsed);
      const id1 = treeData.addTable(metadataTable1);
      const id2 = treeData.addTable(metadataTable2);

      expect(id1).toBe('table_0');
      expect(id2).toBe('table_1');
    });

    it('should generate unique column IDs', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);

      const columns = Array.from(treeData.columnName.keys());

      expect(columns).toContain(`${tableId}_value1`);
      expect(columns).toContain(`${tableId}_category1`);
    });

    it('should store original column names', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);

      expect(treeData.columnName.get(`${tableId}_value1`)).toBe('value1');
      expect(treeData.columnName.get(`${tableId}_category1`)).toBe('category1');
    });

    it('should store display column names', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);

      expect(treeData.columnDisplayName.get(`${tableId}_value1`)).toBe('Value1');
      expect(treeData.columnDisplayName.get(`${tableId}_category1`)).toBe('Category1');
    });

    it('should notify subscribers when table is added and enabled', () => {
      const treeData = new TreeData(simpleParsed);
      const callback = vi.fn();
      treeData.subscribe('metadataAdded', callback);

      treeData.addTable(metadataTable1);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('deleteTable', () => {
    it('should remove a metadata table', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);

      treeData.deleteTable(tableId);

      expect(treeData.metadata.has(tableId)).toBe(false);
    });

    it('should remove column name mappings', () => {
      const treeData = new TreeData(simpleParsed);
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
      const treeData = new TreeData(simpleParsed);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      treeData.deleteTable('nonexistent');

      expect(warnSpy).toHaveBeenCalledWith('Table nonexistent does not exist');
      warnSpy.mockRestore();
    });

    it('should notify subscribers when table is deleted', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);
      const callback = vi.fn();
      treeData.subscribe('metadataChanged', callback);

      callback.mockClear(); // Clear any previous calls
      treeData.deleteTable(tableId);

      expect(callback).toHaveBeenCalled();
    });

    it('should remove associated aesthetics when table is deleted', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      // Access the aesthetic to create it
      const aesthetic = treeData.getAesthetic(columnId, 'color');
      expect(aesthetic).toBeDefined();

      // Delete the table
      treeData.deleteTable(tableId);

      // The aesthetic should no longer exist
      expect(treeData.columnAesthetic.has(columnId)).not.toBe(true);
    });

  });

  describe('getAesthetic', () => {
    it('should create an aesthetic for continuous columns', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const aesthetic = treeData.getAesthetic(columnId, 'color');

      expect(aesthetic).toBeDefined();
    });

    it('should create an aesthetic for categorical columns', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_category1`;

      const aesthetic = treeData.getAesthetic(columnId, 'color');

      expect(aesthetic).toBeDefined();
    });

    it('should return the same aesthetic instance on subsequent calls', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      const aesthetic1 = treeData.getAesthetic(columnId, 'color');
      const aesthetic2 = treeData.getAesthetic(columnId, 'color');

      expect(aesthetic1).toBe(aesthetic2);
    });

  });

  describe('setAesthetic', () => {
    it('should set a custom aesthetic for a column', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      // Get auto-created aesthetic first to initialize
      const autoAesthetic = treeData.getAesthetic(columnId, 'color');
      expect(autoAesthetic).toBeDefined();

      // Create a new aesthetic (simulating custom one)
      const customAesthetic = treeData.getAesthetic(columnId, 'customColor');

      // Set the custom aesthetic
      treeData.setAesthetic(columnId, 'color', customAesthetic);

      const retrievedAesthetic = treeData.getAesthetic(columnId, 'color');
      expect(retrievedAesthetic).toBe(customAesthetic);
    });

    it('should allow multiple aesthetics for same column', () => {
      const treeData = new TreeData(simpleParsed);
      const tableId = treeData.addTable(metadataTable1);
      const columnId = `${tableId}_value1`;

      // Get different aesthetics
      const colorAesthetic = treeData.getAesthetic(columnId, 'color');
      const sizeAesthetic = treeData.getAesthetic(columnId, 'size');

      expect(colorAesthetic).toBeDefined();
      expect(sizeAesthetic).toBeDefined();
      expect(colorAesthetic).not.toBe(sizeAesthetic);
    });
  });

});
