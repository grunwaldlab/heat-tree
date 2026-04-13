import { parseNewick } from "./parsers.js";

/**
 * Check if string is NEXUS format
 * @param {string} str 
 * @returns {boolean}
 */
export function isNexusFormat(str) {
  const firstLine = str.trim().split(/\r?\n/)[0].trim();
  return /^#NEXUS$/i.test(firstLine);
}

/**
 * Recursively replace node names in parsed tree object
 * @param {Object} node - Tree node from parseNewick
 * @param {Map<number, string>} translateMap - Number to name mapping
 */
function applyTranslate(node, translateMap) {
  if (node.name) {
    // Check if name is a number that exists in translate map
    const num = parseInt(node.name, 10);
    if (!isNaN(num) && translateMap.has(num)) {
      node.name = translateMap.get(num);
    }
  }

  if (node.children) {
    node.children.forEach(child => applyTranslate(child, translateMap));
  }
}

/**
 * Parse a single TREES block
 * @param {string} blockContent - Content between BEGIN TREES and END
 * @returns {Array<{treeName: string|null, treeData: Object}>} 
 */
function parseTreesBlock(blockContent) {
  const trees = [];
  const translateMap = new Map();

  // Parse TRANSLATE command
  const translateMatch = blockContent.match(/translate\s+([^;]+);/i);
  if (translateMatch) {
    const translateContent = translateMatch[1];
    // Parse "number name," pairs
    const pairs = translateContent.split(/,\s*/);
    pairs.forEach(pair => {
      const match = pair.trim().match(/^(\d+)\s+(.+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const name = match[2].trim();
        translateMap.set(num, name);
      }
    });
  }

  // Parse TREE commands
  const treeRegex = /tree\s*\*?\s*(?:(\S+))?\s*=\s*(?:\[\S+\])?\s*([^;]+);/gi;
  let match;

  while ((match = treeRegex.exec(blockContent)) !== null) {
    let treeName = match[1].replace(/['"]+/g, '') || null;
    if (treeName.toLowerCase() == 'untitled') {
      treeName = null;
    }
    const newickStr = match[2].trim();

    // Parse the Newick to get tree object
    const treeData = parseNewick(newickStr);

    // Apply TRANSLATE to rename nodes
    applyTranslate(treeData, translateMap);

    trees.push({ treeName, treeData });
  }

  return trees;
}

/**
 * Parse NEXUS file content
 * @param {string} nexusStr 
 * @returns {Array<{treeName: string|null, treeData: Object}>}
 */
export function parseNexus(nexusStr) {
  const trees = [];

  // Find all TREES blocks (case-insensitive)
  const treesBlockRegex = /begin\s+trees\s*;([^]*?)end\s*;/gi;
  let blockMatch;

  while ((blockMatch = treesBlockRegex.exec(nexusStr)) !== null) {
    const blockTrees = parseTreesBlock(blockMatch[1]);
    trees.push(...blockTrees);
  }

  return trees;
}
