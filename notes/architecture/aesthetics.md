Aesthetics define how user-defined values map to some output.
They are like d3 scales, but intended to be changed after creation by user-controlled widgets and change in response to changing user data.
The interpretation of what user-defined values represent might need to change and the details of the conversion to the target values may change, but the type of the target values is likely known ahead of time.
Therefore, aesthetic classes will be split into functions based on their output type: Size, Color, Text

## Features of all aesthetic classes

- Constructor with `values` (array) and `options` (object) inputs
- A `state` object that is the "source of truth" for all settings. All other class data is derived from this and is automatically regenerated when state changes.
- `renderLegend(container)`: creates a SVG legend in the specified container. This legend automatically updates when the aesthetic's state changes.
- `renderControls(container)`: creates HTML-based controls in the specified container that allow the user to modify the aesthetic's state.
- `getValue(x)`: transform a value to the output type of the aesthetic


## sizeAesthetic

state:

- `values`: unique values ordered by frequency
- `domain`: An array of input data reference points to interpolate between
- `range`: An array of output numbers corresponding to the `domain`
- `nullOutput`: Value returned when the input is `null`
- `defaultOutput`: Value returned when the input, `domain`, or `range` is `undefined`
- `inputType`: one of `'number'`, `'date'`, `'text'`
- `outputType`: one of `'continuous'`, `'quantized'`, `'custom'`
- `transform`: one of `'linear'`, `'log'`, '`pow`', '`symlog`'
- `logBase`: The base used when `transform` is `'log'`
- `powExponent`: The exponent used when transform is `'pow'`
- `symlogConstant`: The constant used when transform is `'symlog'`
- `legendShape`: For Quantized and Custom legends, a function that takes a width and height parameters and returns a shape to draw that fits in those dimensions.
- `legendTitle`: The title printed above the legend
- `inputLabel`: The label below the axis, generally used for the units/description of the input value
- `nullInLegend`: If `true` include the size of the null values in the legend
- `showLegend`: If `true`, show the legend, otherwise `renderLegend` returns `null`
- `nCategories`: The number of size categories to output when `outputType` is `'quantized'`, or `'custom'`
- `otherLabel`: The label in the legend for the "other" category when text inputs are grouped
- `nullLabel`: The label in the legend for `null` values
- `textLabels`: A map used to override text labels for custom categories.

Derived:
- `scale`: The d3 scale function used to map input values to output size
- `legendData`: The data used to render the legend. Calculated independent of rendering to allow for multiple output types and to allow for calculating the legend size before rendering.

Functions:

- constructor: 
- `renderLegend(container)`
- `render*Control(container)` where * is `inputType`, `outputType`, `transform`, `nullInLegend`, `showLegend`, `nCategories`

### Continuous -> Continuous

- Number/Date -> Size
- Number/Date -> Color

### Continuous -> Categorical

- Number/Date -> Quantized size
- Number/Date -> Quantized color
- Number/Date -> Text (e.g. low, medium, high)
- Number/Date -> Shape
- Date -> Quantized date

### Categorical -> Continuous


### Categorical -> Categorical

- Text (e.g. low, medium, high) -> Quantized size
- Text (e.g. low, medium, high) -> Quantized color
- Text -> Shape
- Text -> Text
