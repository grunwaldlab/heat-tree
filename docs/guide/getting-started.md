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

<div id="container" style="width:100%;height:100vh;"></div>

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

<div id="container" style="width:100%;height:100vh;"></div>

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
For most of the examples here `manualZoomAndPanEnabled` is set to `false` so that users intending to scroll down this page do not zoom instead. You can enable zooming/panning in the "Controls" panel of the GUI
:::

Usually these trees are saved in files so the string will more commonly be derived from parsing data from a URL or database.
The `heat-tree` source code includes [example datasets](https://github.com/grunwaldlab/heat-tree/tree/dev/docs/public/data) that you can use for testing.
Here is an example using real phylogenetic data adapted from [Weisberg et al. 2020](https://www.science.org/doi/10.1126/science.aba5256):

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:100vh;"></div>

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

## Adding Metadata

Metadata associated with tree nodes can be plotted using the size or color of tree components such as tip labels.
Metadata tables should be TSV/CSV formatted text with a column that corresponds to node IDs in the tree input.
The column names of metadata can be associated with different properties of the tree referred to as "aesthetics".

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:100vh;"></div>

<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const meta = `
node_id\tabundance\tsource
A\t145\tfarm
B\t892\tnursery
C\t234\tcity
`;
heatTree(
  '#container',
  {
    ame: 'My Tree',
    tree: '(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);',
    metadata: [{ name: 'Data', data: meta }],
    aesthetics: { tipLabelColor: 'source', tipLabelSize: 'abundance' }
  },
  { manualZoomAndPanEnabled: false }
);
</script>
```

<HeatTreeDemo  />

::: tip Automatic ID column detection
The column that contains node IDs is automatically selected based on its content, so it can have any name and be positioned anywhere in the table.
:::

Here is the previously shown Weisberg 2020 tree with its associated metadata.

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:100vh;"></div>

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
    { manualZoomAndPanEnabled: false }
  );
</script>
```

<HeatTreeDemo  />

**Currently available Aesthetics:**

- `tipLabelText`: Text content for tip labels
- `tipLabelColor`: Color of tip labels (supports categorical and continuous data)
- `tipLabelSize`: Size of tip labels (continuous data)
- `tipLabelFont`: Font family for tip labels
- `tipLabelStyle`: Font style for tip labels (normal, bold, italic, bold italic)


## Multiple Trees

The widget can be initialized with multiple trees by providing an array of objects instead of a single object:

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:100vh;"></div>

<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const weisberg_tree = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/weisberg_2020_mlsa.tre');
const bansal_tree = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/bansal_2021_tree.nwk');
heatTree('#container',
  [
    {
      name: 'Weisberg 2020',
      tree: await weisberg_tree.text(),
    },
    {
      name: 'Bansal 2021',
      tree: await bansal_tree.text(),
    }
  ],
  { manualZoomAndPanEnabled: false }
);
</script>
```

<HeatTreeDemo />

Use the "Select tree" dropdown in the toolbar's "Data" tab to switch between loaded trees.

## Next Steps

- Learn about [Installation](/guide/installation) options
- See more [Examples](/guide/examples) with real datasets
- Explore the [API Reference](/api/) for complete documentation
