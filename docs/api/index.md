# API Reference

The `heat-tree` library provides a comprehensive API for creating interactive phylogenetic tree visualizations.

## Main Entry Point

### `heatTree(containerSelector, treesInput, options)`

The primary function for creating a heat tree visualization.

**Parameters:**
- `containerSelector` (string): CSS selector for the container element
- `treesInput` (Array|Object, optional): Tree configuration object(s)
- `options` (Object, optional): Global configuration options

**Returns:** Object containing references to tree components

## Core Classes

### [TreeData](/api/tree-data)

Handles parsing and management of tree data in Newick format and associated metadata.

### [TreeState](/api/tree-state)

Manages the state of a tree visualization including layout, scaling, and aesthetics.

### [TreeView](/api/tree-view)

Handles the D3-based rendering of the tree and user interactions.

## Configuration Options

### Tree Input Options

Each tree in the `treesInput` array can have:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | No | Display name for the tree |
| `newick` | string | Yes | Newick format tree string |
| `metadata` | Array | No | Array of metadata tables |
| `aesthetics` | Object | No | Initial aesthetic mappings |

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `layout` | string | `'rectangular'` | Tree layout type |
| `manualZoomAndPanEnabled` | boolean | `true` | Enable zoom/pan controls |
| `autoZoom` | string | `'Default'` | Automatic zoom behavior |
| `autoPan` | string | `'Default'` | Automatic pan behavior |
| `branchLengthScale` | number | `1` | Scale factor for branch lengths |
| `treeHeightScale` | number | `1` | Scale factor for tree height |
| `buttonSize` | number | `25` | Size of control buttons in pixels |
| `transitionDuration` | number | `500` | Duration of animations in ms |

## Aesthetic Mappings

Available aesthetic properties that can be mapped to metadata columns:

- `tipLabelText`: Text content for tip labels
- `tipLabelColor`: Color of tip labels
- `tipLabelSize`: Size of tip labels
- `tipLabelFont`: Font family for tip labels
- `tipLabelStyle`: Font style (normal, bold, italic, bold italic)

## Return Value

The `heatTree` function returns an object with:

```javascript
{
  treeDataInstances,      // Map of tree names to TreeData instances
  treeStateCache,         // Map of tree names to TreeState instances
  treeViewCache,          // Map of tree names to TreeView instances
  getCurrentTreeState,    // Function returning current TreeState
  getCurrentTreeView,     // Function returning current TreeView
  getCurrentTreeName,     // Function returning current tree name
  switchToTree,           // Function to switch to a different tree
  addNewTree,             // Function to add a new tree
  container               // Reference to the widget DOM element
}
```

## TypeScript Types

```typescript
interface TreeConfig {
  name?: string;
  newick: string;
  metadata?: Array<{
    name?: string;
    data: string;
  }>;
  aesthetics?: {
    tipLabelText?: string;
    tipLabelColor?: string;
    tipLabelSize?: string;
    tipLabelFont?: string;
    tipLabelStyle?: string;
  };
}

interface HeatTreeOptions {
  layout?: 'rectangular' | 'circular';
  manualZoomAndPanEnabled?: boolean;
  autoZoom?: 'Default' | 'Both' | 'X' | 'Y' | 'None';
  autoPan?: 'Default' | 'Both' | 'X' | 'Y' | 'None';
  branchLengthScale?: number;
  treeHeightScale?: number;
  buttonSize?: number;
  transitionDuration?: number;
}
```
