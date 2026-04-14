# Examples

This page showcases real-world examples using published phylogenetic datasets.

## Weisberg et al. 2020

Below are two phylogenetic trees of agrobacteria isolates, one a multilocus sequence analysis (MLSA) and another from a time-calibrated BEAST tree, both from:

> Alexandra J. Weisberg et al., Unexpected conservation and global transmission of agrobacterial virulence plasmids. Science 368, eaba5256 (2020)

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:95vh;"></div>

<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const mlsaTree = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/weisberg_2020_mlsa.tre');
const beastTree = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/weisberg_2020_beast.tre');
const metadata = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/weisberg_2020_metadata.tsv');
const metaText = await metadata.text();
heatTree('#container',
  [
    {
      name: 'MLSA',
      tree: await mlsaTree.text(),
      metadata: [{ name: 'Strain Metadata', data: metaText }],
      aesthetics: {
        tipLabelText: 'strain',
        tipLabelColor: 'host_type'
      }
    },
    {
      name: 'BEAST',
      tree: await beastTree.text(),
      metadata: [{ name: 'Strain Metadata', data: metaText }],
      aesthetics: {
        tipLabelText: 'strain',
        tipLabelColor: 'year_isolated'
      }
    }
  ],
  {
    layout: 'circular',
    manualZoomAndPanEnabled: false
  }
);
</script>
```

<HeatTreeDemo />

Use the "Select tree" dropdown in the toolbar's "Data" tab to switch between the MLSA and BEAST trees.

## Bansal et al. 2021

This example uses phylogenetic trees from a comparative genomics study of Xylella:

> Bansal, K., Kumar, S., Kaur, A., Singh, A., & Patil, P. B. (2021). Deep phylo-taxono genomics reveals Xylella as a variant lineage of plant associated Xanthomonas and supports their taxonomic reunification along with Stenotrophomonas and Pseudoxanthomonas. Genomics, 113(6), 3989-4003.

```html
<!DOCTYPE html>

<div id="container" style="width:100%;height:95vh;"></div>

<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const tree = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/bansal_2021_tree.nwk');
const metadata = await fetch('https://raw.githubusercontent.com/grunwaldlab/heat-tree/dev/docs/public/data/bansal_2021_metadata.tsv');
heatTree('#container',
  {
    name: 'Xylella Tree',
    tree: await tree.text(),
    metadata: [{ name: 'Strain Metadata', data: await metadata.text() }],
    aesthetics: {
      tipLabelText: 'Strain',
      tipLabelColor: 'Lifestyle'
    }
  },
  {
    manualZoomAndPanEnabled: false
  }
);
</script>
```

<HeatTreeDemo />
