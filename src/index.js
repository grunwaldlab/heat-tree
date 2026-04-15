import { TreeData } from './treeData.js';
import { TreeState } from './treeState.js';
import { TreeView } from './treeView.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js';
import { createToolbar } from './toolbar.js';
import { injectStyles, ContainerResizeHandler } from './utils.js';

/**
 * Create a heat tree visualization
 * @param {string|HTMLElement} containerOrSelector - CSS selector for container element or the element itself
 * @param {Array|Object} treesInput - Array of tree objects, each with tree, name, and metadata (optional)
 * @param {Object} options - Configuration options
 * @param {string} options.isolation - CSS isolation mode: 'shadow' (default) or 'none'
 * @returns {Object} Object containing references to tree components
 */
export function heatTree(containerOrSelector, treesInput = [], options = {}) {
  if (treesInput && !Array.isArray(treesInput)) {
    treesInput = [treesInput];
  }
  if (treesInput === undefined || treesInput === null) {
    treesInput = [];
  }

  // Set default options
  options = {
    buttonSize: 25,
    transitionDuration: 500,
    manualZoomAndPanEnabled: true,
    autoZoom: 'Default',
    autoPan: 'Default',
    isolation: 'shadow',
    ...options
  };

  // Determine isolation mode and set up root
  const isolation = options.isolation;
  let root; // The root for style injection and DOM queries (document or shadowRoot)

  // Initialize text size estimator (shared across all trees)
  // Always append to document.body since it needs to be in a rendered context for measurement
  const textSizeEstimator = new TextSizeEstimator();

  // Create TreeData instances for each tree
  const treeDataInstances = new Map();
  const treeConfigAesthetics = new Map();

  treesInput.forEach((treeConfig, index) => {
    if (!treeConfig.tree) {
      throw new Error(`Tree at index ${index} is missing tree string`);
    }

    const sourceName = treeConfig.name || `Tree ${index + 1}`;

    // Process metadata tables - can be array of objects with name and data, or just data objects
    let metadataTables = [];
    let metadataNames = [];

    if (treeConfig.metadata) {
      const metadataArray = Array.isArray(treeConfig.metadata) ? treeConfig.metadata : [treeConfig.metadata];

      metadataArray.forEach((metadataItem, metaIndex) => {
        if (metadataItem.name && metadataItem.data) {
          // Named metadata table
          metadataTables.push(metadataItem.data);
          metadataNames.push(metadataItem.name);
        } else {
          // Unnamed metadata table - use as-is
          metadataTables.push(metadataItem);
          metadataNames.push(`Metadata ${metaIndex + 1}`);
        }
      });
    }

    // Parse trees - may return multiple from NEXUS
    const parsedTrees = TreeData.parseTrees(treeConfig.tree, sourceName);

    parsedTrees.forEach(({ name: parsedName, treeData: parsedTreeData }, treeIndex) => {
      // Ensure unique name
      let uniqueName = parsedName;
      let counter = 1;
      while (treeDataInstances.has(uniqueName)) {
        uniqueName = `${parsedName} (${counter})`;
        counter++;
      }

      // Create TreeData with the parsed tree object
      const treeData = new TreeData(parsedTreeData, metadataTables, metadataNames);

      // Process aesthetics if provided
      let treeAesthetics;
      if (treeConfig.aesthetics) {
        treeAesthetics = Object.fromEntries(
          Object.entries(treeConfig.aesthetics).map(([aes, col]) => {
            for (const [assignedColId, originalName] of treeData.columnName.entries()) {
              if (originalName === col) {
                return [aes, assignedColId];
              }
            }
            return undefined;
          }).filter(entry => entry !== undefined)
        );
      } else {
        treeAesthetics = undefined;
      }

      treeDataInstances.set(uniqueName, treeData);
      treeConfigAesthetics.set(uniqueName, treeAesthetics);
    });
  });

  // Cache for TreeState and TreeView instances
  const treeStateCache = new Map();
  const treeViewCache = new Map();

  // Get container element (accepts CSS selector string or HTMLElement)
  let container;
  if (typeof containerOrSelector === 'string') {
    container = document.querySelector(containerOrSelector);
    if (!container) {
      throw new Error(`Container element not found: ${containerOrSelector}`);
    }
  } else if (containerOrSelector instanceof HTMLElement) {
    container = containerOrSelector;
  } else {
    throw new Error('First argument must be a CSS selector string or an HTMLElement');
  }

  // Set up Shadow DOM if isolation mode is 'shadow'
  let shadowRoot = null;
  if (isolation === 'shadow') {
    shadowRoot = container.attachShadow({ mode: 'open' });
    root = shadowRoot;
  } else {
    root = document;
  }

  // Inject styles into the appropriate root
  injectStyles(root);

  // Create main widget structure
  const widgetDiv = document.createElement('div');
  widgetDiv.className = 'ht-widget';
  const toolbarDiv = document.createElement('div');
  toolbarDiv.className = 'ht-toolbar';
  const treeDiv = document.createElement('div');
  treeDiv.className = 'ht-tree';
  const treeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  // Assemble widget structure
  treeDiv.appendChild(treeSvg);
  widgetDiv.appendChild(toolbarDiv);
  widgetDiv.appendChild(treeDiv);

  // Append widget to shadow root or container directly
  if (shadowRoot) {
    shadowRoot.appendChild(widgetDiv);
  } else {
    container.appendChild(widgetDiv);
  }

  // Track current tree
  let currentTreeName = null;
  let currentTreeState = null;
  let currentTreeView = null;

  // Store toolbar refresh function
  let refreshToolbar = null;

  const resizeHandler = new ContainerResizeHandler(
    treeDiv,
    (details) => {
      if (currentTreeView) {
        currentTreeView.fitToView();
      }
    },
    {
      debounce: 100,
      immediate: true
    }
  );

  /**
   * Add a new tree to the visualization
   * @param {string} treeName - Name for the new tree
   * @param {string} treeString - Newick or NEXUS string for the tree(s)
   * @param {Array} metadataTables - Optional array of metadata table strings
   * @param {Array} metadataNames - Optional array of metadata table names
   * @returns {Array<string>} Array of unique names of trees added
   */
  function addNewTree(treeName, treeString, metadataTables = [], metadataNames = []) {
    // Parse trees - may return multiple from NEXUS
    const parsedTrees = TreeData.parseTrees(treeString, treeName);
    const addedNames = [];

    parsedTrees.forEach(({ name: parsedName, treeData: parsedTreeData }) => {
      // Ensure unique name
      let uniqueName = parsedName;
      let counter = 1;
      while (treeDataInstances.has(uniqueName)) {
        uniqueName = `${parsedName} (${counter})`;
        counter++;
      }

      // Create TreeData with the parsed tree object
      const treeData = new TreeData(parsedTreeData, metadataTables, metadataNames);
      treeDataInstances.set(uniqueName, treeData);
      addedNames.push(uniqueName);
    });

    return addedNames;
  }

  /**
   * Switch to a different tree
   * @param {string} treeName - Name of the tree to switch to
   */
  function switchToTree(treeName) {
    if (!treeDataInstances.has(treeName)) {
      console.error(`Tree not found: ${treeName}`);
      return;
    }

    // If switching to the same tree, do nothing
    if (currentTreeName === treeName && currentTreeView) {
      return;
    }

    // Clear the SVG before switching trees
    while (treeSvg.firstChild) {
      treeSvg.removeChild(treeSvg.firstChild);
    }

    // Get or create TreeState for this tree
    if (!treeStateCache.has(treeName)) {
      const treeState = new TreeState({
        treeData: treeDataInstances.get(treeName),
        aesthetics: treeConfigAesthetics.get(treeName),
        ...options
      }, textSizeEstimator);
      treeStateCache.set(treeName, treeState);
    }

    // Get or create TreeView for this tree
    if (!treeViewCache.has(treeName)) {
      const treeState = treeStateCache.get(treeName);
      const treeView = new TreeView(treeState, treeSvg, options);
      treeViewCache.set(treeName, treeView);
    } else {
      // Reattach existing TreeView to the SVG
      const treeView = treeViewCache.get(treeName);
      treeView.reattach(treeSvg);
    }

    // Update current references
    currentTreeName = treeName;
    currentTreeState = treeStateCache.get(treeName);
    currentTreeView = treeViewCache.get(treeName);

    // Refresh toolbar if the refresh function is available
    if (refreshToolbar) {
      refreshToolbar();
    }
  }

  // Create toolbar with tree switching capability
  refreshToolbar = createToolbar(
    toolbarDiv,
    treeDataInstances,
    () => currentTreeState,
    () => currentTreeView,
    switchToTree,
    addNewTree,
    options,
    root
  );

  // Display the first tree initially (if any trees exist)
  if (treeDataInstances.size > 0) {
    const firstTreeName = Array.from(treeDataInstances.keys())[0];
    switchToTree(firstTreeName);
  }

  // Return references to components
  return {
    treeDataInstances,
    treeStateCache,
    treeViewCache,
    getCurrentTreeState: () => currentTreeState,
    getCurrentTreeView: () => currentTreeView,
    getCurrentTreeName: () => currentTreeName,
    switchToTree,
    addNewTree,
    container: widgetDiv,
    shadowRoot
  };
}
