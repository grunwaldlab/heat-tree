# Legends, scales, and aesthetics

## Scales

The information used to convert user-defined columns to tree element sizes, colors, and, labels are stored in classes in `src/scales.js`.
These classes all have a `getValue()` member function to convert user-defined input data into color/size/text.
The following scale classes are implemented:

- **NullScale**: A placeholder that always returns the same value no matter what is passed into it.
- **IdentityScale**: Passes a filtered version of the text passes to it. Can accept a custom function that is applied to modify user-defined values. Can also have a list of "valid" values and anything else is treated as `null`.
- **CategoricalFontStyleScale**: Maps categorical text to different font style outputs. If all input values are already valid output values, it functions like an IdentityScale.
- **ContinuousSizeScale**: Maps continuous data to continuous output within a specified range
- **ContinuousColorScale**: Maps continuous data to continuous color output with a specified palette
- **CategoricalColorScale**: Maps categorical data to a categorical color output with a specified palette



## The `Aesthetic` class

The information used to configure scales and create legends is stored in the `Aesthetic` class.
An instance of this class is associated with each combination of tree attribute (e.g. tip label color/size) and user-defined metadata column.
This class includes the following state data:

- the type of scale (e.g. color, size, text, identity, null). required, no default
- whether the output is categorical or continuous. default: inferred from data
- the default output to be used for missing values. required, no default
- The possible output values (for identity/text), color palette (for color), or output range (for size)
- The units/type of the input values for printing on legends. Default: null (same as short title)
- The short title to be used for controls (dropdowns). Default: A modified version of the column name in input data
- The long title to be used for legends. Default: The same as the short title
- The maximum number of categories to show for categorical output. Excess are collapsed to an "other" category. Default: 10
- The color used for the "other" category. Default: null (use something from the color palette, same as other categories)

This state data is used to infer the following:

- A scale from `src/scales.js`



## Legends

There are different types of legends, many corresponding to the different scale types.
Each legend keeps track of the following state:

- An instance of the `Aesthetic` class
- A x,y position to print the legend
- Which corner of the legend corresponds to the x,y position
- The maximum width/height available to print the legend

This is used to:

- Inferr the dimensions of the legend
- Draw the legend in an SVG element at the specified place
- Handle changes to location 

All legend types have their title above them, aligned right and underlined.

All legend classes extend the `LegendBase` class and implement the following methods:

- `render`: 
- `changePostion`:

### `TextStyleLegend`

Used to show which input values correspond to which font style (italic, bold, normal, etc).
Not shown if functioning like a IdentityScale.

Visually consists of the names of the input categories rendered in the output font style. 

### `TextSizeLegend`

Shows how numeric input values map to text size in labels.

Visually consists of a series of black "A" characters of different sizes, distributed along the output range present in the plot.
Behind the characters is a polygon with a horizontal base, vertical sides, and a sloped top that matches the height of the letters.
Below are ticks with examples of numeric input value corresponding to the letter size.
Sizes shown are chosen such that the numeric values have limited significant figures and are mostly evenly spaced.
Centered below the numbers is the units of the numeric inputs.

### `CategoricalTextColorLegend`

Shows how categorical input values map to text color in labels.

Visually consists of a series of colored squares followed by labels of the input text value.
These are continued on new rows as needed to avoid extending past the maximum width.

### `ContinuousTextColorLegend`

Shows how numeric input values map to text color in labels.

Visually consists of a series of colored letters above a short rectangular gradient/
Below are ticks with examples of numeric input value corresponding to the letter color.
Sizes shown are chosen such that the numeric values have limited significant figures and are mostly evenly spaced.

### `BranchLengthLegend`

reimplement the current branch length legend.

