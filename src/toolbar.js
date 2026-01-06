import { exportTree } from './exporter.js';

/**
 * Create and manage the toolbar with tabs and controls
 * @param {HTMLElement} toolbarDiv - Container for the toolbar
 * @param {Map} treeDataInstances - Map of tree names to TreeData instances
 * @param {Function} getCurrentTreeState - Function that returns the current TreeState
 * @param {Function} getCurrentTreeView - Function that returns the current TreeView
 * @param {Function} switchToTree - Function to switch to a different tree
 * @param {Function} addNewTree - Function to add a new tree
 * @param {Object} options - Configuration options
 * @param {Function} onDimensionsChange - Callback when toolbar dimensions change
 * @returns {Function} Function to refresh the current tab's controls
 */
export function createToolbar(
  toolbarDiv,
  treeDataInstances,
  getCurrentTreeState,
  getCurrentTreeView,
  switchToTree,
  addNewTree,
  options,
  onDimensionsChange
) {
  const CONTROL_HEIGHT = 24; // Standard height for all controls
  let currentTab = null;
  let selectedMetadata = null; // Track which metadata table is "selected" for future controls

  // Store references to buttons that need to be updated dynamically
  let expandSubtreesBtn = null;
  let expandRootBtn = null;
  let showHiddenBtn = null;
  let currentTreeStateSubscription = null;

  // Track control panel visibility
  let controlPanelVisible = true;

  // Create toggle button container (separate from collapsible content)
  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'ht-toggle-container';

  // Create toggle button for control panel
  const toggleButton = document.createElement('button');
  toggleButton.className = 'ht-control-panel-toggle';
  toggleButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" class="ht-toggle-arrow">
      <path d="M8 4 L12 8 L8 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(-90 8 8)"/>
    </svg>
    <svg width="16" height="16" viewBox="0 0 16 16" class="ht-hamburger-icon">
      <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
  toggleButton.title = 'Toggle control panel';

  toggleContainer.appendChild(toggleButton);

  // Create collapsible panel container
  const collapsiblePanel = document.createElement('div');
  collapsiblePanel.className = 'ht-collapsible-panel';

  // Create tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'ht-tabs';

  // Create controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'ht-controls hidden';

  // Define tabs
  const tabs = [
    { id: 'data', label: 'Data', requiresTree: false },
    { id: 'controls', label: 'Controls', requiresTree: true },
    { id: 'tree-manipulation', label: 'Tree', requiresTree: true },
    { id: 'tip-label-settings', label: 'Tip Labels', requiresTree: true },
    { id: 'export', label: 'Export', requiresTree: true }
  ];

  // Create tab elements
  const tabElements = {};
  tabs.forEach(tab => {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'ht-tab';
    tabDiv.textContent = tab.label;

    // Click handler
    tabDiv.addEventListener('click', () => {
      // Check if tab is disabled
      if (tabDiv.classList.contains('disabled')) {
        return;
      }

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

  // Function to update tab states based on whether a tree is loaded
  function updateTabStates() {
    const hasTree = getCurrentTreeState() !== null;

    tabs.forEach(tab => {
      const tabElement = tabElements[tab.id];
      if (tab.requiresTree && !hasTree) {
        tabElement.classList.add('disabled');
      } else {
        tabElement.classList.remove('disabled');
      }
    });

    // If current tab requires a tree and no tree is loaded, close it and open Data tab
    if (currentTab) {
      const currentTabDef = tabs.find(t => t.id === currentTab);
      if (currentTabDef && currentTabDef.requiresTree && !hasTree) {
        openTab('data');
      }
    }
  }

  // Add transition end listener to notify when dimensions change
  collapsiblePanel.addEventListener('transitionend', (e) => {
    // Only trigger on max-height transitions (not other properties)
    if (e.propertyName === 'max-height' && onDimensionsChange) {
      onDimensionsChange();
    }
  });

  // Toggle button click handler
  toggleButton.addEventListener('click', () => {
    controlPanelVisible = !controlPanelVisible;

    if (controlPanelVisible) {
      // Show the control panel
      collapsiblePanel.classList.remove('ht-panel-collapsed');
      toggleButton.classList.remove('collapsed');
    } else {
      // Hide the control panel
      collapsiblePanel.classList.add('ht-panel-collapsed');
      toggleButton.classList.add('collapsed');
    }
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

    // Update show hidden button
    if (showHiddenBtn) {
      let hasHiddenNodes = false;
      treeState.state.treeData.tree.each(node => {
        if (node.hiddenChildren && node.hiddenChildren.length > 0) {
          hasHiddenNodes = true;
        }
      });
      showHiddenBtn.disabled = !hasHiddenNodes;
    }
  }

  // Function to get current tree name
  function getCurrentTreeName() {
    const treeState = getCurrentTreeState();
    if (!treeState) return 'tree';

    // Find the tree name by matching the treeData instance
    for (const [name, data] of treeDataInstances.entries()) {
      if (data === treeState.state.treeData) {
        return name;
      }
    }
    return 'tree';
  }

  // Function to open a tab
  function openTab(tabId) {
    // Check if tab requires a tree and no tree is loaded
    const tabDef = tabs.find(t => t.id === tabId);
    if (tabDef && tabDef.requiresTree && !getCurrentTreeState()) {
      return;
    }

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

    // Notify that dimensions have changed after the DOM has updated
    if (onDimensionsChange) {
      // Use requestAnimationFrame to ensure DOM has been updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          onDimensionsChange();
        }, 50);
      });
    }
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

    // Notify that dimensions have changed
    if (onDimensionsChange) {
      setTimeout(() => {
        onDimensionsChange();
      }, 50);
    }
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
      case 'controls':
        populateControlsTab(
          controlsContainer,
          getCurrentTreeState,
          getCurrentTreeView,
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
          (btn) => { expandRootBtn = btn; },
          (btn) => { showHiddenBtn = btn; }
        );
        break;
      case 'tip-label-settings':
        populateTipLabelSettingsControls(controlsContainer, getCurrentTreeState, options, CONTROL_HEIGHT);
        break;
      case 'export':
        populateExportControls(controlsContainer, getCurrentTreeState, getCurrentTreeView, getCurrentTreeName, options, CONTROL_HEIGHT);
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
    showHiddenBtn = null;

    // Subscribe to coordinate changes in the new tree state
    const treeState = getCurrentTreeState();
    if (treeState) {
      currentTreeStateSubscription = treeState.subscribe('coordinateChange', updateExpandButtonStates);
    }

    // Update tab states based on whether a tree is loaded
    updateTabStates();

    if (currentTab) {
      populateControls(currentTab);
    }
  }

  // Assemble the collapsible panel
  collapsiblePanel.appendChild(tabsContainer);
  collapsiblePanel.appendChild(controlsContainer);

  // Append toggle container and collapsible panel to toolbar
  toolbarDiv.appendChild(toggleContainer);
  toolbarDiv.appendChild(collapsiblePanel);

  // Update tab states initially
  updateTabStates();

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

  // Select tree control group
  const treeGroup = createControlGroup();
  const treeLabel = createLabel('Select tree:', controlHeight);
  treeGroup.appendChild(treeLabel);

  const treeSelect = document.createElement('select');
  treeSelect.className = 'ht-select';
  treeSelect.style.height = `${controlHeight}px`;

  // Populate tree options
  const treeNames = Array.from(treeDataInstances.keys());
  const currentTreeState = getCurrentTreeState();
  const currentTreeName = currentTreeState ? Array.from(treeDataInstances.entries()).find(([name, data]) => data === currentTreeState.state.treeData)?.[0] : null;

  if (treeNames.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No trees loaded';
    option.value = '';
    treeSelect.appendChild(option);
    treeSelect.disabled = true;
  } else {
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
  }

  treeGroup.appendChild(treeSelect);
  container.appendChild(treeGroup);

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

  // Only show metadata controls if a tree is loaded
  if (!currentTreeState) {
    return;
  }

  // Select metadata control group
  const metadataGroup = createControlGroup();
  const metadataLabel = createLabel('Available metadata:', controlHeight);
  metadataGroup.appendChild(metadataLabel);

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

  metadataGroup.appendChild(metadataSelect);
  container.appendChild(metadataGroup);

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
 * Populate Controls tab
 */
function populateControlsTab(
  container,
  getCurrentTreeState,
  getCurrentTreeView,
  options,
  controlHeight
) {
  container.innerHTML = '';

  const treeState = getCurrentTreeState();
  const treeView = getCurrentTreeView();

  if (!treeState || !treeView) {
    container.textContent = 'No tree selected';
    return;
  }

  // Fit to view button
  const fitToViewBtn = createButton('Fit to view', 'Fit the tree to the current view window', controlHeight);
  fitToViewBtn.addEventListener('click', () => {
    treeView.fitToView({ transition: true, autoPan: 'Both', autoZoom: 'Both' });
  });
  container.appendChild(fitToViewBtn);

  // Manual zoom/pan toggle group
  const manualZoomPanGroup = createControlGroup();
  const manualZoomPanLabel = createLabel('Manual zoom/pan:', controlHeight);
  manualZoomPanGroup.appendChild(manualZoomPanLabel);

  const manualZoomPanToggle = createToggle(treeView.options.manualZoomAndPanEnabled, controlHeight);

  manualZoomPanToggle.addEventListener('click', () => {
    treeView.options.manualZoomAndPanEnabled = !treeView.options.manualZoomAndPanEnabled;

    // Update toggle visual state
    if (treeView.options.manualZoomAndPanEnabled) {
      manualZoomPanToggle.classList.add('active');
    } else {
      manualZoomPanToggle.classList.remove('active');
    }

    // Reinitialize zoom behavior with new filter
    treeView.initializeZoom();
  });

  manualZoomPanGroup.appendChild(manualZoomPanToggle);
  container.appendChild(manualZoomPanGroup);

  // Auto-zoom dropdown group
  const autoZoomGroup = createControlGroup();
  const autoZoomLabel = createLabel('Auto-zoom:', controlHeight);
  autoZoomGroup.appendChild(autoZoomLabel);

  const autoZoomSelect = document.createElement('select');
  autoZoomSelect.className = 'ht-select';
  autoZoomSelect.style.height = `${controlHeight}px`;

  const zoomOptions = ['Default', 'Both', 'X', 'Y', 'None'];
  zoomOptions.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    if (option === treeView.options.autoZoom) {
      optionElement.selected = true;
    }
    autoZoomSelect.appendChild(optionElement);
  });

  autoZoomSelect.addEventListener('change', (e) => {
    treeView.options.autoZoom = e.target.value;
  });

  autoZoomGroup.appendChild(autoZoomSelect);
  container.appendChild(autoZoomGroup);

  // Auto-pan dropdown group
  const autoPanGroup = createControlGroup();
  const autoPanLabel = createLabel('Auto-pan:', controlHeight);
  autoPanGroup.appendChild(autoPanLabel);

  const autoPanSelect = document.createElement('select');
  autoPanSelect.className = 'ht-select';
  autoPanSelect.style.height = `${controlHeight}px`;

  const panOptions = ['Default', 'Both', 'X', 'Y', 'None'];
  panOptions.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    if (option === treeView.options.autoPan) {
      optionElement.selected = true;
    }
    autoPanSelect.appendChild(optionElement);
  });

  autoPanSelect.addEventListener('change', (e) => {
    treeView.options.autoPan = e.target.value;
  });

  autoPanGroup.appendChild(autoPanSelect);
  container.appendChild(autoPanGroup);
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
  setExpandRootBtn,
  setShowHiddenBtn
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

  // Show hidden button
  const showHiddenBtn = createButton('Show hidden', 'Show all hidden nodes', controlHeight);

  // Check if there are any hidden nodes
  const hasHiddenNodes = () => {
    let foundHidden = false;
    treeState.state.treeData.tree.each(node => {
      if (node.hiddenChildren && node.hiddenChildren.length > 0) {
        foundHidden = true;
      }
    });
    return foundHidden;
  };

  // Set initial disabled state
  showHiddenBtn.disabled = !hasHiddenNodes();

  showHiddenBtn.addEventListener('click', () => {
    treeState.showAllHidden();
    // Update button states immediately
    updateExpandButtonStates();
  });

  // Store reference to button
  setShowHiddenBtn(showHiddenBtn);

  container.appendChild(showHiddenBtn);

  // Scale branch length group
  const branchLengthGroup = createControlGroup();
  const branchLengthLabel = createLabel('Branch length:', controlHeight);
  branchLengthGroup.appendChild(branchLengthLabel);

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

  branchLengthGroup.appendChild(branchLengthSlider);
  container.appendChild(branchLengthGroup);

  // Scale tree height group
  const treeHeightGroup = createControlGroup();
  const treeHeightLabel = createLabel('Tree height:', controlHeight);
  treeHeightGroup.appendChild(treeHeightLabel);

  const treeHeightSlider = createSlider(0, 100, scaleToSlider(treeState.state.treeHeightScale), 0.1, controlHeight);

  treeHeightSlider.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    const scale = sliderToScale(sliderValue);
    treeState.setTreeHeightScale(scale);
  });

  treeHeightGroup.appendChild(treeHeightSlider);
  container.appendChild(treeHeightGroup);

  // Radial layout toggle group
  const radialLayoutGroup = createControlGroup();
  const radialLayoutLabel = createLabel('Radial layout:', controlHeight);
  radialLayoutGroup.appendChild(radialLayoutLabel);

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

  radialLayoutGroup.appendChild(radialLayoutToggle);
  container.appendChild(radialLayoutGroup);
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

  // Tip label text group
  const tipLabelTextGroup = createControlGroup();
  const tipLabelTextLabel = createLabel('Text:', controlHeight);
  tipLabelTextGroup.appendChild(tipLabelTextLabel);

  const tipLabelTextSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelText',
    'Default',
    controlHeight,
    true,
    null
  );
  tipLabelTextGroup.appendChild(tipLabelTextSelect);

  // const tipLabelTextEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelTextEditBtn.style.width = `${controlHeight}px`;
  // tipLabelTextEditBtn.style.flexShrink = '0';
  // tipLabelTextGroup.appendChild(tipLabelTextEditBtn);

  container.appendChild(tipLabelTextGroup);

  // Tip label color group
  const tipLabelColorGroup = createControlGroup();
  const tipLabelColorLabel = createLabel('Color:', controlHeight);
  tipLabelColorGroup.appendChild(tipLabelColorLabel);

  const tipLabelColorSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelColor',
    'Default',
    controlHeight,
    false,
    null
  );
  tipLabelColorGroup.appendChild(tipLabelColorSelect);

  // const tipLabelColorEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelColorEditBtn.style.width = `${controlHeight}px`;
  // tipLabelColorEditBtn.style.flexShrink = '0';
  // tipLabelColorGroup.appendChild(tipLabelColorEditBtn);

  container.appendChild(tipLabelColorGroup);

  // Tip label size group
  const tipLabelSizeGroup = createControlGroup();
  const tipLabelSizeLabel = createLabel('Size:', controlHeight);
  tipLabelSizeGroup.appendChild(tipLabelSizeLabel);

  const tipLabelSizeSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelSize',
    'Default',
    controlHeight,
    false,
    true
  );
  tipLabelSizeGroup.appendChild(tipLabelSizeSelect);

  // const tipLabelSizeEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelSizeEditBtn.style.width = `${controlHeight}px`;
  // tipLabelSizeEditBtn.style.flexShrink = '0';
  // tipLabelSizeGroup.appendChild(tipLabelSizeEditBtn);

  container.appendChild(tipLabelSizeGroup);

  // Tip label style group
  const tipLabelStyleGroup = createControlGroup();
  const tipLabelStyleLabel = createLabel('Style:', controlHeight);
  tipLabelStyleGroup.appendChild(tipLabelStyleLabel);

  const tipLabelStyleSelect = createMetadataColumnSelect(
    treeState,
    'tipLabelStyle',
    'Default',
    controlHeight,
    false,
    false
  );
  tipLabelStyleGroup.appendChild(tipLabelStyleSelect);

  // const tipLabelStyleEditBtn = createButton('✎', 'Edit scale settings', controlHeight);
  // tipLabelStyleEditBtn.style.width = `${controlHeight}px`;
  // tipLabelStyleEditBtn.style.flexShrink = '0';
  // tipLabelStyleGroup.appendChild(tipLabelStyleEditBtn);

  container.appendChild(tipLabelStyleGroup);

  // Tip label font group
  const tipLabelFontGroup = createControlGroup();
  const tipLabelFontLabel = createLabel('Font:', controlHeight);
  tipLabelFontGroup.appendChild(tipLabelFontLabel);

  const tipLabelFontSelect = document.createElement('select');
  tipLabelFontSelect.className = 'ht-select';
  tipLabelFontSelect.style.height = `${controlHeight}px`;

  const fonts = ['sans-serif', 'serif', 'monospace'];

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

  tipLabelFontGroup.appendChild(tipLabelFontSelect);
  container.appendChild(tipLabelFontGroup);
}

/**
 * Create a metadata column select dropdown
 */
function createMetadataColumnSelect(treeState, aesthetic, defaultLabel, controlHeight, includeNone = false, continuous = null) {
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

  // Filter columns for continuous/categorical metadata
  let filteredColumnIds = columnIds;
  if (continuous !== null) {
    if (continuous) {
      filteredColumnIds = columnIds.filter(columnId => treeData.columnType.get(columnId) === 'continuous')
    } else {
      filteredColumnIds = columnIds.filter(columnId => treeData.columnType.get(columnId) === 'categorical')
    }
  }

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
function populateExportControls(container, getCurrentTreeState, getCurrentTreeView, getCurrentTreeName, options, controlHeight) {
  container.innerHTML = '';

  const treeState = getCurrentTreeState();
  const treeView = getCurrentTreeView();

  if (!treeState || !treeView) {
    container.textContent = 'No tree selected';
    return;
  }

  // Get tree bounds including legends
  const bounds = treeView.getCurrentBoundsWithLegends();
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

  // Function to update dimensions based on current tree bounds
  const updateDimensions = () => {
    const newBounds = treeView.getCurrentBoundsWithLegends();
    const newWidth = newBounds.maxX - newBounds.minX;
    const newHeight = newBounds.maxY - newBounds.minY;

    exportState.width = newWidth;
    exportState.height = newHeight;

    widthInput.value = getDisplayValue(newWidth, exportState.format);
    heightInput.value = getDisplayValue(newHeight, exportState.format);
  };

  // Subscribe to coordinate changes to update dimensions
  const coordinateChangeUnsubscribe = treeState.subscribe('coordinateChange', updateDimensions);

  // Subscribe to legend changes to update dimensions
  const legendsChangeUnsubscribe = treeState.subscribe('legendsChange', updateDimensions);

  // Clean up subscriptions when the tab is closed or changed
  // We'll store the cleanup function on the container element
  container.dataset.cleanup = () => {
    coordinateChangeUnsubscribe();
    legendsChangeUnsubscribe();
  };

  // Export button
  const exportBtn = createButton('Export', 'Export the tree to a file', controlHeight);
  exportBtn.classList.add('primary');
  exportBtn.addEventListener('click', () => {
    // Get current tree name and sanitize it for use as filename
    const treeName = getCurrentTreeName();
    const sanitizedName = treeName.replace(/[^a-z0-9_-]/gi, '_');
    const extension = exportState.format === 'svg' ? 'svg' : 'png';
    const filename = `${sanitizedName}.${extension}`;

    exportTree(treeView, exportState, filename);
  });
  container.appendChild(exportBtn);

  // Output format group
  const formatGroup = createControlGroup();
  const formatLabel = createLabel('Output format:', controlHeight);
  formatGroup.appendChild(formatLabel);

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

  formatGroup.appendChild(formatSelect);
  container.appendChild(formatGroup);

  // Width input group
  const widthGroup = createControlGroup();
  const widthLabel = createLabel(`Width (${exportState.format === 'png' ? 'px' : 'cm'}):`, controlHeight);
  widthGroup.appendChild(widthLabel);

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

  widthGroup.appendChild(widthInput);
  container.appendChild(widthGroup);

  // Height input group
  const heightGroup = createControlGroup();
  const heightLabel = createLabel(`Height (${exportState.format === 'png' ? 'px' : 'cm'}):`, controlHeight);
  heightGroup.appendChild(heightLabel);

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

  heightGroup.appendChild(heightInput);
  container.appendChild(heightGroup);

  // Margin input group
  const marginGroup = createControlGroup();
  const marginLabel = createLabel(`Margin (${exportState.format === 'png' ? 'px' : 'cm'}):`, controlHeight);
  marginGroup.appendChild(marginLabel);

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

  marginGroup.appendChild(marginInput);
  container.appendChild(marginGroup);
}


/**
 * Helper function to create a control group container
 */
function createControlGroup() {
  const group = document.createElement('div');
  group.className = 'ht-control-group';
  return group;
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
