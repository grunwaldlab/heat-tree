<template>
  <div class="hero-with-widget">
    <div class="hero-content">
      <h1 class="hero-name">heat-tree</h1>
      <p class="hero-text">Interactive Phylogenetic Tree Visualization</p>
      <p class="hero-tagline">
        A self-contained widget for phylogenetic and taxonomic tree visualization 
        with categorical and continuous variables associated with nodes and tips.
      </p>
      <div class="hero-actions">
        <a href="/guide/getting-started" class="hero-button primary">Get Started</a>
        <a href="https://github.com/grunwaldlab/heat-tree" class="hero-button">View on GitHub</a>
      </div>
    </div>
    <div class="hero-widget-container">
      <iframe
        :srcdoc="demoCode"
        height="400px"
        frameborder="0"
        class="hero-iframe"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  </div>
</template>

<script setup>
const BASE = 'https://raw.githubusercontent.com/grunwaldlab/heattree/main/demo/data'

// Split script tag to avoid Vue parsing issues
const scriptEnd = '<' + '/script>'

const demoCode = `<!DOCTYPE html>
<div id="c" style="width:100%;height:400px;border:1px solid #ddd"></div>
<script type="module">
import { heatTree } from 'https://esm.sh/@grunwaldlab/heat-tree';
const tree = await (await fetch('${BASE}/weisberg_2020_mlsa.tre')).text();
const meta = await (await fetch('${BASE}/weisberg_2020_metadata.tsv')).text();
heatTree('#c', {
  name: 'Weisberg 2020 MLSA',
  tree: tree,
  metadata: [{ name: 'Strain Metadata', data: meta }],
  aesthetics: { tipLabelText: 'strain', tipLabelColor: 'host_type' }
}, { layout: 'circular', manualZoomAndPanEnabled: true });
${scriptEnd}`
</script>

<style scoped>
.hero-with-widget {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
  max-width: 1200px;
  margin: 0 auto;
}

.hero-content {
  flex: 1 1 45%;
  min-width: 300px;
  text-align: left;
}

.hero-name {
  font-size: 3rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(120deg, #bd34fe 30%, #41d1ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-text {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--vp-c-text-1);
}

.hero-tagline {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0 0 2rem 0;
  max-width: 500px;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-button {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.hero-button.primary {
  background-color: var(--vp-c-brand);
  color: white;
}

.hero-button.primary:hover {
  background-color: var(--vp-c-brand-dark);
}

.hero-button:not(.primary) {
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
}

.hero-button:not(.primary):hover {
  background-color: var(--vp-c-bg-mute);
}

.hero-widget-container {
  flex: 1 1 50%;
  min-width: 400px;
  max-width: 600px;
}

.hero-iframe {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: white;
}

/* Mobile: stack vertically */
@media (max-width: 959px) {
  .hero-with-widget {
    flex-direction: column;
    padding: 1rem;
  }
  
  .hero-content {
    flex: 1 1 100%;
    text-align: center;
  }
  
  .hero-tagline {
    max-width: 100%;
  }
  
  .hero-actions {
    justify-content: center;
  }
  
  .hero-widget-container {
    flex: 1 1 100%;
    width: 100%;
    max-width: 100%;
    order: 2;
  }
  
  .hero-content {
    order: 1;
  }
  
  .hero-name {
    font-size: 2.5rem;
  }
  
  .hero-text {
    font-size: 1.5rem;
  }
}

/* Small mobile */
@media (max-width: 640px) {
  .hero-widget-container {
    min-width: unset;
  }
  
  .hero-name {
    font-size: 2rem;
  }
  
  .hero-text {
    font-size: 1.25rem;
  }
}
</style>
