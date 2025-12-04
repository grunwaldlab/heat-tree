# Controls

Controls not associated with particular tree elements appear at the top of the tree widget and are designed to be as space-efficient and language-agnostic as possible.
The entire control panel can be minimized by dragging the lower boundary up, after which a hamburger menu with a down-facing arrow on the top left can expand them again when clicked.
Controls are grouped into tabs that reveal the controls when clicked.
If the currently selected tab is clicked, it is unselected and no controls are shown other than the tabs.
The tree is resized to fill the current space not used by controls when controls are resized.

## Color and size scaling settings

Color palettes and size scaling settings are associated with each metadata column.
These settings include:

- an ordered series of colors/sizes used as outputs for the scale that are interpolated between as needed for continuous variables
- the associated input values for each output, in ascending order for continuous variables
- A default value for missing data

These settings can be changed by a popup control panel that appears when a button on a dropdown for a metadata column selector is clicked.

## Tab groups

Controls are grouped into tabs like so:

### Data tab:

- **Select tree**: A dropdown selection box to select which tree is currently shown with a button to the right with a plus sign that allows uploading a tree from a newick file when clicked. An uploaded tree derives its name from the file name minus the extension. An unnamed tree is named "Tree with # tips". To the right of each item in the dropdown is a button with a trash symbol that deletes the tree and associated metadata when clicked
- **Select metadata**: A dropdown menu that lists metadata tables associated with the currently selected tree with a button to the right with a plus sign that allows uploading a new metadata table. An uploaded metadata table derives its name from the file name minus the extension. An unnamed table is named "table with # columns". To the right of each item is a button with a trash symbol that deletes the associated metadata table. 

### Interaction tab

- **Reset tree to default view**: Button that resets current tree to default settings.
- **Toggle manual zooming/panning**: Toggle that enables or disables zooming/panning.
- **Toggle automatic zooming**: Toggle that if enabled, the view zoom will be adjusted to be the smallest needed to see the root to tip and labels automatically when a change is made to the tree
- **Toggle automating panning**: Toggle that if enabled, the view will be panned to minimize empty space

### Tree manipulation tab

- **Expand subtrees**: Button that expands all collapsed subtrees. It is disabled if there are no collapsed subtrees.
- **Expand root**: Button that expands the collapsed root. It is disabled if the root is not collapsed.
- **Scale branch length**: A slider to scale branch length
- **Scale tree height**: A slider to scale tree height (or proportion of the circle used for circular layouts)
- **Radial layout**: toggle button to activate radial layout

### Tip Label settings tab

Each dropdown element in the controls in this section have a button to the right of the option that modifies the associated scale settings.

- **Enable tip labels**: Toggle button to enable tip labels
- **Tip label text**: Dropdown to select metadata column to derive tip label text from. Defaults to node IDs.
- **Tip label color**: Dropdown to select metadata column to derive tip label color from
- **Tip label size**: Dropdown to select metadata column to derive tip label size from
- **Tip label style**: Dropdown to select metadata column to derive tip label style (bold, italic, etc) from
- **Tip label font**: Dropdown to select font

### Node Label settings tab

Each dropdown element in the controls in this section have a button to the right of the option that modifies the associated scale settings.

- **Enable node labels**: Toggle button to enable node labels
- **node label text**: Dropdown to select metadata column to derive node label text from. Defaults to node IDs.
- **node label color**: Dropdown to select metadata column to derive node label color from
- **node label size**: Dropdown to select metadata column to derive node label size from
- **node label style**: Dropdown to select metadata column to derive node label style (bold, italic, etc) from
- **node label font**: Dropdown to select font

### Branch settings tab

Each dropdown element in the controls in this section have a button to the right of the option that modifies the associated scale settings.

- **branch thickness**: Dropdown to select metadata column to derive branch thickness from
- **branch color**: Dropdown to select metadata column to derive branch color from

### Export settings tab

When this tab is selected, the zoom is adjusted to show the whole tree and legends regardless of other settings and a border with a drop shadow is shown representing the boundries of the exported file.

- **Export**: A button that exports the tree to a SVG file that the user can download
- **Output format**: A dropdown with options SVG (default), PDF, and PNG
- **Output height**: The height of the exported file. In cm for SVG and PDF. In pixels for PNG. Assumes 300 ppi for conversion between the two when format is changed
- **Output width**: The width of the exported file. In cm for SVG and PDF. In pixels for PNG. Assumes 300 ppi for conversion between the two when format is changed.
