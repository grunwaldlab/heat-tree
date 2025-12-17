/**
 * Create and manage the toolbar with tabs and controls
 * @param {HTMLElement} toolbarDiv - Container for the toolbar
 * @param {Map} treeDataInstances - Map of tree names to TreeData instances
 * @param {Function} getCurrentTreeState - Function that returns the current TreeState
 * @param {Function} getCurrentTreeView - Function that returns the current TreeView
 * @param {Function} switchToTree - Function to switch to a different tree
 * @param {Function} addNewTree - Function to add a new tree
 * @param {Object} options - Configuration options
 * @returns {Function} Function to refresh the current tab's controls
 */
export function createToolbar(
  toolbarDiv,
  treeDataInstances,
  getCurrentTreeState,
  getCurrentTreeView,
  switchToTree,
  addNewTree,
  options
) {
  const CONTROL_HEIGHT = 24; // Standard height for all controls
  let currentTab = null;
  let selectedMetadata = null; // Track which metadata table is "selected" for future controls

  // Store references to buttons that need to be updated dynamically
  let expandSubtreesBtn = null;
  let expandRootBtn = null;
  let currentTreeStateSubscription = null;

  // Create tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'ht-tabs';

  // Create controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'ht-controls hidden';

  // Define tabs
  const tabs = [
    { id: 'data', label: 'Data' },
    { id: 'tree-manipulation', label: 'Tree Manipulation' },
    { id: 'tip-label-settings', label: 'Tip Label Settings' },
    { id: 'export', label: 'Export' }
  ];

  // Create tab elements
  const tabElements = {};
  tabs.forEach(tab => {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'ht-tab';
    tabDiv.textContent = tab.label;

    // Click handler
    tabDiv.addEventListener('click', () => {
      if (currentTab === tab.id) {
        // Clicking the same tab closes it
        closeTab();
      } else {
        // Open the new tab
        openTab(tab.id);
      }
    });

    tabElements[tab.id] = tabDiv;
    tabsContainer.appendChild(tabDiv);
  });

  // Function to get metadata table names for the current tree
  function getCurrentMetadataNames() {
    const treeState = getCurrentTreeState();
    if (!treeState || !treeState.state.treeData) return [];
    return treeState.state.treeData.getMetadataTableNames();
  }

  // Function to get the currently selected metadata table name
  function getSelectedMetadata() {
    return selectedMetadata;
  }

  // Function to set the currently selected metadata table
  function setSelectedMetadata(metadataName) {
    const metadataNames = getCurrentMetadataNames();
    if (metadataNames.includes(metadataName)) {
      selectedMetadata = metadataName;
    } else {
      console.warn(`Metadata table not found: ${metadataName}`);
    }
  }

  // Function to reset selected metadata when switching trees
  function resetSelectedMetadata() {
    const metadataNames = getCurrentMetadataNames();
    selectedMetadata = metadataNames.length > 0 ? metadataNames[0] : null;
  }

  // Function to update expand button states
  function updateExpandButtonStates() {
    const treeState = getCurrentTreeState();
    if (!treeState) return;

    // Update expand subtrees button
    if (expandSubtreesBtn) {
      let hasCollapsedSubtrees = false;
      treeState.displayedRoot.each(node => {
        if (node !== treeState.displayedRoot && node.collapsedChildren) {
          hasCollapsedSubtrees = true;
        }
      });
      expandSubtreesBtn.disabled = !hasCollapsedSubtrees;
    }

    // Update expand root button
    if (expandRootBtn) {
      expandRootBtn.disabled = !treeState.displayedRoot.collapsedParent;
    }
  }

  // Function to open a tab
  function openTab(tabId) {
    // Update current tab
    currentTab = tabId;

    // Update tab styles
    Object.keys(tabElements).forEach(id => {
      if (id === tabId) {
        tabElements[id].classList.add('active');
      } else {
        tabElements[id].classList.remove('active');
      }
    });

    // Show controls and populate with tab content
    controlsContainer.classList.remove('hidden');
    populateControls(tabId);
  }

  // Function to close the current tab
  function closeTab() {
    currentTab = null;

    // Reset all tab styles
    Object.keys(tabElements).forEach(id => {
      tabElements[id].classList.remove('active');
    });

    // Hide controls
    controlsContainer.classList.add('hidden');
    controlsContainer.innerHTML = '';
  }

  // Function to populate controls based on selected tab
  function populateControls(tabId) {
    controlsContainer.innerHTML = '';

    switch (tabId) {
      case 'data':
        populateDataControls(
          controlsContainer,
          treeDataInstances,
          getCurrentTreeState,
          switchToTree,
          addNewTree,
          getCurrentMetadataNames,
          getSelectedMetadata,
          setSelectedMetadata,
          resetSelectedMetadata,
          refreshCurrentTab,
          options,
          CONTROL_HEIGHT
        );
        break;
      case 'tree-manipulation':
        populateTreeManipulationControls(
          controlsContainer,
          getCurrentTreeState,
          refreshCurrentTab,
          updateExpandButtonStates,
          options,
          CONTROL_HEIGHT,
          (btn) => { expandSubtreesBtn = btn; },
          (btn) => { expandRootBtn = btn; }
        );
        break;
      case 'tip-label-settings':
        populateTipLabelSettingsControls(controlsContainer, getCurrentTreeState, options, CONTROL_HEIGHT);
        break;
      case 'export':
        populateExportControls(controlsContainer, getCurrentTreeState, getCurrentTreeView, options, CONTROL_HEIGHT);
        break;
    }
  }

  // Function to refresh the current tab (used when tree changes)
  function refreshCurrentTab() {
    resetSelectedMetadata();

    // Unsubscribe from previous tree state
    if (currentTreeStateSubscription) {
      currentTreeStateSubscription();
      currentTreeStateSubscription = null;
    }

    // Reset button references when switching trees
    expandSubtreesBtn = null;
    expandRootBtn = null;

    // Subscribe to coordinate changes in the new tree state
    const treeState = getCurrentTreeState();
    if (treeState) {
      currentTreeStateSubscription = treeState.subscribe('coordinateChange', updateExpandButtonStates);
    }

    if (currentTab) {
      populateControls(currentTab);
    }
  }

  // Append tabs and controls to toolbar
  toolbarDiv.appendChild(tabsContainer);
  toolbarDiv.appendChild(controlsContainer);

  // Open the first tab by default
  openTab(tabs[0].id);

  // Initialize selected metadata (will be set properly after first tree loads)
  resetSelectedMetadata();

  // Return the refresh function so it can be called from outside
  return refreshCurrentTab;
}

/**
 * Populate Data tab controls
 */
function populateDataControls(
  container,
  treeDataInstances,
  getCurrentTreeState,
  switchToTree,
  addNewTree,
  getCurrentMetadataNames,
  getSelectedMetadata,
  setSelectedMetadata,
  resetSelectedMetadata,
  refreshCurrentTab,
  options,
  controlHeight
) {
  container.innerHTML = '';

  // Select tree control
  const treeLabel = createLabel('Select tree:', controlHeight);
  container.appendChild(treeLabel);

  const treeSelect = document.createElement('select');
  treeSelect.className = 'ht-select';
  treeSelect.style.height = `${controlHeight}px`;

  // Populate tree options
  const treeNames = Array.from(treeDataInstances.keys());
  const currentTreeState = getCurrentTreeState();
  const currentTreeName = currentTreeState ? Array.from(treeDataInstances.entries()).find(([name, data]) => data === currentTreeState.state.treeData)?.[0] : null;

  treeNames.forEach((treeName) => {
    const option = document.createElement('option');
    option.value = treeName;
    option.textContent = treeName;
    if (treeName === currentTreeName) {
      option.selected = true;
    }
    treeSelect.appendChild(option);
  });

  // Handle tree selection change
  treeSelect.addEventListener('change', (e) => {
    switchToTree(e.target.value);
  });

  container.appendChild(treeSelect);

  // Create hidden file input for tree upload
  const treeFileInput = document.createElement('input');
  treeFileInput.type = 'file';
  treeFileInput.accept = '.nwk,.newick,.tree,.tre,.treefile';
  treeFileInput.style.display = 'none';

  // Handle file selection
  treeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const newickStr = await file.text();

      // Derive tree name from filename (remove extension)
      let treeName = file.name.replace(/\.(nwk|newick|tree|tre)$/i, '');

      // Ensure unique name
      let uniqueName = treeName;
      let counter = 1;
      while (treeDataInstances.has(uniqueName)) {
        uniqueName = `${treeName} (${counter})`;
        counter++;
      }

      // Add the new tree
      addNewTree(uniqueName, newickStr);

      // Reset the file input so the same file can be selected again
      treeFileInput.value = '';

      // Refresh the controls to show the new tree
      refreshCurrentTab();

      // Switch to the newly added tree
      switchToTree(uniqueName);
    } catch (error) {
      console.error('Error loading tree file:', error);
      alert(`Error loading tree file: ${error.message}`);
    }
  });

  container.appendChild(treeFileInput);

  const addTreeBtn = createButton('+', 'Add tree from Newick file', controlHeight);
  addTreeBtn.addEventListener('click', () => {
    treeFileInput.click();
  });
  container.appendChild(addTreeBtn);

  // Select metadata control
  const metadataLabel = createLabel('Select metadata:', controlHeight);
  container.appendChild(metadataLabel);

  const metadataSelect = document.createElement('select');
  metadataSelect.className = 'ht-select';
  metadataSelect.style.height = `${controlHeight}px`;

  // Populate metadata options
  const metadataNames = getCurrentMetadataNames();
  const selectedMetadata = getSelectedMetadata();

  if (metadataNames.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No metadata';
    option.value = '';
    metadataSelect.appendChild(option);
    metadataSelect.disabled = true;
  } else {
    metadataNames.forEach((metadataName) => {
      const option = document.createElement('option');
      option.value = metadataName;
      option.textContent = metadataName;
      if (metadataName === selectedMetadata) {
        option.selected = true;
      }
      metadataSelect.appendChild(option);
    });

    // Handle metadata selection change
    metadataSelect.addEventListener('change', (e) => {
      setSelectedMetadata(e.target.value);
    });
  }

  container.appendChild(metadataSelect);

  // Create hidden file input for metadata upload
  const metadataFileInput = document.createElement('input');
  metadataFileInput.type = 'file';
  metadataFileInput.accept = '.tsv,.csv,.txt';
  metadataFileInput.style.display = 'none';

  // Handle metadata file selection
  metadataFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const treeState = getCurrentTreeState();
    if (!treeState || !treeState.state.treeData) {
      alert('No tree selected. Please select a tree first.');
      metadataFileInput.value = '';
      return;
    }

    try {
      const metadataStr = await file.text();

      // Derive metadata table name from filename (remove extension)
      let metadataName = file.name.replace(/\.(tsv|csv|txt)$/i, '');

      // Determine separator based on file extension
      let separator = '\t'; // default to tab
      if (file.name.toLowerCase().endsWith('.csv')) {
        separator = ',';
      }

      // Add the metadata table to the current tree
      const tableId = treeState.state.treeData.addTable(metadataStr, metadataName, separator);

      // Get the display name that was actually used (might be modified for uniqueness)
      const actualName = treeState.state.treeData.metadataTableNames.get(tableId);

      // Reset the file input so the same file can be selected again
      metadataFileInput.value = '';

      // Set this as the selected metadata
      setSelectedMetadata(actualName);

      // Refresh the controls to show the new metadata table
      refreshCurrentTab();
    } catch (error) {
      console.error('Error loading metadata file:', error);
      alert(`Error loading metadata file: ${error.message}`);
      metadataFileInput.value = '';
    }
  });

  container.appendChild(metadataFileInput);

  const addMetadataBtn = createButton('+', 'Add metadata table', controlHeight);
  addMetadataBtn.addEventListener('click', () => {
    const treeState = getCurrentTreeState();
    if (!treeState || !treeState.state.treeData) {
      alert('No tree selected. Please select a tree first.');
      return;
    }
    metadataFileInput.click();
  });
  container.appendChild(addMetadataBtn);
}

/**
 * Populate Tree Manipulation tab controls
 */
function populateTreeManipulationControls(
  container,
  getCurrentTreeState,
  refreshCurrentTab,
  updateExpandButtonStates,
  options,
  controlHeight,
  setExpandSubtreesBtn,
  setExpandRootBtn
) {
  container.innerHTML = '';

  const treeState = getCurrentTreeState();
  if (!treeState) {
    container.textContent = 'No tree selected';
    return;
  }

  // Expand subtrees button
  const expandSubtreesBtn = createButton('Expand subtrees', 'Expand all collapsed subtrees', controlHeight);

  // Check if there are any collapsed subtrees (excluding root)
  const hasCollapsedSubtrees = () => {
    let foundCollapsed = false;

    treeState.displayedRoot.each(node => {
      if (node !== treeState.displayedRoot && node.collapsedChildren) {
        foundCollapsed = true;
      }
    });

    return foundCollapsed;
  };

  // Set initial disabled state
  expandSubtreesBtn.disabled = !hasCollapsedSubtrees();

  expandSubtreesBtn.addEventListener('click', () => {
    const nodesToExpand = [];

    // Find all currently visible collapsed nodes (excluding root)
    treeState.displayedRoot.each(node => {
      if (node !== treeState.displayedRoot && node.collapsedChildren) {
        // Check if this node is visible (i.e., none of its ancestors are collapsed)
        let isVisible = true;
        let ancestor = node.parent;
        while (ancestor && ancestor !== treeState.displayedRoot) {
          if (ancestor.collapsedChildren) {
            isVisible = false;
            break;
          }
          ancestor = ancestor.parent;
        }

        if (isVisible) {
          nodesToExpand.push(node);
        }
      }
    });

    // Expand all visible collapsed nodes
    nodesToExpand.forEach(node => {
      treeState.expandSubtree(node);
    });

    // Update button states immediately
    updateExpandButtonStates();
  });

  // Store reference to button
  setExpandSubtreesBtn(expandSubtreesBtn);

  container.appendChild(expandSubtreesBtn);

  // Expand root button
  const expandRootBtn = createButton('Expand root', 'Expand the collapsed root', controlHeight);

  // Set initial disabled state based on whether root is collapsed
  expandRootBtn.disabled = !treeState.displayedRoot.collapsedParent;

  expandRootBtn.addEventListener('click', () => {
    if (treeState.displayedRoot.collapsedParent) {
      treeState.expandRoot();
      // Update button states immediately
      updateExpandButtonStates();
    }
  });

  // Store reference to button
  setExpandRootBtn(expandRootBtn);

  container.appendChild(expandRootBtn);

  // Scale branch length
  const branchLengthLabel = createLabel('Branch length:', controlHeight);
  container.appendChild(branchLengthLabel);

  // Convert actual scale value to slider position (logarithmic)
  const scaleToSlider = (scale, max = 10) => {
    const logMin = Math.log10(1 / max);
    const logMax = Math.log10(max);
    const logScale = Math.log10(scale);
    return ((logScale - logMin) / (logMax - logMin)) * 100;
  };

  // Convert slider position to actual scale value (logarithmic)
  const sliderToScale = (sliderValue, max = 10) => {
    const logMin = Math.log10(1 / max);
    const logMax = Math.log10(max);
    const logScale = logMin + (sliderValue / 100) * (logMax - logMin);
    return Math.pow(10, logScale);
  };

  const branchLengthSlider = createSlider(0, 100, scaleToSlider(treeState.state.branchLengthScale), 0.1, controlHeight);

  branchLengthSlider.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    const scale = sliderToScale(sliderValue);
    treeState.setBranchLengthScale(scale);
  });

  container.appendChild(branchLengthSlider);

  // Scale tree height
  const treeHeightLabel = createLabel('Tree height:', controlHeight);
  container.appendChild(treeHeightLabel);

  const treeHeightSlider = createSlider(0, 100, scaleToSlider(treeState.state.treeHeightScale), 0.1, controlHeight);

  treeHeightSlider.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    const scale = sliderToScale(sliderValue);
    treeState.setTreeHeightScale(scale);
  });

  container.appendChild(treeHeightSlider);

  // Radial layout toggle
  const radialLayoutLabel = createLabel('Radial layout:', controlHeight);
  container.appendChild(radialLayoutLabel);

  const isCircular = treeState.state.layout === 'circular';
  const radialLayoutToggle = createToggle(isCircular, controlHeight);

  // Update toggle state based on layout changes
  const updateToggleState = () => {
    const currentLayout = treeState.state.layout;
    if (currentLayout === 'circular') {
      radialLayoutToggle.classList.add('active');
    } else {
      radialLayoutToggle.classList.remove('active');
    }
  };

  // Subscribe to layout changes
  treeState.subscribe('layoutChange', updateToggleState);

  // Handle click - switch layout based on current state
  radialLayoutToggle.addEventListener('click', () => {
    const currentLayout = treeState.state.layout;
    treeState.setLayout(currentLayout === 'circular' ? 'rectangular' : 'circular');
  });

  container.appendChild(radialLayoutToggle);
}

/**
 * Populate Tip Label Settings tab controls
 */
function populateTipLabelSettingsControls(container, getCurrentTreeState, options, controlHeight) {
  container.innerHTML = '';

  const treeState = getCurrentTreeState();
  if (!treeState) {
    container.textContent = 'No tree selected';
    return;
  }

  // Tip label text
  const tipLabelTextLabel = createLabel('Text:', controlHeight);
  container.appendChild(tipLabelTextLabel);

  const tipLabelTextContainer = document.createElement('div');
  tipLabelTextContainer.style.display = 'flex';

  const tipLabelTextSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelText',
    'Default',
    controlHeight,
    true,
    false
  );
  tipLabelTextContainer.appendChild(tipLabelTextSelect);

  // const tipLabelTextEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelTextEditBtn.style.width = `${controlHeight}px`;
  // tipLabelTextEditBtn.style.flexShrink = '0';
  // tipLabelTextContainer.appendChild(tipLabelTextEditBtn);

  container.appendChild(tipLabelTextContainer);

  // Tip label color
  const tipLabelColorLabel = createLabel('Color:', controlHeight);
  container.appendChild(tipLabelColorLabel);

  const tipLabelColorContainer = document.createElement('div');
  tipLabelColorContainer.style.display = 'flex';

  const tipLabelColorSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelColor',
    'Default',
    controlHeight,
    false,
    false
  );
  tipLabelColorContainer.appendChild(tipLabelColorSelect);

  // const tipLabelColorEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelColorEditBtn.style.width = `${controlHeight}px`;
  // tipLabelColorEditBtn.style.flexShrink = '0';
  // tipLabelColorContainer.appendChild(tipLabelColorEditBtn);

  container.appendChild(tipLabelColorContainer);

  // Tip label size
  const tipLabelSizeLabel = createLabel('Size:', controlHeight);
  container.appendChild(tipLabelSizeLabel);

  const tipLabelSizeContainer = document.createElement('div');
  tipLabelSizeContainer.style.display = 'flex';

  const tipLabelSizeSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelSize',
    'Default',
    controlHeight,
    false,
    true
  );
  tipLabelSizeContainer.appendChild(tipLabelSizeSelect);

  // const tipLabelSizeEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelSizeEditBtn.style.width = `${controlHeight}px`;
  // tipLabelSizeEditBtn.style.flexShrink = '0';
  // tipLabelSizeContainer.appendChild(tipLabelSizeEditBtn);

  container.appendChild(tipLabelSizeContainer);

  // Tip label style
  const tipLabelStyleLabel = createLabel('Style:', controlHeight);
  container.appendChild(tipLabelStyleLabel);

  const tipLabelStyleContainer = document.createElement('div');
  tipLabelStyleContainer.style.display = 'flex';

  const tipLabelStyleSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelStyle',
    'Default',
    controlHeight,
    false,
    false
  );
  tipLabelStyleContainer.appendChild(tipLabelStyleSelect);

  // const tipLabelStyleEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelStyleEditBtn.style.width = `${controlHeight}px`;
  // tipLabelStyleEditBtn.style.flexShrink = '0';
  // tipLabelStyleContainer.appendChild(tipLabelStyleEditBtn);

  container.appendChild(tipLabelStyleContainer);

  // Tip label font
  const tipLabelFontLabel = createLabel('Font:', controlHeight);
  container.appendChild(tipLabelFontLabel);

  const tipLabelFontSelect = document.createElement('select');
  tipLabelFontSelect.className = 'ht-select';
  tipLabelFontSelect.style.height = `${controlHeight}px`;

  const fonts = ['sans-serif', 'serif', 'monospace', 'Arial', 'Times New Roman', 'Courier New'];

  // Get current font value - check if it's set via aesthetic or use default
  const currentFont = treeState.state.aesthetics.tipLabelFont !== undefined
    ? treeState.aestheticsScales.tipLabelFont.getValue()
    : 'sans-serif';

  fonts.forEach(font => {
    const option = document.createElement('option');
    option.value = font;
    option.textContent = font;
    if (font === currentFont) {
      option.selected = true;
    }
    tipLabelFontSelect.appendChild(option);
  });

  // Handle font selection change
  tipLabelFontSelect.addEventListener('change', (e) => {
    const selectedFont = e.target.value;
    // Set the font as a direct value (not from metadata)
    treeState.setAesthetics({ tipLabelFont: undefined });
    // Then update all nodes to use this font
    treeState.state.treeData.tree.each(d => {
      d.tipLabelFont = selectedFont;
    });
    // Trigger coordinate update since font affects text size
    treeState.updateCoordinates();
  });

  container.appendChild(tipLabelFontSelect);
}

/**
 * Create a metadata column select dropdown
 */
function createMetadataColumnSelect(treeState, aesthetic, defaultLabel, controlHeight, includeNone = false, onlyContinuous = false) {
  const select = document.createElement('select');
  select.className = 'ht-select';
  select.style.height = `${controlHeight}px`;
  select.style.flex = '1';

  // Add "None" option if requested (for disabling the aesthetic)
  if (includeNone) {
    const noneOption = document.createElement('option');
    noneOption.value = 'none';
    noneOption.textContent = 'None';
    select.appendChild(noneOption);
  }

  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);

  // Get all metadata columns
  const treeData = treeState.state.treeData;
  const columnIds = Array.from(treeData.columnDisplayName.keys());

  // Filter columns if onlyContinuous is true
  const filteredColumnIds = onlyContinuous
    ? columnIds.filter(columnId => treeData.columnType.get(columnId) === 'continuous')
    : columnIds;

  // Add options for each metadata column
  filteredColumnIds.forEach(columnId => {
    const option = document.createElement('option');
    option.value = columnId;
    option.textContent = treeData.columnDisplayName.get(columnId);

    // Check if this column is currently selected for this aesthetic
    if (treeState.state.aesthetics[aesthetic] === columnId) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  // Set the selected option based on current aesthetic value
  const currentValue = treeState.state.aesthetics[aesthetic];
  if (currentValue === null) {
    select.value = 'none';
  } else if (currentValue === undefined || currentValue === '') {
    select.value = '';
  } else {
    select.value = currentValue;
  }

  // Handle selection change
  select.addEventListener('change', (e) => {
    let columnId;
    if (e.target.value === 'none') {
      // Special handling for "None" - set aesthetic to null to disable it
      columnId = null;
    } else if (e.target.value === '') {
      // Empty string means use default behavior
      columnId = undefined;
    } else {
      columnId = e.target.value;
    }
    const aestheticUpdate = {};
    aestheticUpdate[aesthetic] = columnId;
    treeState.setAesthetics(aestheticUpdate);
  });

  return select;
}

/**
 * Populate Export tab controls
 */
function populateExportControls(container, getCurrentTreeState, getCurrentTreeView, options, controlHeight) {
  container.innerHTML = '';

  const treeState = getCurrentTreeState();
  const treeView = getCurrentTreeView();

  if (!treeState || !treeView) {
    container.textContent = 'No tree selected';
    return;
  }

  // Get tree bounds including legends
  const bounds = getTreeBoundsWithLegends(treeState, treeView);
  const treeWidth = bounds.maxX - bounds.minX;
  const treeHeight = bounds.maxY - bounds.minY;

  // State for export settings
  const exportState = {
    format: 'svg',
    width: treeWidth,
    height: treeHeight,
    margin: 18,
    maintainAspectRatio: true
  };

  // Calculate aspect ratio
  const aspectRatio = treeWidth / treeHeight;

  // PPI for conversion
  const PPI = 300;
  const CM_PER_INCH = 2.54;

  // Conversion functions
  const pxToCm = (px) => (px / PPI) * CM_PER_INCH;
  const cmToPx = (cm) => (cm / CM_PER_INCH) * PPI;

  // Get display value based on format
  const getDisplayValue = (px, format) => {
    if (format === 'png') {
      return Math.round(px);
    } else {
      return Math.round(pxToCm(px) * 100) / 100;
    }
  };

  // Get actual pixel value from display value
  const getPixelValue = (displayValue, format) => {
    if (format === 'png') {
      return displayValue;
    } else {
      return cmToPx(displayValue);
    }
  };

  // Export button
  const exportBtn = createButton('Export', 'Export the tree to a file', controlHeight);
  exportBtn.classList.add('primary');
  exportBtn.addEventListener('click', () => {
    exportTree(treeState, treeView, exportState, bounds);
  });
  container.appendChild(exportBtn);

  // Output format
  const formatLabel = createLabel('Output format:', controlHeight);
  container.appendChild(formatLabel);

  const formatSelect = document.createElement('select');
  formatSelect.className = 'ht-select';
  formatSelect.style.height = `${controlHeight}px`;

  ['SVG', 'PNG'].forEach(format => {
    const option = document.createElement('option');
    option.value = format.toLowerCase();
    option.textContent = format;
    if (format.toLowerCase() === exportState.format) {
      option.selected = true;
    }
    formatSelect.appendChild(option);
  });

  formatSelect.addEventListener('change', (e) => {
    const oldFormat = exportState.format;
    exportState.format = e.target.value;

    // Update input values and units when format changes
    widthInput.value = getDisplayValue(exportState.width, exportState.format);
    heightInput.value = getDisplayValue(exportState.height, exportState.format);
    marginInput.value = getDisplayValue(exportState.margin, exportState.format);

    // Update unit labels
    const unit = exportState.format === 'png' ? 'px' : 'cm';
    widthLabel.textContent = `Width (${unit}):`;
    heightLabel.textContent = `Height (${unit}):`;
    marginLabel.textContent = `Margin (${unit}):`;
  });

  container.appendChild(formatSelect);

  // Width input
  const widthLabel = createLabel(`Width (${exportState.format === 'png' ? 'px' : 'cm'}):`, controlHeight);
  container.appendChild(widthLabel);

  const widthInput = createNumberInput(
    getDisplayValue(exportState.width, exportState.format),
    0.1,
    10000,
    0.1,
    controlHeight
  );

  widthInput.addEventListener('input', (e) => {
    const displayValue = parseFloat(e.target.value);
    if (isNaN(displayValue) || displayValue <= 0) return;

    exportState.width = getPixelValue(displayValue, exportState.format);

    if (exportState.maintainAspectRatio) {
      exportState.height = exportState.width / aspectRatio;
      heightInput.value = getDisplayValue(exportState.height, exportState.format);
    }
  });

  container.appendChild(widthInput);

  // Height input
  const heightLabel = createLabel(`Height (${exportState.format === 'png' ? 'px' : 'cm'}):`, controlHeight);
  container.appendChild(heightLabel);

  const heightInput = createNumberInput(
    getDisplayValue(exportState.height, exportState.format),
    0.1,
    10000,
    0.1,
    controlHeight
  );

  heightInput.addEventListener('input', (e) => {
    const displayValue = parseFloat(e.target.value);
    if (isNaN(displayValue) || displayValue <= 0) return;

    exportState.height = getPixelValue(displayValue, exportState.format);

    if (exportState.maintainAspectRatio) {
      exportState.width = exportState.height * aspectRatio;
      widthInput.value = getDisplayValue(exportState.width, exportState.format);
    }
  });

  container.appendChild(heightInput);

  // Margin input
  const marginLabel = createLabel(`Margin (${exportState.format === 'png' ? 'px' : 'cm'}):`, controlHeight);
  container.appendChild(marginLabel);

  const marginInput = createNumberInput(
    getDisplayValue(exportState.margin, exportState.format),
    0,
    100,
    0.1,
    controlHeight
  );

  marginInput.addEventListener('input', (e) => {
    const displayValue = parseFloat(e.target.value);
    if (isNaN(displayValue) || displayValue < 0) return;

    exportState.margin = getPixelValue(displayValue, exportState.format);
  });

  container.appendChild(marginInput);
}

/**
 * Get tree bounds including legends
 */
function getTreeBoundsWithLegends(treeState, treeView) {
  const treeBounds = {
    minX: treeState.displayedRoot.bounds.minX,
    maxX: treeState.displayedRoot.bounds.maxX,
    minY: treeState.displayedRoot.bounds.minY,
    maxY: treeState.displayedRoot.bounds.maxY
  };

  let maxY = treeBounds.maxY;

  // Add legend heights
  for (const legend of treeView.legendInstances) {
    if (legend.coordinates) {
      maxY = Math.max(maxY, legend.state.y + legend.coordinates.height);
    }
  }

  return {
    minX: treeBounds.minX,
    maxX: treeBounds.maxX,
    minY: treeBounds.minY,
    maxY: maxY
  };
}

/**
 * Export tree to file
 */
function exportTree(treeState, treeView, exportState, bounds) {
  // Calculate dimensions
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // Calculate scale to fit content into export dimensions
  const scaleX = exportState.width / contentWidth;
  const scaleY = exportState.height / contentHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate final dimensions with margin
  const finalWidth = exportState.width + 2 * exportState.margin;
  const finalHeight = exportState.height + 2 * exportState.margin;

  // Calculate translation to center content and add margin
  const translateX = exportState.margin - bounds.minX * scale;
  const translateY = exportState.margin - bounds.minY * scale;

  // Create a new SVG element for export
  const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  exportSvg.setAttribute('width', finalWidth);
  exportSvg.setAttribute('height', finalHeight);
  exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Create a group for the transformed content
  const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  contentGroup.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

  // Clone the tree elements from the view
  const treeGroup = treeView.layers.treeGroup.node();
  const clonedTreeGroup = treeGroup.cloneNode(true);

  // Remove the transform attribute from the cloned group (we'll apply our own)
  clonedTreeGroup.removeAttribute('transform');

  // Remove selection rectangle and buttons from export
  const selectionRect = clonedTreeGroup.querySelector('.selection-rect');
  if (selectionRect) {
    selectionRect.remove();
  }

  contentGroup.appendChild(clonedTreeGroup);
  exportSvg.appendChild(contentGroup);

  // Serialize the SVG
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(exportSvg);

  if (exportState.format === 'svg') {
    // Download as SVG
    downloadFile(svgString, 'tree.svg', 'image/svg+xml');
  } else if (exportState.format === 'png') {
    // Convert to PNG
    convertSvgToPng(svgString, finalWidth, finalHeight, 'tree.png');
  }
}

/**
 * Download a file
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert SVG to PNG
 */
function convertSvgToPng(svgString, width, height, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    });
  };

  img.src = url;
}

/**
 * Helper function to create a label
 */
function createLabel(text, height) {
  const label = document.createElement('label');
  label.className = 'ht-control-label';
  label.textContent = text;
  label.style.height = `${height}px`;
  return label;
}

/**
 * Helper function to create a button
 */
function createButton(text, title = '', height) {
  const button = document.createElement('button');
  button.className = 'ht-button';
  button.textContent = text;
  button.title = title;
  button.style.height = `${height}px`;
  return button;
}

/**
 * Helper function to create a slider
 */
function createSlider(min, max, value, step, height) {
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ht-slider';
  slider.min = min;
  slider.max = max;
  slider.value = value;
  slider.step = step;
  slider.style.height = `${height}px`;
  return slider;
}

/**
 * Helper function to create a toggle switch
 */
function createToggle(initialState, height) {
  const toggleHeight = Math.min(24, height - 4);
  const knobSize = toggleHeight - 4;

  const toggle = document.createElement('div');
  toggle.className = initialState ? 'ht-toggle active' : 'ht-toggle';
  toggle.style.height = `${toggleHeight}px`;

  const knob = document.createElement('div');
  knob.className = 'ht-toggle-knob';
  knob.style.width = `${knobSize}px`;
  knob.style.height = `${knobSize}px`;

  toggle.appendChild(knob);

  // Note: Click handler should be added by the caller, not here
  // This allows the caller to control the toggle state explicitly

  return toggle;
}

/**
 * Helper function to create a number input
 */
function createNumberInput(value, min, max, step, height) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'ht-number-input';
  input.value = value;
  input.min = min;
  input.max = max;
  input.step = step;
  input.style.height = `${height}px`;
  return input;
}
