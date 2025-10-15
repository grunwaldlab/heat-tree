// Calculate optimal scaling factors using constraint-based approach for rectangular layouts
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
      width: characterWidthProportion * nameLen * labelScale + options.nodeLabelOffset * labelScale,
      height: labelScale,
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
  )));

  // Tree width should fit into viewing window
  applyBranchMax(Math.min(...leafData.map(a =>
    (viewWidthPx - a.width * labelSizeToPxFactor_min) / a.x
  )));
  applyLabelMax(Math.min(...leafData.map(a =>
    (viewWidthPx - a.x * branchLenToPxFactor_min) / a.width
  )));

  // Tree height should fit into viewing window
  if (labelSizeToPxFactor_min != labelSizeToPxFactor_max) {
    applyLabelMax(viewHeightPx / leafData.reduce((sum, a) => sum + a.height, 0));
  }

  // Text should be large and easy to read
  if (labelSizeToPxFactor_min != labelSizeToPxFactor_max) {
    applyLabelMin(options.idealFontPx / minLabelScale);
  }

  // Tree width should fit into viewing window (recalculate since labelSizeToPxFactor_min changed)
  if (branchLenToPxFactor_min != branchLenToPxFactor_max) {
    applyBranchMax(Math.min(...leafData.map(a =>
      (viewWidthPx - a.width * labelSizeToPxFactor_min) / a.x
    )));
  }

  // Shortest non-zero branches should be longer than branch thickness
  if (isFinite(minbranchLength)) {
    if (branchLenToPxFactor_min != branchLenToPxFactor_max) {
      applyBranchMin(options.minBranchThicknessPx / minbranchLength);
    }
    // Tree width should fit into viewing window (recalculate since branchLenToPxFactor_min changed)
    if (labelSizeToPxFactor_min != labelSizeToPxFactor_max) {
      applyLabelMax(Math.min(...leafData.map(a =>
        (viewWidthPx - a.x * branchLenToPxFactor_min) / a.width
      )));
    }
  }

  // Text should be less than maximum size
  if (labelSizeToPxFactor_min != labelSizeToPxFactor_max) {
    applyLabelMax(options.maxFontPx / minLabelScale);
  }

  return {
    branchLenToPxFactor_min: branchLenToPxFactor_min,
    branchLenToPxFactor_max: branchLenToPxFactor_max,
    labelSizeToPxFactor_min: labelSizeToPxFactor_min,
    labelSizeToPxFactor_max: labelSizeToPxFactor_max
  };
}

// Calculate optimal scaling factors using constraint-based approach for circular layouts
export function calculateCircularScalingFactors(root, viewWidthPx, viewHeightPx, options, characterWidthProportion = 0.65) {
  const leaves = root.leaves();

  // Calculate leaf annotation dimensions for each node
  const leafData = leaves.map((node, i) => {
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
      radius: node.radius, // x-axis position in branch length units (radius)
      angle: node.angle,
      cos: node.cos,
      sin: node.sin,
      width: characterWidthProportion * nameLen * labelScale + options.nodeLabelOffset * labelScale,
      height: labelScale,
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
  const maxBranchX = Math.max(...leafData.map(a => a.radius));
  const minBranchX = Math.min(...leafData.map(a => a.radius));
  const nonZeroBranches = root.descendants().filter(a => a.data.length > 0 && a.children);
  const minBranchLength = nonZeroBranches.length > 0 ? Math.min(...nonZeroBranches.map(a => a.data.length)) : Infinity;

  // Text should be readable at 100% zoom
  applyLabelMin(options.minFontPx / minLabelScale);

  // Branches should take up minimum proportion of tree space
  if (branchLenToPxFactor_min !== branchLenToPxFactor_max) {
    applyBranchMin(
      Math.max(...leafData.map(a =>
        (a.width * labelSizeToPxFactor_min) / ((maxBranchX / options.minBranchLenProp) - a.radius)
      ))
    );
  }

  // Tree should fit into viewing window
  function applyBranchViewConstraint() {
    const rightBranchFactor = Math.min(...leafData.filter(a => a.cos > 0).map(a => (viewWidthPx / 2 - a.width * a.cos * labelSizeToPxFactor_min) / (a.radius * a.cos)));
    const leftBranchFactor = Math.min(...leafData.filter(a => a.cos < 0).map(a => (viewWidthPx / 2 - a.width * -a.cos * labelSizeToPxFactor_min) / (a.radius * -a.cos)));
    const bottomBranchFactor = Math.min(...leafData.filter(a => a.sin > 0).map(a => (viewHeightPx / 2 - a.width * a.sin * labelSizeToPxFactor_min) / (a.radius * a.sin)));
    const topBranchFactor = Math.min(...leafData.filter(a => a.sin < 0).map(a => (viewHeightPx / 2 - a.width * -a.sin * labelSizeToPxFactor_min) / (a.radius * -a.sin)));
    applyBranchMax(Math.min(
      (rightBranchFactor + leftBranchFactor) / 2,
      (topBranchFactor + bottomBranchFactor) / 2
    ));
  }
  function applyLabelViewConstraint() {
    const rightLabelFactor = Math.min(...leafData.filter(a => a.cos > 0).map(a => (viewWidthPx / 2 - a.radius * a.cos * branchLenToPxFactor_min) / (a.width * a.cos)));
    const leftLabelFactor = Math.min(...leafData.filter(a => a.cos < 0).map(a => (viewWidthPx / 2 - a.radius * -a.cos * branchLenToPxFactor_min) / (a.width * -a.cos)));
    const bottomLabelFactor = Math.min(...leafData.filter(a => a.sin > 0).map(a => (viewHeightPx / 2 - a.radius * a.sin * branchLenToPxFactor_min) / (a.width * a.sin)));
    const topLabelFactor = Math.min(...leafData.filter(a => a.sin < 0).map(a => (viewHeightPx / 2 - a.radius * -a.sin * branchLenToPxFactor_min) / (a.width * -a.sin)));
    applyLabelMax(Math.min(
      (rightLabelFactor + leftLabelFactor) / 2,
      (topLabelFactor + bottomLabelFactor) / 2
    ));
  }
  applyBranchViewConstraint();
  applyLabelViewConstraint();

  // Leaf annotations should not overlap when used in a circular layout
  const totalAnnotationHeight = leafData.reduce((sum, a) => sum + a.height, 0);
  if (totalAnnotationHeight > 0 && minBranchX > 0) {
    if (branchLenToPxFactor_min !== branchLenToPxFactor_max) {
      applyBranchMin((totalAnnotationHeight * labelSizeToPxFactor_min) / (minBranchX * 2 * Math.PI));
    }
    if (labelSizeToPxFactor_min !== labelSizeToPxFactor_max) {
      applyLabelMax((maxBranchX * branchLenToPxFactor_max * 2 * Math.PI) / totalAnnotationHeight);
    }
  }

  // Tree should fit into viewing window (recalculate since branch limits might have changed)
  if (labelSizeToPxFactor_min !== labelSizeToPxFactor_max) {
    applyLabelViewConstraint();
  }

  // Text should be large and easy to read
  if (labelSizeToPxFactor_min !== labelSizeToPxFactor_max) {
    applyLabelMin(options.idealFontPx / minLabelScale);
  }

  // Tree should fit into viewing window (recalculate since label limits might have changed)
  if (branchLenToPxFactor_min !== branchLenToPxFactor_max) {
    applyBranchViewConstraint();
  }

  // Shortest non-zero branches should be longer than branch thickness
  if (isFinite(minBranchLength) && minBranchLength > 0) {
    if (branchLenToPxFactor_min !== branchLenToPxFactor_max) {
      applyBranchMin(options.minBranchThicknessPx / minBranchLength);
    }
  }

  // Tree should fit into viewing window (recalculate since branch limits might have changed)
  if (labelSizeToPxFactor_min !== labelSizeToPxFactor_max) {
    applyLabelViewConstraint();
  }

  // Text should be less than maximum size
  if (labelSizeToPxFactor_min !== labelSizeToPxFactor_max) {
    applyLabelMax(options.maxFontPx / minLabelScale);
  }

  return {
    branchLenToPxFactor_min: branchLenToPxFactor_min,
    branchLenToPxFactor_max: branchLenToPxFactor_max,
    labelSizeToPxFactor_min: labelSizeToPxFactor_min,
    labelSizeToPxFactor_max: labelSizeToPxFactor_max
  };
}
