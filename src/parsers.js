/**
 * Parse a Newick formatted string.
 * @param {string} newickStr - The Newick formatted string.
 * @returns {object} Parsed tree object.
 */
export function parseNewick(newickStr) {
  newickStr = newickStr.trim();
  if (newickStr[newickStr.length - 1] === ';') {
    newickStr = newickStr.slice(0, -1);
  }
  let index = 0;

  function parseTree() {
    let node = {};
    if (newickStr[index] === '(') {
      index++; // skip '('
      node.children = [];
      while (true) {
        let child = parseTree();
        node.children.push(child);
        if (newickStr[index] === ',') {
          index++;
        } else if (newickStr[index] === ')') {
          index++;
          break;
        } else {
          break;
        }
      }
    }
    let label = '';
    while (index < newickStr.length && newickStr[index] !== ',' && newickStr[index] !== ')') {
      label += newickStr[index++];
    }
    label = label.trim();
    if (label) {
      let parts = label.split(":");
      node.name = parts[0] || "";
      if (parts.length > 1) {
        node.length = parseFloat(parts[1]);
      }
    }
    return node;
  }

  const result = parseTree();
  if (index !== newickStr.length) {
    throw new Error(`Unexpected character at position ${index}: '${newickStr[index]}'`);
  }
  return result;
}
