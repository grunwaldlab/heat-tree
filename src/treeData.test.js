import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeData } from './treeData.js';

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
      expect(treeData.metadataTables.size).toBe(0);
      expect(treeData.enabledTables.size).toBe(0);
    });

    it('should create a TreeData instance with multiple metadata tables', () => {
      const treeData = new TreeData(simpleNewick, [metadataTable1, metadataTable2]);
      expect(treeData.metadataTables.size).toBe(2);
      expect(treeData.enabledTables.size).toBe(2);
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
      treeData.subscribe('update', callback);

      treeData.setTree(complexNewick);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        tree: treeData.tree,
        columnTypes: treeData.columnTypes
      }));
    });
  });

  describe('addTable', () => {
    it('should add a metadata table with auto-generated ID', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      expect(tableId).toBe('table_0');
      expect(treeData.metadataTables.has(tableId)).toBe(true);
    });

    it('should add a metadata table with custom ID', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1, 'custom_id');

      expect(tableId).toBe('custom_id');
      expect(treeData.metadataTables.has('custom_id')).toBe(true);
    });

    it('should enable table by default', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      expect(treeData.enabledTables.has(tableId)).toBe(true);
    });

    it('should not enable table if enable=false', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1, null, false);

      expect(treeData.enabledTables.has(tableId)).toBe(false);
    });

    it('should increment auto-generated IDs', () => {
      const treeData = new TreeData(simpleNewick);
      const id1 = treeData.addTable(metadataTable1);
      const id2 = treeData.addTable(metadataTable2);

      expect(id1).toBe('table_0');
      expect(id2).toBe('table_1');
    });

    it('should notify subscribers when table is added and enabled', () => {
      const treeData = new TreeData(simpleNewick);
      const callback = vi.fn();
      treeData.subscribe('update', callback);

      treeData.addTable(metadataTable1);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('deleteTable', () => {
    it('should remove a metadata table', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      treeData.deleteTable(tableId);

      expect(treeData.metadataTables.has(tableId)).toBe(false);
      expect(treeData.enabledTables.has(tableId)).toBe(false);
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
      treeData.subscribe('update', callback);

      callback.mockClear(); // Clear the subscription call
      treeData.deleteTable(tableId);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('enableTable', () => {
    it('should enable a disabled table', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1, null, false);

      expect(treeData.enabledTables.has(tableId)).toBe(false);

      treeData.enableTable(tableId);

      expect(treeData.enabledTables.has(tableId)).toBe(true);
    });

    it('should warn if table does not exist', () => {
      const treeData = new TreeData(simpleNewick);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      treeData.enableTable('nonexistent');

      expect(warnSpy).toHaveBeenCalledWith('Table nonexistent does not exist');
      warnSpy.mockRestore();
    });

    it('should not notify if table is already enabled', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const callback = vi.fn();
      treeData.subscribe('update', callback);

      callback.mockClear();
      treeData.enableTable(tableId); // Already enabled

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify subscribers when table is enabled', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1, null, false);
      const callback = vi.fn();
      treeData.subscribe('update', callback);

      treeData.enableTable(tableId);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('disableTable', () => {
    it('should disable an enabled table', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      expect(treeData.enabledTables.has(tableId)).toBe(true);

      treeData.disableTable(tableId);

      expect(treeData.enabledTables.has(tableId)).toBe(false);
    });

    it('should warn if table does not exist', () => {
      const treeData = new TreeData(simpleNewick);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      treeData.disableTable('nonexistent');

      expect(warnSpy).toHaveBeenCalledWith('Table nonexistent does not exist');
      warnSpy.mockRestore();
    });

    it('should not notify if table is already disabled', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1, null, false);
      const callback = vi.fn();
      treeData.subscribe('update', callback);

      treeData.disableTable(tableId); // Already disabled

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify subscribers when table is disabled', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);
      const callback = vi.fn();
      treeData.subscribe('update', callback);

      callback.mockClear();
      treeData.disableTable(tableId);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('attachTables', () => {
    it('should attach metadata to matching nodes', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);

      const leafA = treeData.tree.descendants().find(d => d.data.name === 'A');
      expect(leafA.metadata).toBeDefined();
      expect(leafA.metadata.value1).toBe('10');
      expect(leafA.metadata.category1).toBe('red');
    });

    it('should not attach metadata to non-matching nodes', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);

      const leafD = treeData.tree.descendants().find(d => d.data.name === 'D');
      expect(leafD.metadata).toBeDefined();
      expect(leafD.metadata.value1).toBeUndefined();
    });

    it('should merge metadata from multiple tables', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);
      treeData.addTable(metadataTable2);

      const leafA = treeData.tree.descendants().find(d => d.data.name === 'A');
      expect(leafA.metadata.value1).toBe('10');
      expect(leafA.metadata.value2).toBe('100');
      expect(leafA.metadata.category1).toBe('red');
      expect(leafA.metadata.category2).toBe('alpha');
    });

    it('should overwrite metadata from earlier tables with later tables', () => {
      const overlappingTable = `node_id\tvalue1\tcategory1
A\t999\tgreen`;

      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);
      treeData.addTable(overlappingTable);

      const leafA = treeData.tree.descendants().find(d => d.data.name === 'A');
      expect(leafA.metadata.value1).toBe('999');
      expect(leafA.metadata.category1).toBe('green');
    });

    it('should clear metadata when no tables are enabled', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      let leafA = treeData.tree.descendants().find(d => d.data.name === 'A');
      expect(leafA.metadata.value1).toBe('10');

      treeData.disableTable(tableId);

      leafA = treeData.tree.descendants().find(d => d.data.name === 'A');
      expect(leafA.metadata.value1).toBeUndefined();
    });
  });

  describe('inferTypes', () => {
    it('should infer column types from enabled tables', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);

      expect(treeData.columnTypes.has('value1')).toBe(true);
      expect(treeData.columnTypes.has('category1')).toBe(true);
    });

    it('should merge column types from multiple tables', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);
      treeData.addTable(metadataTable2);

      expect(treeData.columnTypes.has('value1')).toBe(true);
      expect(treeData.columnTypes.has('value2')).toBe(true);
      expect(treeData.columnTypes.has('category1')).toBe(true);
      expect(treeData.columnTypes.has('category2')).toBe(true);
    });

    it('should overwrite column types from earlier tables with later tables', () => {
      const table1 = `node_id\ttest_col
A\t10
B\t20`;

      const table2 = `node_id\ttest_col
A\tred
B\tblue`;

      const treeData = new TreeData(simpleNewick);
      treeData.addTable(table1);
      treeData.addTable(table2);

      // Later table should determine the type
      expect(treeData.columnTypes.get('test_col')).toBe('categorical');
    });

    it('should clear column types when no tables are enabled', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1);

      expect(treeData.columnTypes.size).toBeGreaterThan(0);

      treeData.disableTable(tableId);

      expect(treeData.columnTypes.size).toBe(0);
    });
  });

  describe('update', () => {
    it('should attach tables and infer types', () => {
      const treeData = new TreeData(simpleNewick);
      const tableId = treeData.addTable(metadataTable1, null, false);

      // Manually call update
      treeData.update();

      // Should not have metadata since table is disabled
      const leafA = treeData.tree.descendants().find(d => d.data.name === 'A');
      expect(leafA.metadata.value1).toBeUndefined();

      // Enable and update
      treeData.enableTable(tableId);

      // Now should have metadata
      const leafA2 = treeData.tree.descendants().find(d => d.data.name === 'A');
      expect(leafA2.metadata.value1).toBe('10');
    });

    it('should notify subscribers', () => {
      const treeData = new TreeData(simpleNewick);
      const callback = vi.fn();
      treeData.subscribe('update', callback);

      callback.mockClear();
      treeData.update();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        tree: treeData.tree,
        columnTypes: treeData.columnTypes
      }));
    });
  });

  describe('getColumnNames', () => {
    it('should return all column names from enabled tables', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);

      const columns = treeData.getColumnNames();
      expect(columns).toContain('value1');
      expect(columns).toContain('category1');
    });

    it('should return column names from multiple tables', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);
      treeData.addTable(metadataTable2);

      const columns = treeData.getColumnNames();
      expect(columns).toContain('value1');
      expect(columns).toContain('value2');
      expect(columns).toContain('category1');
      expect(columns).toContain('category2');
    });

    it('should return empty array when no tables are enabled', () => {
      const treeData = new TreeData(simpleNewick);

      const columns = treeData.getColumnNames();
      expect(columns).toEqual([]);
    });

    it('should not include duplicate column names', () => {
      const treeData = new TreeData(simpleNewick);
      treeData.addTable(metadataTable1);
      treeData.addTable(metadataTable1); // Add same table twice

      const columns = treeData.getColumnNames();
      const uniqueColumns = [...new Set(columns)];
      expect(columns.length).toBe(uniqueColumns.length);
    });
  });

  describe('Subscribable integration', () => {
    it('should allow subscribing to updates', () => {
      const treeData = new TreeData(simpleNewick);
      const callback = vi.fn();

      treeData.subscribe('update', callback);
      treeData.update();

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing from updates', () => {
      const treeData = new TreeData(simpleNewick);
      const callback = vi.fn();

      const unsubscribe = treeData.subscribe('update', callback);
      unsubscribe();

      callback.mockClear();
      treeData.update();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify multiple subscribers', () => {
      const treeData = new TreeData(simpleNewick);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      treeData.subscribe('update', callback1);
      treeData.subscribe('update', callback2);

      treeData.update();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});
