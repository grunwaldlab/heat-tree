Aesthetics define how user-defined values map to some output.
They are like d3 scales, but intended to be changed after creation by use-controlled widgets.
The interpretation of what user-defined values represent might need to change and the details of the conversion to the target values may change, but the type of the target values is likely known ahead of time.
Therefore, aesthetic classes will be split into functions based on their output type: Size, Color, Text

## Features of all aesthetic classes

- Constructor with `values` (array) and `options` (object) inputs
- A `state` object that is the "source of truth" for all settings. All other class data is derived from this and is automatically regenerated when state changes.
- `renderLegend(container)`: creates a SVG legend in the specified container
- `renderControls(container)`: creates HTML-based controls in the specified container
- `getValue(x)`: transform a value to the output type of the aesthetic


## sizeAesthetic

state:

- `domain`: An array of input data reference points to interpolate between
- `range`: An array of output numbers corresponding to the `domain`
- `nullOutput`: Value returned when the input is `null`
- `undefinedOutput`: Value returned when the input is `undefined`
- `emptyOutput`: Value returned when the input is an empty string `''`
- `defaultOutput`: Value returned if no non-nullish values were supplied
- `inputType`: one of `'number'`, `'date'`, `'text'`
- `outputType`: one of `'continuous'`, `'quantized'`, `'custom'`
- `transform`: one of `'linear'`, `'log'`, '`pow`', '`symlog`'
- `logBase`: The base used when `transform` is `'log'`
- `powExponent`: The exponent used when transform is `'pow'`
- `symlogConstant`: The constant used when transform is `'symlog'`
- `legendShape`: For Quantized and Custom legends, a function that takes a width and height parameters and returns a shape to draw that fits in those dimensions.
- `legendTitle`: The title printed above the legend
- `inputLabel`: The label below the axis, generally used for the units/description of the input value
- `showNullInLegend`: If `true` include the size of the null values in the legend
- `showLegend`: If `true`, show the legend, otherwise `renderLegend` returns `null`
- `nCategories`: The number of size categories to output when `outputType` is `'quantized'`, or `'custom'`





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
