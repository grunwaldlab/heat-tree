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
  metadata = new Map();
  metadataTableNames = new Map(); // Map of table ID to display name
  columnType = new Map(); // e.g. 'continuous' or 'categorical', keyed by unique column ID
  columnName = new Map(); // Original column name, keyed by unique column ID
  columnDisplayName = new Map(); // Display-friendly column name, keyed by unique column ID
  columnAesthetic = new Map(); // Map of columnId -> Map of aestheticId -> Aesthetic
  #nextTableId = 0;

  constructor(newickStr, metadataTables = [], metadataTableNames = []) {
    super();

    this.tree = this.parseTree(newickStr);

    if (Array.isArray(metadataTables)) {
      metadataTables.forEach((tableStr, index) => {
        const tableName = metadataTableNames[index] || `Metadata ${index + 1}`;
        this.addTable(tableStr, tableName);
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
    this.metadata.keys().forEach(this.#attachTable);
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
   * Add a metadata table
   * @param {string} tableStr - TSV formatted string or path
   * @param {string} tableName - Display name for the table
   * @param {string} sep - Column separator (default: '\t')
   * @returns {string} The table ID
   */
  addTable(tableStr, tableName = null, sep = '\t') {
    // Parse table string
    const { metadataMap, columnTypes } = parseTable(tableStr, sep);

    // Generate unique column IDs for this table
    const id = `table_${this.#nextTableId++}`;

    // Set table name
    if (!tableName) {
      tableName = `Metadata ${this.#nextTableId}`;
    }
    this.metadataTableNames.set(id, tableName);

    const columnIdMap = new Map();
    for (const [originalName, columnType] of columnTypes) {
      const uniqueId = `${id}_${originalName}`;
      columnIdMap.set(originalName, uniqueId);
      this.columnType.set(uniqueId, columnType);
      this.columnName.set(uniqueId, originalName);
      this.columnDisplayName.set(uniqueId, columnToHeader(originalName));
    }

    // Transform metadata to use unique column IDs
    const transformedMetadata = new Map();
    for (const [nodeName, nodeData] of metadataMap) {
      const transformedNodeData = {};
      for (const [originalColumnName, value] of Object.entries(nodeData)) {
        const uniqueId = columnIdMap.get(originalColumnName);
        if (uniqueId) {
          transformedNodeData[uniqueId] = value;
        }
      }
      transformedMetadata.set(nodeName, transformedNodeData);
    }

    this.metadata.set(id, transformedMetadata);
    this.#attachTable(id);
    this.notify('metadataAdded', {
      tableId: id,
      columnIds: columnIdMap.values()
    });

    return id;
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
    const keys = Object.keys(table.values().next().value);

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
    this.notify('metadataRemoved', {
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
    const table = this.metadata.get(tableId);
    this.tree.each(d => {
      const nodeName = d.data.name;
      if (nodeName && table.has(nodeName)) {
        const tableMetadata = table.get(nodeName);
        d.metadata = { ...d.metadata, ...tableMetadata };
      }
    });
  }

  /**
   * Remove metadata from tree nodes
   */
  #detachTable(tableId) {
    const table = this.metadata.get(tableId);
    const keys = Object.keys(table.values().next().value);
    this.tree.each(d => {
      keys.forEach(key => {
        delete d[key];
      });
    });
  }

}
