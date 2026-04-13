<script setup>
const BASE = 'https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data'

async function runWeisbergMlsa(id, heatTree) {
  const treeRes = await fetch(BASE + '/weisberg_2020_mlsa.tre')
  const metaRes = await fetch(BASE + '/weisberg_2020_metadata.tsv')
  heatTree(
    '#' + id,
    {
      name: 'MLSA',
      tree: await treeRes.text(),
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

async function runWeisbergBeast(id, heatTree) {
  const treeRes = await fetch(BASE + '/weisberg_2020_beast.tre')
  const metaRes = await fetch(BASE + '/weisberg_2020_metadata.tsv')
  heatTree(
    '#' + id,
    {
      name: 'BEAST',
      tree: await treeRes.text(),
      metadata: [{ name: 'Strain Metadata', data: await metaRes.text() }],
      aesthetics: {
        tipLabelText: 'strain',
        tipLabelColor: 'year_isolated'
      }
    },
    {
      layout: 'circular',
      manualZoomAndPanEnabled: true
    }
  )
}

async function runBansal(id, heatTree) {
  const treeRes = await fetch(BASE + '/bansal_2021_tree.nwk')
  const metaRes = await fetch(BASE + '/bansal_2021_metadata.tsv')
  heatTree(
    '#' + id,
    {
      name: 'Xylella Tree',
      tree: await treeRes.text(),
      metadata: [{ name: 'Strain Metadata', data: await metaRes.text() }],
      aesthetics: {
        tipLabelColor: 'Lifestyle'
      }
    },
    {
      layout: 'circular',
      manualZoomAndPanEnabled: true
    }
  )
}

async function runRectangular(id, heatTree) {
  const treeRes = await fetch(BASE + '/weisberg_2020_mlsa.tre')
  const metaRes = await fetch(BASE + '/weisberg_2020_metadata.tsv')
  heatTree(
    '#' + id,
    {
      name: 'My Tree',
      tree: await treeRes.text(),
      metadata: [{ name: 'Data', data: await metaRes.text() }],
      aesthetics: {
        tipLabelText: 'strain',
        tipLabelColor: 'host_type'
      }
    },
    {
      layout: 'rectangular',
      manualZoomAndPanEnabled: true
    }
  )
}

async function runCircular(id, heatTree) {
  const treeRes = await fetch(BASE + '/weisberg_2020_mlsa.tre')
  const metaRes = await fetch(BASE + '/weisberg_2020_metadata.tsv')
  heatTree(
    '#' + id,
    {
      name: 'My Tree',
      tree: await treeRes.text(),
      metadata: [{ name: 'Data', data: await metaRes.text() }],
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
</script>

# Examples

This page showcases real-world examples using published phylogenetic datasets.

## Weisberg et al. 2020

Below are two phylogenetic trees of agrobacteria isolates, one a multilocus sequence analysis (MLSA) and another from a time-calibrated BEAST tree, both from:

> Alexandra J. Weisberg et al., Unexpected conservation and global transmission of agrobacterial virulence plasmids. Science 368, eaba5256 (2020)

### MLSA Tree

```javascript
import { heatTree } from 'heat-tree';

const treeRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_mlsa.tre');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_metadata.tsv');

heatTree(
  '#container',
  {
    name: 'MLSA',
    tree: await treeRes.text(),
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

<HeatTreeWidget :run="runWeisbergMlsa" height="500px" />

### BEAST Tree

The same dataset can be visualized with the BEAST tree and colored by isolation year:

```javascript
import { heatTree } from 'heat-tree';

const treeRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_beast.tre');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_metadata.tsv');

heatTree(
  '#container',
  {
    name: 'BEAST',
    tree: await treeRes.text(),
    metadata: [{ name: 'Strain Metadata', data: await metaRes.text() }],
    aesthetics: {
      tipLabelText: 'strain',
      tipLabelColor: 'year_isolated'
    }
  },
  {
    layout: 'circular',
    manualZoomAndPanEnabled: true
  }
);
```

<HeatTreeWidget :run="runWeisbergBeast" height="500px" />

## Bansal et al. 2021

This example uses phylogenetic trees from a comparative genomics study of Xylella:

> Bansal, K., Kumar, S., Kaur, A., Singh, A., & Patil, P. B. (2021). Deep phylo-taxono genomics reveals Xylella as a variant lineage of plant associated Xanthomonas and supports their taxonomic reunification along with Stenotrophomonas and Pseudoxanthomonas. Genomics, 113(6), 3989-4003.

```javascript
import { heatTree } from 'heat-tree';

const treeRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/bansal_2021_tree.nwk');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/bansal_2021_metadata.tsv');

heatTree(
  '#container',
  {
    name: 'Xylella Tree',
    tree: await treeRes.text(),
    metadata: [{ name: 'Strain Metadata', data: await metaRes.text() }],
    aesthetics: {
      tipLabelColor: 'Lifestyle'
    }
  },
  {
    layout: 'circular',
    manualZoomAndPanEnabled: true
  }
);
```

<HeatTreeWidget :run="runBansal" height="500px" />

## Layout Comparison

### Rectangular Layout

```javascript
import { heatTree } from 'heat-tree';

const treeRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_mlsa.tre');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_metadata.tsv');

heatTree(
  '#container',
  {
    name: 'My Tree',
    tree: await treeRes.text(),
    metadata: [{ name: 'Data', data: await metaRes.text() }],
    aesthetics: {
      tipLabelText: 'strain',
      tipLabelColor: 'host_type'
    }
  },
  {
    layout: 'rectangular',
    manualZoomAndPanEnabled: true
  }
);
```

<HeatTreeWidget :run="runRectangular" height="500px" />

### Circular Layout

```javascript
import { heatTree } from 'heat-tree';

const treeRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_mlsa.tre');
const metaRes = await fetch('https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data/weisberg_2020_metadata.tsv');

heatTree(
  '#container',
  {
    name: 'My Tree',
    tree: await treeRes.text(),
    metadata: [{ name: 'Data', data: await metaRes.text() }],
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

<HeatTreeWidget :run="runCircular" height="500px" />

## Data Files

The example data files are available in the repository:

| File | Description |
|------|-------------|
| `data/bansal_2021_tree.nwk` | Bansal et al. 2021 phylogenetic tree |
| `data/bansal_2021_metadata.tsv` | Associated metadata |
| `data/weisberg_2020_mlsa.tre` | Weisberg et al. 2020 MLSA tree |
| `data/weisberg_2020_beast.tre` | Weisberg et al. 2020 BEAST tree |
| `data/weisberg_2020_metadata.tsv` | Associated metadata |
