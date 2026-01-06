/**
 * Export tree to file
 */
export function exportTree(treeView, exportState, filename) {
  const bounds = treeView.getCurrentBoundsWithLegends();

  // Calculate dimensions
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // Calculate scale to fit content into export dimensions
  const scaleX = exportState.width / contentWidth;
  const scaleY = exportState.height / contentHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate final dimensions with margin
  const finalWidth = exportState.width + 2 * exportState.margin;
  const finalHeight = exportState.height + 2 * exportState.margin;

  // Calculate translation to center content and add margin
  const translateX = exportState.margin - bounds.minX * scale;
  const translateY = exportState.margin - bounds.minY * scale;

  // Create a new SVG element for export
  const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  exportSvg.setAttribute('width', finalWidth);
  exportSvg.setAttribute('height', finalHeight);
  exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Create a group for the transformed content
  const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  contentGroup.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

  // Clone the tree elements from the view
  const treeGroup = treeView.layers.treeGroup.node();
  const clonedTreeGroup = treeGroup.cloneNode(true);

  // Remove the transform attribute from the cloned group (we'll apply our own)
  clonedTreeGroup.removeAttribute('transform');

  // Remove selection rectangle and buttons from export
  const selectionRect = clonedTreeGroup.querySelector('.selection-rect');
  if (selectionRect) {
    selectionRect.remove();
  }

  contentGroup.appendChild(clonedTreeGroup);
  exportSvg.appendChild(contentGroup);

  // Serialize the SVG
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(exportSvg);

  if (exportState.format === 'svg') {
    // Download as SVG
    downloadFile(svgString, filename, 'image/svg+xml');
  } else if (exportState.format === 'png') {
    // Convert to PNG
    convertSvgToPng(svgString, finalWidth, finalHeight, filename);
  }
}

/**
 * Download a file
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert SVG to PNG
 */
function convertSvgToPng(svgString, width, height, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    });
  };

  img.src = url;
}
