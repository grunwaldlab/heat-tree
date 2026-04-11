<script setup>
const BASE = 'https://raw.githubusercontent.com/grunwaldlab/heat-tree/refs/heads/dev/docs/public/data'

async function runBasicUsage(id, heatTree) {
  heatTree('#' + id)
}

async function runSimpleExample(id, heatTree) {
  const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);"
  heatTree('#' + id, {
    name: 'Simple Tree',
    newick: newickString
  })
}

async function runRealDataset(id, heatTree) {
  const treeRes = await fetch(BASE + '/weisberg_2020_mlsa.tre')
  const metaRes = await fetch(BASE + '/weisberg_2020_metadata.tsv')
  heatTree(
    '#' + id,
    {
      name: 'Weisberg 2020 MLSA',
      newick: await treeRes.text(),
      metadata: [{ name: 'Strain Metadata', data: await metaRes.text() }],
      aesthetics: {
        tipLabelText: 'strain',
        tipLabelColor: 'host_type'
      }
    },
    {
      layout: 'circular',
      manualZoomAndPanEnabled: true
    }
  )
}

async function runAddingMetadata(id, heatTree) {
  const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);"
  const metadata = `node_id\tabundance\tsource
A\t145\tfarm
B\t892\tnursery
C\t234\tcity`
  heatTree(
    '#' + id,
    {
      name: 'My Tree',
      newick: newickString,
      metadata: [{ name: 'Sample Data', data: metadata }]
    }
  )
}

async function runAestheticMappings(id, heatTree) {
  const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);"
  const metadata = `node_id\tsource\tabundance\tfont_style
A\tfarm\t145\tnormal
B\tnursery\t892\tbold
C\tcity\t234\titalic`
  heatTree(
    '#' + id,
    {
      name: 'My Tree',
      newick: newickString,
      metadata: [{ name: 'Data', data: metadata }],
      aesthetics: {
        tipLabelColor: 'source',
        tipLabelSize: 'abundance',
        tipLabelStyle: 'font_style'
      }
    }
  )
}

async function runInitialSettings(id, heatTree) {
  const treeRes = await fetch(BASE + '/bansal_2021_tree.nwk')
  const metaRes = await fetch(BASE + '/bansal_2021_metadata.tsv')
  heatTree(
    '#' + id,
    {
      name: 'Xylella Tree',
      newick: await treeRes.text(),
      metadata: [{ name: 'Data', data: await metaRes.text() }],
      aesthetics: {
        tipLabelColor: 'Lifestyle'
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
  )
}

async function runMultipleTrees(id, heatTree) {
  const tree1Res = await fetch(BASE + '/weisberg_2020_mlsa.tre')
  const tree2Res = await fetch(BASE + '/weisberg_2020_beast.tre')
  const metaRes = await fetch(BASE + '/weisberg_2020_metadata.tsv')
  const metaText = await metaRes.text()
  heatTree(
    '#' + id,
    [
      {
        name: 'MLSA',
        newick: await tree1Res.text(),
        metadata: [{ name: 'Metadata', data: metaText }],
        aesthetics: { tipLabelText: 'strain', tipLabelColor: 'host_type' }
      },
      {
        name: 'BEAST',
        newick: await tree2Res.text(),
        metadata: [{ name: 'Metadata', data: metaText }],
        aesthetics: { tipLabelText: 'strain', tipLabelColor: 'year_isolated' }
      }
    ]
  )
}
</script>

# Getting Started

The `heat-tree` library includes example datasets that you can use to try it out with minimal effort. This guide will walk you through the basics of creating interactive phylogenetic tree visualizations.

::: tip Top-Level Await
This guide uses top-level `await` for cleaner code. Ensure your script uses `<script type="module">` or use a bundler like Vite/Webpack.
:::

## Basic Usage

This library is designed to be as simple to use as possible while also allowing for advanced customization. In fact, since you can upload tree and metadata interactively, it is entirely valid to create a widget with no input:

```javascript
import { heatTree } from 'heat-tree';

// Create an empty widget - trees can be loaded interactively
heatTree('#container');
```

<HeatTreeWidget :run="runBasicUsage" height="300px" />

## Loading Tree Data

The following types of input data are currently supported:

- Newick-formatted strings
- Objects with `newick`, `name`, and optional `metadata` properties

### Simple Example

```javascript
import { heatTree } from 'heat-tree';

const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);";

heatTree('#container', {
  name: 'Simple Tree',
  newick: newickString
});
```

<HeatTreeWidget :run="runSimpleExample" height="300px" />

## Real Dataset Example

Here's an example using real phylogenetic data from Weisberg et al. 2020:

```javascript
import { heatTree } from 'heat-tree';

const treeRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_mlsa.tre');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_metadata.tsv');

heatTree(
  '#container',
  {
    name: 'Weisberg 2020 MLSA',
    newick: await treeRes.text(),
    metadata: [{ name: 'Strain Metadata', data: await metaRes.text() }],
    aesthetics: {
      tipLabelText: 'strain',
      tipLabelColor: 'host_type'
    }
  },
  {
    layout: 'circular',
    manualZoomAndPanEnabled: true
  }
);
```

<HeatTreeWidget :run="runRealDataset" height="400px" />

::: tip
Try interacting with the widget above! You can:
- **Zoom**: Use mouse wheel or pinch gesture
- **Pan**: Click and drag
- **Collapse/Expand**: Click on nodes
- **Change aesthetics**: Use the toolbar controls
:::

## Adding Metadata

Metadata can be associated with tree nodes to control visual properties. Metadata tables should be tab-separated or comma-separated text with a column that corresponds to node IDs in the Newick string. The column that contains node IDs is automatically selected.

```javascript
import { heatTree } from 'heat-tree';

const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);";

const metadata = `node_id\tabundance\tsource
A\t145\tfarm
B\t892\tnursery
C\t234\tcity`;

heatTree(
  '#container',
  {
    name: 'My Tree',
    newick: newickString,
    metadata: [{ name: 'Sample Data', data: metadata }]
  }
);
```

<HeatTreeWidget :run="runAddingMetadata" height="400px" />

## Aesthetic Mappings

Although the metadata columns used to color/size tree parts can be set interactively, they can also be defined when the widget first loads:

```javascript
import { heatTree } from 'heat-tree';

const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);";
const metadata = `node_id\tsource\tabundance\tfont_style
A\tfarm\t145\tnormal
B\tnursery\t892\tbold
C\tcity\t234\titalic`;

heatTree(
  '#container',
  {
    name: 'My Tree',
    newick: newickString,
    metadata: [{ name: 'Data', data: metadata }],
    aesthetics: {
      tipLabelColor: 'source',
      tipLabelSize: 'abundance',
      tipLabelStyle: 'font_style'
    }
  }
);
```

<HeatTreeWidget :run="runAestheticMappings" height="400px" />

**Available Aesthetics:**

- `tipLabelText`: Text content for tip labels
- `tipLabelColor`: Color of tip labels (supports categorical and continuous data)
- `tipLabelSize`: Size of tip labels (continuous data)
- `tipLabelFont`: Font family for tip labels
- `tipLabelStyle`: Font style for tip labels (normal, bold, italic, bold italic)

## Initial Settings

Although the widget is primarily designed for interactive use, the initial settings can be set programmatically:

```javascript
import { heatTree } from 'heat-tree';

const treeRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/bansal_2021_tree.nwk');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/bansal_2021_metadata.tsv');

heatTree(
  '#container',
  {
    name: 'Xylella Tree',
    newick: await treeRes.text(),
    metadata: [{ name: 'Data', data: await metaRes.text() }],
    aesthetics: {
      tipLabelColor: 'Lifestyle'
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

<HeatTreeWidget :run="runInitialSettings" height="400px" />

## Multiple Trees

The widget can be initialized with multiple trees:

```javascript
import { heatTree } from 'heat-tree';

const tree1Res = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_mlsa.tre');
const tree2Res = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_beast.tre');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_metadata.tsv');
const metaText = await metaRes.text();

heatTree(
  '#container',
  [
    {
      name: 'MLSA',
      newick: await tree1Res.text(),
      metadata: [{ name: 'Metadata', data: metaText }],
      aesthetics: { tipLabelText: 'strain', tipLabelColor: 'host_type' }
    },
    {
      name: 'BEAST',
      newick: await tree2Res.text(),
      metadata: [{ name: 'Metadata', data: metaText }],
      aesthetics: { tipLabelText: 'strain', tipLabelColor: 'year_isolated' }
    }
  ]
);
```

<HeatTreeWidget :run="runMultipleTrees" height="400px" />

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
