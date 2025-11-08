import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeData } from './treeData.js';
import { tree } from 'd3';

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
  });

});
