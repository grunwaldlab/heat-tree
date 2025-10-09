// Calculate optimal scaling factors using constraint-based approach
export function calculateScalingFactors(root, viewWidthPx, viewHeightPx, options, characterWidthProportion = 0.65) {
  // Calculate leaf annotation dimensions for each node
  const leafData = root.leaves().map(node => {
    let nameLen;
    if (node.collapsed_children) {
      nameLen = node.collapsed_children_name ? node.collapsed_children_name.length : 0;
    } else if (node.collapsed_parent) {
      nameLen = node.collapsed_parent_name ? node.collapsed_parent_name.length : 0;
    } else {
      nameLen = node.data.name ? node.data.name.length : 0;
    }

    const labelScale = 1; // Unitless scaling factor (assuming 1 for now)

    return {
      x: node.x, // x-axis position in branch length units
      width: characterWidthProportion * nameLen * labelScale,
      height: Math.max(labelScale, options.minBranchThicknessPx),
      labelScale: labelScale
    };
  });

  // Initialize constraint ranges
  let branchLenToPxFactor_min = 0;
  let branchLenToPxFactor_max = Infinity;
  let labelSizeToPxFactor_min = 0;
  let labelSizeToPxFactor_max = Infinity;

  function applyBranchMax(newMax) {
    if (newMax < branchLenToPxFactor_max) {
      if (newMax < branchLenToPxFactor_min) {
        branchLenToPxFactor_max = branchLenToPxFactor_min;
      } else {
        branchLenToPxFactor_max = newMax;
      }
    }
  }

  function applyBranchMin(newMin) {
    if (newMin > branchLenToPxFactor_min) {
      if (newMin > branchLenToPxFactor_max) {
        branchLenToPxFactor_min = branchLenToPxFactor_max;
      } else {
        branchLenToPxFactor_min = newMin;
      }
    }
  }

  function applyLabelMax(newMax) {
    if (newMax < labelSizeToPxFactor_max) {
      if (newMax < labelSizeToPxFactor_min) {
        labelSizeToPxFactor_max = labelSizeToPxFactor_min;
      } else {
        labelSizeToPxFactor_max = newMax;
      }
    }
  }

  function applyLabelMin(newMin) {
    if (newMin > labelSizeToPxFactor_min) {
      if (newMin > labelSizeToPxFactor_max) {
        labelSizeToPxFactor_min = labelSizeToPxFactor_max;
      } else {
        labelSizeToPxFactor_min = newMin;
      }
    }
  }

  const minLabelScale = Math.min(...leafData.map(a => a.labelScale));
  const maxBranchX = Math.max(...leafData.map(a => a.x));
  const nonZeroBranches = root.descendants().filter(a => a.data.length > 0 && a.children);
  const minbranchLength = nonZeroBranches.length > 0 ? Math.min(...nonZeroBranches.map(a => a.data.length)) : Infinity;

  // Text should be readable at 100% zoom
  applyLabelMin(options.minFontPx / minLabelScale);

  // Branches should take up minimum proportion of tree space
  applyBranchMin(Math.max(...leafData.map(a =>
    (a.width * labelSizeToPxFactor_min) / ((maxBranchX / options.minBranchLenProp) - a.x)
  )))

  // Tree width should fit into viewing window
  applyBranchMax(Math.min(...leafData.map(a =>
    (viewWidthPx - a.width * labelSizeToPxFactor_min) / a.x
  )));
  applyLabelMax(Math.min(...leafData.map(a =>
    (viewWidthPx - a.x * branchLenToPxFactor_min) / a.width
  )));

  // Tree height should fit into viewing window
  applyLabelMax(viewHeightPx / leafData.reduce((sum, a) => sum + a.height, 0));

  // Text should be large and easy to read
  applyLabelMin(options.idealFontPx / minLabelScale, undefined);

  // Tree width should fit into viewing window (recalculate since labelSizeToPxFactor_min changed)
  applyBranchMax(Math.min(...leafData.map(a =>
    (viewWidthPx - a.width * labelSizeToPxFactor_min) / a.x
  )));

  // Shortest non-zero branches should be longer than branch thickness
  if (isFinite(minbranchLength)) {
    applyBranchMin(options.minBranchThicknessPx / minbranchLength);
    // Tree width should fit into viewing window (recalculate since branchLenToPxFactor_min changed)
    applyLabelMax(Math.min(...leafData.map(a =>
      (viewWidthPx - a.x * branchLenToPxFactor_min) / a.width
    )));
  }

  // Text should be less than maximum size
  applyLabelMax(options.maxFontPx / minLabelScale);

  return {
    branchLenToPxFactor_min: branchLenToPxFactor_min,
    branchLenToPxFactor_max: branchLenToPxFactor_max,
    labelSizeToPxFactor_min: labelSizeToPxFactor_min,
    labelSizeToPxFactor_max: labelSizeToPxFactor_max
  };
}
