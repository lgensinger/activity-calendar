# Activity Calendar

ES6 d3.js activity calendar visualization.


## Style

Style is expected to be addressed via css. The top-level svg is assigned a class `lgv-activity-calendar`. Any style not met by the visualization module is expected to be added by the importing component.

## Environment Variables

The following values can be set via environment or passed into the class.

| Name | Type | Description |
| :-- | :-- | :-- |
| `DIMENSION_HEIGHT` | integer | height of artboard |
| `DIMENSION_WIDTH` | integer | width of artboard |
| `LAYOUT_CELL_SIZE` | integer | width/height value of individual calendar cell |

## Install

```bash
# install package
npm install @lgv/activity-calendar
```

## Data Format

The following values are the expected input data structure.

```json
[
    {
        date: "2021-01-01",
        type: "work",
        value: 1
    },
    {
        date: "2021-01-02",
        type: "play",
        value: 3
    }
]
```

## Use Module

```bash
import { ActivityCalendar } from "@lgv/activity-calendar";

// initialize
const ac = new ActivityCalendar(data);

// render visualization
ac.render(document.body);
```
