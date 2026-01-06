# heat-tree

A self-contained widget for phylogenetic and taxonomic tree visualization with categorical and continuous variables associated with nodes and tips.

![](docs/images/example_screenshot.png)

## Installation

```bash
npm install heat-tree
```

## Features

- Interactive phylogenetic and taxonomic tree visualization
- Support for both rectangular and circular layouts
- Metadata visualization through color, size, and text styling
- Tree manipulation: collapse/expand/hide/reveal subtrees and roots
- Automatic and manual zoom/pan controls
- Export to SVG and PNG formats
- Responsive design with mobile support
- Minimal dependencies (D3.js only)
- Minimal configuration required

## Quick Start

```javascript
import { heatTree } from 'heat-tree';

const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);";

heatTree(
  {
    trees: [
      {
        name: 'My Tree',
        newick: newickString
      }
    ]
  },
  '#container'
);
```

## Usage

### Basic Usage

The `heatTree` function creates an interactive tree visualization in a specified container element.

```javascript
heatTree(containerSelector, treesInput, options);
```

**Parameters:**

- `containerSelector` (string): CSS selector for the container element (e.g., `'#my-tree'`)
- `treesInput` (Array/Object, optional): Configuration object containing tree data or an array of such objects
  - `newick` (string, required): Newick format tree string
  - `name` (string, optional): Display name for the tree
  - `metadata` (Array|Object, optional): Metadata tables (see Metadata section)
  - `aesthetics` (Object, optional): Initial aesthetic mappings (see Aesthetics section)
- `options` (Object, optional): Configuration options (see Options section)

You can also pass just a container selector to create an empty visualization (trees can be loaded interactively):

```javascript
heatTree('#container');
```

### Adding Metadata

Metadata can be associated with tree nodes to control visual properties:

```javascript
const metadata = `node_id\tabundance\tsource
A\t145\tfarm
B\t892\tnursery
C\t234\tcity`;

heatTree(
  '#container',
  {
    name: 'My Tree',
    newick: newickString,
    metadata: [
      {
        name: 'Sample Data',
        data: metadata
      }
    ]
  }
);
```

Metadata tables should be tab-separated or comma-separated text with a `node_id` column that corresponds to node IDs in the newick string.

### Default Aesthetic Mappings

Although the metadata columns used to color/size tree parts can be set interactively, they can also be defined when the widget first loads:

```javascript
heatTree(
  '#container',
  {
    name: 'My Tree',
    newick: newickString,
    metadata: [{ name: 'Data', data: metadata }],
    aesthetics: {
      tipLabelColor: 'source',      // Color tips by 'source' column
      tipLabelSize: 'abundance',    // Size tips by 'abundance' column
      tipLabelStyle: 'font_style'   // Style tips by 'font_style' column
    }
  }
);
```

**Available Aesthetics:**

- `tipLabelText`: Text content for tip labels
- `tipLabelColor`: Color of tip labels (supports categorical and continuous data)
- `tipLabelSize`: Size of tip labels (continuous data)
- `tipLabelFont`: Font family for tip labels
- `tipLabelStyle`: Font style for tip labels (normal, bold, italic, bold italic)

## Default Options

Configure the visualization behavior and appearance:

### Layout Options

- `layout` (string): Tree layout type
  - `'rectangular'` (default): Traditional phylogenetic tree layout
  - `'circular'`: Radial/circular tree layout

### Zoom and Pan Options

- `manualZoomAndPanEnabled` (boolean): Enable/disable manual zoom and pan
  - `true` (default): Manual controls enabled
  - `false`: Manual controls disabled

- `autoZoom` (string): Automatic zoom behavior when tree changes
  - `'Default'` (default): Adaptive behavior based on tree and layout
  - `'Both'`: Zoom to fit both width and height
  - `'X'`: Zoom to fit width only
  - `'Y'`: Zoom to fit height only
  - `'None'`: No automatic zooming

- `autoPan` (string): Automatic pan behavior when tree changes
  - `'Default'` (default): Adaptive behavior based on tree and layout
  - `'Both'`: Pan to center or minimize unused space in both dimensions
  - `'X'`: Pan horizontally only
  - `'Y'`: Pan vertically only
  - `'None'`: No automatic panning

### Tree Scaling Options

- `branchLengthScale` (number): Scale factor for branch lengths
  - Range: 0.01 to 100
  - Default: 1

- `treeHeightScale` (number): Scale factor for tree height (spacing between tips)
  - Range: 0.1 to 10
  - Default: 1

### Visual Options

- `buttonSize` (number): Size of control buttons in pixels
  - Default: 25

- `transitionDuration` (number): Duration of animations in milliseconds
  - Default: 500

### Example with Options

```javascript
heatTree(
  '#container',
  {
    name: 'My Tree',
    newick: newickString,
    metadata: [{ name: 'Data', data: metadata }],
    aesthetics: {
      tipLabelColor: 'source'
    }
  },
  {
    layout: 'circular',
    branchLengthScale: 1.5,
    treeHeightScale: 2,
    autoZoom: 'Both',
    autoPan: 'Both',
    manualZoomAndPanEnabled: true,
    transitionDuration: 750
  }
);
```

## Multiple Trees

The widget can be initialized with multiple trees:

```javascript
heatTree(
  '#container',
  [
    {
      name: 'Tree 1',
      newick: newickString1,
      metadata: [{ name: 'Data 1', data: metadata1 }]
    },
    {
      name: 'Tree 2',
      newick: newickString2,
      metadata: [{ name: 'Data 2', data: metadata2 }]
    }
  ]
);
```

Use the toolbar's "Data" tab to switch between loaded trees.

## Dependencies

- [D3.js](https://d3js.org/) v7.9.0

## License

MIT

## Contributing

Contributions are welcome! Please visit the [GitHub repository](https://github.com/grunwaldlab/heat-tree) to report issues or submit pull requests.
