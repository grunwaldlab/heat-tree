# Getting Started

`heat-tree` embeds an interactive phylogenetic tree in a specified HTML element, typically a `div`.
This guide will walk you through the basics of how to do this.


## Minimal Example

`heat-tree` is designed to be as simple to use as possible while also allowing for advanced customization.
All aspects of the tree that can be defined with JavaScript can also be defined with its built in GUI.
Therefore, it is entirely valid to create a widget with no input and upload tree and metadata interactively.

::: tip Copy and Paste Examples
All examples below are complete, minimal HTML documents that you can copy, save as `.html` files, and open in any modern browser. This allows you to make edits and experiment.
:::

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:100%;"></div>

<script type="module">
  import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
  heatTree('#container');
</script>
```

<HeatTreeDemo />

## Loading Tree Data

The above example is the simplest possible implementation, but typically the widget would be initialized with some data.
The following types of tree data are currently supported:

- [Newick](https://en.wikipedia.org/wiki/Newick_format)
- [Nexus](https://en.wikipedia.org/wiki/Nexus_file)

These are supplied as strings.
Here is an example of embedding a simple newick string directly in the `heatTree` command:

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:95vh;"></div>

<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
heatTree(
  '#container',
  {
    name: 'Simple Tree',
    tree: '(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);'
  },
  { manualZoomAndPanEnabled: false }
);
</script>
```

<HeatTreeDemo />

::: tip `manualZoomAndPanEnabled: false` in these examples
For most of the examples here `manualZoomAndPanEnabled` is set to `false` so that users intending to scroll down the page do not zoom instead. You can enable zooming/panning in the "Controls" panel of the GUI
:::

Usually these trees are saved in files so the string will more commonly be derived from parsing data from a URL or uploaded by a user.
The `heat-tree` library includes [example datasets](https://github.com/grunwaldlab/heat-tree/tree/dev/docs/public/data) that you can use for testing.
Here is an example using real phylogenetic data adapted from [Weisberg et al. 2020](https://www.science.org/doi/10.1126/science.aba5256):

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:95vh;"></div>

<script type="module">
  import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
  const newick = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/weisberg_2020_mlsa.tre');
  heatTree('#container',
    {
      name: 'Weisberg 2020 MLSA',
      tree: await newick.text(),
    },
    { manualZoomAndPanEnabled: false }
  );
</script>
```

<HeatTreeDemo />

::: tip
Try interacting with the widget above! You can:
- **Zoom**: Use mouse wheel or pinch gesture
- **Pan**: Click and drag
- **Collapse/Expand**: Click on nodes
- **Change aesthetics**: Use the toolbar controls
:::

## Adding Metadata

Metadata can be associated with tree nodes to control visual properties. Metadata tables should be tab-separated or comma-separated text with a column that corresponds to node IDs in the Newick string. The column that contains node IDs is automatically selected.

```html
<!DOCTYPE html>
<div id="container" style="width:100%;height:100%;"></div>
<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const meta = `node_id\tabundance\tsource
A\t145\tfarm
B\t892\tnursery
C\t234\tcity`;
heatTree('#container', { name: 'My Tree', tree: '(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);', metadata: [{ name: 'Sample Data', data: meta }] });
</script>
```

<HeatTreeDemo  />

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:95vh;"></div>

<script type="module">
  import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
  const newick = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/weisberg_2020_mlsa.tre');
  const metadata = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/weisberg_2020_metadata.tsv');
  heatTree('#container',
    {
      name: 'Weisberg 2020 MLSA',
      tree: await newick.text(),
      metadata: [{ name: 'Strain Metadata', data: await metadata.text() }],
      aesthetics: { tipLabelText: 'strain', tipLabelColor: 'host_type' }
    },
    { layout: 'circular', manualZoomAndPanEnabled: false }
  );
</script>
```

## Aesthetic Mappings

Although the metadata columns used to color/size tree parts can be set interactively, they can also be defined when the widget first loads:

```html
<!DOCTYPE html>
<div id="container" style="width:100%;height:100%;"></div>
<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const meta = `node_id\tsource\tabundance\tfont_style
A\tfarm\t145\tnormal
B\tnursery\t892\tbold
C\tcity\t234\titalic`;
heatTree('#container', { name: 'My Tree', tree: '(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);', metadata: [{ name: 'Data', data: meta }], aesthetics: { tipLabelColor: 'source', tipLabelSize: 'abundance', tipLabelStyle: 'font_style' } });
</script>
```

<HeatTreeDemo  />

**Available Aesthetics:**

- `tipLabelText`: Text content for tip labels
- `tipLabelColor`: Color of tip labels (supports categorical and continuous data)
- `tipLabelSize`: Size of tip labels (continuous data)
- `tipLabelFont`: Font family for tip labels
- `tipLabelStyle`: Font style for tip labels (normal, bold, italic, bold italic)

## Initial Settings

Although the widget is primarily designed for interactive use, the initial settings can be set programmatically:

```html
<!DOCTYPE html>
<div id="container" style="width:100%;height:100%;"></div>
<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const BASE = 'https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data';
heatTree('#container', {
  name: 'Xylella Tree',
  tree: await (await fetch(BASE + '/bansal_2021_tree.nwk')).text(),
  metadata: [{ name: 'Data', data: await (await fetch(BASE + '/bansal_2021_metadata.tsv')).text() }],
  aesthetics: { tipLabelColor: 'Lifestyle' }
}, { layout: 'circular', branchLengthScale: 1.5, treeHeightScale: 2, autoZoom: 'Both', autoPan: 'Both', manualZoomAndPanEnabled: true, transitionDuration: 750 });
</script>
```

<HeatTreeDemo  />

## Multiple Trees

The widget can be initialized with multiple trees:

```html
<!DOCTYPE html>
<div id="container" style="width:100%;height:100%;"></div>
<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const BASE = 'https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data';
const meta = await (await fetch(BASE + '/weisberg_2020_metadata.tsv')).text();
heatTree('#container', [
  { name: 'MLSA', tree: await (await fetch(BASE + '/weisberg_2020_mlsa.tre')).text(), metadata: [{ name: 'Metadata', data: meta }], aesthetics: { tipLabelText: 'strain', tipLabelColor: 'host_type' } },
  { name: 'BEAST', tree: await (await fetch(BASE + '/weisberg_2020_beast.tre')).text(), metadata: [{ name: 'Metadata', data: meta }], aesthetics: { tipLabelText: 'strain', tipLabelColor: 'year_isolated' } }
]);
</script>
```

<HeatTreeDemo />

Use the toolbar's "Data" tab to switch between loaded trees.

## Interactive Features

Once the widget is created, you can:

- **Switch trees**: Use the Data tab to select different loaded trees
- **Apply aesthetics**: Map metadata columns to visual properties
- **Manipulate the tree**: Collapse/expand clades, hide/reveal nodes
- **Zoom and pan**: Navigate large trees (if enabled)
- **Export**: Save the visualization as SVG or PNG

## Next Steps

- Learn about [Installation](/guide/installation) options
- See more [Examples](/guide/examples) with real datasets
- Explore the [API Reference](/api/) for complete documentation
