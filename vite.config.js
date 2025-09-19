import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',          // Output directory
    cssCodeSplit: true,      // Extract CSS into separate files
    sourcemap: true,         // Generate source maps for debugging
    minify: 'esbuild',       // Minify the output
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'HeatTree',
      fileName: (format) => `heat-tree.${format}.js`,
    },
  },
});
