import { hierarchy, ascending } from "d3";
import { parseNewick, parseTable } from "./parsers.js";
import { Subscribable, columnToHeader } from "./utils.js";
import { Aesthetic } from "./aesthetic.js";

/**
 * Manages tree data and metadata tables
 * Handles parsing, storage, and attachment of metadata to tree nodes
 */
export class TreeData extends Subscribable {

  tree;
  metadata = new Map(); // Map of table ID to array of row objects
  metadataTableNames = new Map(); // Map of table ID to display name
  columnType = new Map(); // e.g. 'continuous' or 'categorical', keyed by unique column ID
  columnName = new Map(); // Original column name, keyed by unique column ID
  columnDisplayName = new Map(); // Display-friendly column name, keyed by unique column ID
  columnAesthetic = new Map(); // Map of columnId -> Map of aestheticId -> Aesthetic
  nodeIdColumn = new Map(); // Map of table ID to the column name used for node IDs
  validIdColumns = new Map(); // Map of table ID to array of column names that contain valid node IDs
  #nextTableId = 0;

  constructor(newickStr, metadataTables = [], metadataTableNames = []) {
    super();

    this.tree = this.parseTree(newickStr);

    if (Array.isArray(metadataTables)) {
      metadataTables.forEach((tableStr, index) => {
        this.addTable(tableStr, metadataTableNames[index]);
      });
    }
  }

  /**
   * Parse a Newick string and create a hierarchy
   * @param {string} newickStr - Newick formatted string
   * @returns {object} D3 hierarchy object
   */
  parseTree(newickStr) {
    const treeData = parseNewick(newickStr);

    // Create a D3 hierarchy from the tree data and sort by size of subtree and branch length
    const root = hierarchy(treeData, d => d.children)
      .sum(d => d.children ? 0 : 1)
      .each(function(d) {
        d.leafCount = d.value;
        delete d.value;
        delete d.data.children;
      })
      .sort((a, b) => (a.leafCount - b.leafCount) || ascending(a.data.length, b.data.length));

    // Assign a stable, unique id to every node so D3 can track elements across updates
    let nodeId = 0;
    root.each(d => { d.id = ++nodeId; });

    return root;
  }

  /**
   * Parse and set the tree data
   * @param {string} newickStr - Newick formatted string or path
   */
  setTree(newickStr) {
    this.tree = this.parseTree(newickStr);
    this.metadata.keys().forEach(tableId => this.#attachTable(tableId));
    this.notify('treeUpdated', this);
  }

  /**
   * Get metadata table names
   * @returns {Array<string>} Array of metadata table names
   */
  getMetadataTableNames() {
    return Array.from(this.metadataTableNames.values());
  }

  /**
   * Get all node names from the tree
   * @returns {Set<string>} Set of all node names in the tree
   */
  getTreeNodeNames() {
    const nodeNames = new Set();
    this.tree.each(d => {
      if (d.data.name) {
        nodeNames.add(d.data.name);
      }
    });
    return nodeNames;
  }

  /**
   * Generate a Map from node ID to row data for a given table
   * @param {string} tableId - ID of the table
   * @returns {Map} Map from node ID to row data
   */
  #generateMetadataMap(tableId) {
    const rows = this.metadata.get(tableId);
    const idColumn = this.nodeIdColumn.get(tableId);

    if (!rows || !idColumn) {
      return new Map();
    }

    const metadataMap = new Map();
    for (const row of rows) {
      const nodeId = row[idColumn];
      if (nodeId) {
        metadataMap.set(nodeId, row);
      }
    }

    return metadataMap;
  }

  /**
   * Add a metadata table
   * @param {string} tableStr - TSV formatted string or path
   * @param {string} tableName - Display name for the table
   * @param {string} sep - Column separator (default: '\t')
   * @returns {string} The table ID
   */
  addTable(tableStr, tableName = null, sep = '\t') {
    // Parse table string (returns map keyed by row index)
    let { metadataMap, columnTypes, idColumns } = parseTable(tableStr, this.getTreeNodeNames(), sep);

    // Generate unique table ID
    const tableId = `table_${this.#nextTableId++}`;

    // Set table name
    if (!tableName) {
      tableName = `Metadata ${this.#nextTableId}`;
    }
    this.metadataTableNames.set(tableId, tableName);

    // Generate unique column IDs for this table (including the ID column)
    const columnIdMap = new Map();
    for (const [originalName, columnType] of columnTypes) {
      const uniqueId = `${tableId}_${originalName}`;
      columnIdMap.set(originalName, uniqueId);
      this.columnType.set(uniqueId, columnType);
      this.columnName.set(uniqueId, originalName);
      this.columnDisplayName.set(uniqueId, columnToHeader(originalName));
    }

    // Update the ID columns to their unique names
    idColumns = idColumns.map(x => columnIdMap.get(x));

    // Select the column with the most matches as the default ID column
    let selectedIdColumn = null;
    if (idColumns.length > 0) {
      selectedIdColumn = idColumns[0];
    } else {
      console.warn(`No valid node ID column found in table ${tableName}`);
    }

    // Transform metadata to use unique column IDs and convert to array
    const metadataArray = [];
    for (const nodeData of metadataMap.values()) {
      const transformedNodeData = {};
      for (const [originalColumnName, value] of Object.entries(nodeData)) {
        const uniqueId = columnIdMap.get(originalColumnName);
        if (uniqueId) {
          transformedNodeData[uniqueId] = value;
        }
      }
      metadataArray.push(transformedNodeData);
    }

    // Store valid ID columns for this table (just the column names)
    this.validIdColumns.set(tableId, idColumns);

    // Store which column is being used as the ID column
    this.nodeIdColumn.set(tableId, selectedIdColumn);

    // Store metadata as array
    this.metadata.set(tableId, metadataArray);

    this.#attachTable(tableId);
    this.notify('metadataAdded', {
      tableId: tableId,
      columnIds: Array.from(columnIdMap.values())
    });

    return tableId;
  }

  /**
   * Get valid ID columns for a table
   * @param {string} tableId - ID of the table
   * @returns {Array<string>} Array of column names that contain valid node IDs
   */
  getValidIdColumns(tableId) {
    return this.validIdColumns.get(tableId) || [];
  }

  /**
   * Get the current node ID column for a table
   * @param {string} tableId - ID of the table
   * @returns {string|null} Column name used as node ID, or null if none
   */
  getNodeIdColumn(tableId) {
    return this.nodeIdColumn.get(tableId);
  }

  /**
   * Get all column IDs for a table
   * @param {string} tableId - ID of the table
   * @returns {Array<string>} Array of column IDs in the table
   */
  getTableColumnIds(tableId) {
    const table = this.metadata.get(tableId);
    if (!table || table.length === 0) {
      return [];
    }
    return Object.keys(table[0]);
  }

  /**
   * Change the node ID column for a table
   * @param {string} tableId - ID of the table
   * @param {string} newIdColumnName - Name of the new ID column to use
   */
  setNodeIdColumn(tableId, newIdColumnName) {
    const table = this.metadata.get(tableId);
    if (!table) {
      console.warn(`Table ${tableId} does not exist`);
      return;
    }

    // Check if the new column is valid
    if (!this.validIdColumns.get(tableId).includes(newIdColumnName)) {
      console.warn(`Column ${newIdColumnName} is not a valid ID column for table ${tableId}`);
      return;
    }

    const oldIdColumn = this.nodeIdColumn.get(tableId);
    if (oldIdColumn === newIdColumnName) {
      // No change needed
      return;
    }

    // Get all column IDs for this table before making changes
    const columnIds = this.getTableColumnIds(tableId);

    // Clear all aesthetics for columns in this table since the data will change
    for (const columnId of columnIds) {
      this.columnAesthetic.delete(columnId);
    }

    // Detach current table from tree
    this.#detachTable(tableId);

    // Update the node ID column
    this.nodeIdColumn.set(tableId, newIdColumnName);

    // Re-attach the table to the tree with new keys
    this.#attachTable(tableId);

    // Notify listeners about the change with a flag indicating aesthetics need refresh
    this.notify('metadataChanged', {
      tableId: tableId,
      oldIdColumn: oldIdColumn,
      newIdColumn: newIdColumnName,
      columnIds: columnIds,
      requiresAestheticRefresh: true
    });

  }

  /**
   * Remove a metadata table
   * @param {string} tableId - ID of the table to remove
   */
  deleteTable(tableId) {
    const table = this.metadata.get(tableId);
    if (!table) {
      console.warn(`Table ${tableId} does not exist`);
      return;
    }

    // Get column keys from first row
    const keys = table.length > 0 ? Object.keys(table[0]) : [];

    // Remove data associated with columns in the table
    for (const uniqueId of keys) {
      this.columnType.delete(uniqueId);
      this.columnName.delete(uniqueId);
      this.columnDisplayName.delete(uniqueId);
      this.columnAesthetic.delete(uniqueId);
    }

    this.#detachTable(tableId);
    this.metadata.delete(tableId);
    this.metadataTableNames.delete(tableId);
    this.nodeIdColumn.delete(tableId);
    this.validIdColumns.delete(tableId);
    this.notify('metadataChanged', {
      tableId,
      columnIds: keys
    });
  }

  /**
   * Get the aesthetic for a column and aesthetic ID combination, creating it if needed
   * @param {string} columnId - The unique column ID
   * @param {string} aestheticId - The aesthetic ID (user-defined)
   * @param {object} defaultState - Default state to initialize the Aesthetic if it doesn't exist
   * @returns {Aesthetic} The aesthetic instance
   */
  getAesthetic(columnId, aestheticId, defaultState = {}) {
    // Ensure the column has an aesthetic map
    if (!this.columnAesthetic.has(columnId)) {
      this.columnAesthetic.set(columnId, new Map());
    }

    const aestheticMap = this.columnAesthetic.get(columnId);

    // Return existing aesthetic if available
    if (aestheticMap.has(aestheticId)) {
      return aestheticMap.get(aestheticId);
    }

    // Create new aesthetic based on column type and default state
    const aesthetic = this.#createAesthetic(columnId, defaultState);
    aestheticMap.set(aestheticId, aesthetic);
    return aesthetic;
  }

  /**
   * Set the aesthetic for a column and aesthetic ID combination
   * @param {string} columnId - The unique column ID
   * @param {string} aestheticId - The aesthetic ID (user-defined)
   * @param {Aesthetic} aesthetic - The aesthetic instance to set
   */
  setAesthetic(columnId, aestheticId, aesthetic) {
    // Ensure the column has an aesthetic map
    if (!this.columnAesthetic.has(columnId)) {
      this.columnAesthetic.set(columnId, new Map());
    }

    this.columnAesthetic.get(columnId).set(aestheticId, aesthetic);
  }

  /**
   * Create an aesthetic for a column based on its type and provided state
   * @private
   * @param {string} columnId - The unique column ID
   * @param {object} state - State options for the aesthetic
   * @returns {Aesthetic} The created aesthetic instance
   */
  #createAesthetic(columnId, state = {}) {
    const columnType = this.columnType.get(columnId);
    const isCategorical = columnType === 'categorical';

    if (!columnType) {
      console.error(`Column ${columnId} not found`);
    }

    // Collect all values for this column from the tree
    let values = [];
    this.tree.each(node => {
      if (node.metadata && node.metadata[columnId] !== undefined) {
        values.push(node.metadata[columnId]);
      }
    });

    if (values.length === 0) {
      console.error(`No values found for column ${columnId}`);
    }

    // Get display name for titles
    const displayName = this.columnDisplayName.get(columnId) || columnId;

    // Create aesthetic with provided state, filling in defaults
    const aesthetic = new Aesthetic(values, {
      isCategorical: isCategorical,
      inputUnits: displayName,
      ...state
    });

    return aesthetic;
  }

  /**
   * Add metadata to tree nodes
   */
  #attachTable(tableId) {
    const metadataMap = this.#generateMetadataMap(tableId);
    this.tree.each(d => {
      const nodeName = d.data.name;
      if (nodeName && metadataMap.has(nodeName)) {
        const tableMetadata = metadataMap.get(nodeName);
        d.metadata = { ...d.metadata, ...tableMetadata };
      }
    });
  }

  /**
   * Remove metadata from tree nodes
   */
  #detachTable(tableId) {
    const table = this.metadata.get(tableId);
    if (!table || table.length === 0) {
      return;
    }

    const keys = Object.keys(table[0]);
    this.tree.each(d => {
      if (d.metadata) {
        keys.forEach(key => {
          delete d.metadata[key];
        });
      }
    });
  }

}
