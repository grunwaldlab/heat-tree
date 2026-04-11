#!/usr/bin/env node

/**
 * Script to generate API documentation from JSDoc comments
 * Uses jsdoc-to-markdown to convert source file comments to markdown
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jsdoc2md from 'jsdoc-to-markdown';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src');
const apiDir = path.join(__dirname, '..', 'docs', 'api');

// Ensure API directory exists
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

// Define the source files and their output names
const filesToProcess = [
  { input: 'index.js', output: 'heat-tree.md', title: 'heatTree Function' },
  { input: 'treeData.js', output: 'tree-data.md', title: 'TreeData Class' },
  { input: 'treeState.js', output: 'tree-state.md', title: 'TreeState Class' },
  { input: 'treeView.js', output: 'tree-view.md', title: 'TreeView Class' }
];

async function generateDocs() {
  console.log('Generating API documentation...\n');

  for (const { input, output, title } of filesToProcess) {
    const inputPath = path.join(srcDir, input);
    const outputPath = path.join(apiDir, output);

    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️  Source file not found: ${input}`);
      continue;
    }

    try {
      // Generate markdown from JSDoc
      const markdown = await jsdoc2md.render({
        files: inputPath,
        'no-gfm': false,
        'example-lang': 'javascript'
      });

      // Add frontmatter and title
      const content = `---
title: ${title}
---

# ${title}

${markdown || '*No JSDoc comments found in this file.*'}
`;

      fs.writeFileSync(outputPath, content);
      console.log(`✓ Generated ${output}`);
    } catch (error) {
      console.error(`✗ Error processing ${input}:`, error.message);
    }
  }

  console.log('\nAPI documentation generation complete!');
}

generateDocs().catch(error => {
  console.error('Failed to generate documentation:', error);
  process.exit(1);
});
