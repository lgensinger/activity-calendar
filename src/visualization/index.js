import { extent, groups, rollup } from "d3-array";
import { path } from "d3-path";
import { scaleQuantize } from "d3-scale";
import { select } from "d3-selection";
import moment from "moment";

import { configuration, configurationDimension } from "../configuration.js";

/**
 * ActivityCalendar is a time series visualization.
 * @param {array} data - objects where each represents a path in the hierarchy
 * @param {string} dateEnd - iso 8601 date value
 * @param {string} dateStart - iso 8601 date value
 * @param {integer} height - artboard height
 * @param {integer} width - artboard width
 */
class ActivityCalendar {
    constructor(data, dateStart, dateEnd, width=configurationDimension.width, height=configurationDimension.height) {

        // update self
        this.activityTypes = data ? Object.keys(data) : [];
        this.artboard = null;
        this.cellHeight = null;
        this.cellWidth = null;
        this.container = null;
        this.containerCalendar = null;
        this.containerDaysOfWeek = null;
        this.containerWeeksOfYear = null;
        this.dataAggregateDays = null;
        this.dataCells = null;
        this.dataSource = data;
        this.dateEnd = dateEnd;
        this.dateStart = dateStart;
        this.height = height;
        this.months = null;
        this.name = configuration.name;
        this.paddingSide = 0;
        this.paddingTop = 0;
        this.weekdays = [];
        this.weekIndicies = [];
        this.width = width;
        this.years = null;

        // using font size as the base unit of measure make responsiveness easier to manage across devices
        this.artboardUnit = typeof window === "undefined" ? 16 : parseFloat(getComputedStyle(document.body).fontSize);

    }

    /**
     * Condition data for visualization requirements.
     */
    get data() {

        // verify valid source provided
        if (this.dataSource && Object.keys(this.dataSource).length > 0) {

            let activityTypesMerged = [];

            // loop through keys
            for (const key in this.dataSource) {

                // push all activity objects into single array
                activityTypesMerged = activityTypesMerged.concat(this.dataSource[key]);

            }

            // aggregate collab/push days
            this.dataAggregateDays = rollup(activityTypesMerged,
                v => v.length,
                d => moment(d.date).format("YYYY-MM-DD"),
                d => d.type
            );

            let dateEnd = moment(this.dateEnd);
            let dateStart = moment(this.dateStart);

            let weeks = [];

            // get list of first date of months
            while (dateStart < dateEnd) {

                // capture actual date iso string since moment mutates values
                let dateWeek = dateStart.format("YYYY-W");

                // update list
                weeks.push(dateWeek);

                // iterate the date value
                dateStart.add(1, "week");

            }

            // because the time range may/may not be an entire year
            // we need to map index to iso week so we can reference the position later
            this.weekIndicies = weeks;

            // extract years
            this.years = [...new Set(this.weekIndicies.map(d => d.split("-")[0]))];

            // get weekday values
            let weekdays = moment.weekdays();

            // shift so monday is the first day of the week
            weekdays.push(weekdays.shift());

            // update self
            this.weekdays = weekdays;

            let months = [];

            dateEnd = moment(this.dateEnd);
            dateStart = moment(this.dateStart);

            // get list of first date of months
            while (dateStart < dateEnd) {
                months.push(dateStart.format("YYYY-MM-DD"))
                dateStart.add(1, "month")
            }

            // update self
            this.months = months;
            this.dataCells = this.activityTypes.map(d => this.extractActivity(d)).flat();

        }

    }

    /**
     * Construct layout.
     * @returns A d3 pack layout function.
     */
    get layout() {

        // space for annotations
        this.paddingTop = this.artboardUnit * 2;
        this.paddingSide = this.artboardUnit * 2;

        // determine cell size
        this.cellHeight = (this.height - this.paddingTop) / this.weekdays.length;
        this.cellWidth = (this.width - this.paddingSide) / this.weekIndicies.length;

    }

    /**
     * Position and minimally style days of week in SVG dom element.
     * @param {node} domNode - d3.js SVG selection
     */
    configureAnnotationDaysOfWeek(domNode) {
        domNode
            .attr("class", "lgv-annotation-day")
            .attr("x", 0)
            .attr("y", (d,i) => i * this.cellHeight)
            .text(d => d);
    }

    /**
     * Position and minimally style months in SVG dom element.
     * @param {node} domNode - d3.js SVG selection
     */
    configureAnnotationMonths(domNode) {
        domNode
            .attr("class", "lgv-annotation-month")
            .attr("x", d => {

                // get iso week
                let isoWeek = moment(d).format("W");

                // need to find how many years we span
                let isMultiYear = this.years.length > 1;

                // set default for "normal" months that don't cross a year boundary
                let yearWeek = moment(d).format("YYYY-W");

                // if week value is 53 and there are multiple 53 (i.e. time range spans multiple years)
                if (isMultiYear && (isoWeek == 53 || isoWeek == 1)) {

                    // try to find by newer year first
                    if (isoWeek == 1) {

                        // update
                        yearWeek = `${moment(d).format("YYYY")}-1`;

                    } else {

                        // need to find the index of week 53 for year previous for proper alignment
                        yearWeek = `${moment(d).format("YYYY") - 1}-${moment(d).format("W")}`;

                    }

                }

                // get index of date in list of dates in range
                let weekIndex = this.weekIndicies.indexOf(yearWeek);

                // if -1 means the value is on the time boundary
                return  weekIndex === -1 ? this.artboardUnit : (weekIndex * this.cellWidth);

            })
            .attr("y", this.cellHeight * 0.6)
            .each((d, i, nodes) => {
                select(nodes[i])
                    .selectAll("tspan")
                    .data(i == 0 ? [moment(d).format("MMM"), moment(d).format("YYYY")] : (moment(d).format("M") == 1 ? [moment(d).format("MMM"), moment(d).format("YYYY")] : [moment(d).format("MMM")])
                    )
                    .join(
                        enter => enter.append("tspan"),
                        update => update,
                        exit => exit.remove()
                    )
                    .text(x => x)
                    .attr("dx", (x, j) => j == 0 ? "" : 3)
            });
    }

    /**
     * Position and minimally style activity cell shapes in SVG dom element.
     * @param {node} domNode - d3.js SVG selection
     */
    configureCellShapes(domNode) {

        // have to reassign color function or the this conflicts inside the accessor
        let threshold = this.constructThreshold();

        domNode
            .attr("class", "lgv-cell")
            .attr("data-cell-date", d => d[0])
            .attr("data-cell-threshold", d => threshold(d[1]))
            .attr("data-cell-type", d => d[2])
            .attr("data-cell-value", d => d[1])
            .attr("d", d => {

                // have to determine if there is a beginning of the year
                // in the week the current date falls
                // otherwise the week may not be calculatable
                // if the captured index reflects the following or past year, i.e. 52/53 problem
                let days = this.isoDaysofWeek(d[0]);

                // need to get iso week value for each day in week
                // seems counterintuitive but some dates in the same
                // week could fall into different iso weeks
                let daysWeek = days.map(d => moment(d).format("W"));

                // determine what column in the grid the iso week is in
                let columnWeek = this.weekIndicies.indexOf(moment(d[0]).format("YYYY-W"));
                let i = this.activityTypes.indexOf(d[2]);
                let left = columnWeek * this.cellWidth;
                let top = (moment(d[0]).isoWeekday() - 1) * this.cellHeight;

                // -value to generate padding around cell
                let right = left + (this.cellWidth - (this.artboardUnit * 0.15));
                let bottom = top + (this.cellHeight - (this.artboardUnit * 0.15));

                // define connection path
                let p = path();
                // source top/left point of entire path shape
                p.moveTo(left, i == 0 ? top : bottom);
                // line across top of cell left to right
                p.lineTo(right, i == 0 ? top : bottom);
                // line diagonally to bottom left
                p.lineTo(i == 0 ? left : right, i == 0 ? bottom : top);
                // close shape
                p.closePath();

                return p;

            })
            .on("mouseover", (e,d) => {

                this.artboard.dispatch("cellmouseover", {
                    bubbles: true,
                    detail: {
                        date: d[0],
                        threshold: e.target.dataset.cellThreshold,
                        type: d[2],
                        value: d[1],
                        xy: [e.clientX + this.artboardUnit, e.clientY + this.artboardUnit]
                    }
                })
            });
    }

    /**
     * Construct threshold for cell value.
     * @returns A d3.js scale function.
     */
    constructThreshold() {

        // extract values pertaining to activity type
        let values = (this.dataCells || [])
            .map(d => d[1]);

        // construct scale
        return scaleQuantize()
            .domain(extent(values))
            .range([1, 2, 3]);

    }

    /**
     * Format entries to simple array filtered for key.
     * @param {string} key - type of activity which is a key from the raw source data
     * @returns A 1d array where 0 == iso date value, 1 == key'd value.
     */
    extractActivity(key) {

        let result = [];

        // check for valid value data
        if (this.dataAggregateDays) {

            result = Array.from(this.dataAggregateDays)
                .map(d => [d[0], Object.fromEntries(d[1])])
                .filter(d => Object.keys(d[1]).includes(key))
                .map(d => [d[0], d[1][key]]);

        }

        return result.map(d => d.concat([key]));

    }

    /**
     * Generate chart annotations in SVG element.
     */
    generateAnnotations() {

        // days of week
        const daysOfWeek = this.generateDaysOfWeek(this.containerDaysOfWeek);
        this.configureAnnotationDaysOfWeek(daysOfWeek);

        // months / year
        const month = this.generateMonths(this.containerWeeksOfYear);
        this.configureAnnotationMonths(month);

    }

    /**
     * Generate SVG artboard in the HTML DOM.
     * @param {selection} domNode - d3 selection
     * @returns A d3.js selection.
     */
    generateArtboard(domNode) {
        return domNode
            .selectAll("svg")
            .data([{height: this.height, width: this.width}])
            .join(
                enter => enter.append("svg"),
                update => update,
                exit => exit.remove()
            )
            .attr("viewBox", d => `0 0 ${d.width} ${d.height}`)
            .attr("class", this.name);
    }

    /**
     * Generate SVG shapes in the HTML DOM.
     * @param {node} domNode - HTML node
     * @returns A d3.js selection.
     */
    generateCellShapes(domNode) {
        return domNode
            .selectAll(".lgv-cell")
            .data(this.dataCells || [])
            .join(
                enter => enter.append("path"),
                update => update,
                exit => exit.remove()
            );
    }

    /**
     * Generate SVG text elements in the HTML DOM.
     * @param {node} domNode - HTML node
     * @returns A d3.js selection.
     */
    generateDaysOfWeek(domNode) {
        return domNode
            .selectAll(".lgv-annotation-day-of-week")
            .data(this.weekdays ? this.weekdays.map(d => d[0]) : [])
            .join(
                enter => enter.append("text"),
                update => update,
                exit => exit.remove()
            );
    }

    /**
     * Generate SVG text elements in the HTML DOM.
     * @param {node} domNode - HTML node
     * @returns A d3.js selection.
     */
    generateMonths(domNode) {
        return domNode
            .selectAll(".lgv-annotation-month")
            .data(this.months ? this.months : [])
            .join(
                enter => enter.append("text"),
                update => update,
                exit => exit.remove()
            )
    }

    /**
     * Generate top-level logical groupings.
     */
    generateContainers() {

        // days of week container
        this.containerDaysOfWeek = this.artboard
            .selectAll(".lgv-annotation-days-of-week")
            .data(d => [d])
            .join(
                enter => enter.append("g"),
                update => update,
                exit => exit.remove()
            )
            .attr("class", "lgv-annotation-days-of-week")
            .attr("transform", `translate(0,${this.paddingTop + this.artboardUnit})`);

        // month of year container
        this.containerWeeksOfYear = this.artboard
            .selectAll(".lgv-annotation-months-of-year")
            .data(d => [d])
            .join(
                enter => enter.append("g"),
                update => update,
                exit => exit.remove()
            )
            .attr("class", "lgv-annotation-months-of-year")
            .attr("transform", `translate(${this.paddingSide},0)`);

        // calendar content container
        this.containerCalendar = this.artboard
            .selectAll(".lgv-calendar")
            .data(d => [d])
            .join(
                enter => enter.append("g"),
                update => update,
                exit => exit.remove()
            )
            .attr("class", "lgv-calendar")
            .attr("transform", d => `translate(${this.paddingSide},${this.paddingTop})`);

    }

    /**
     * Generate visualization.
     */
    generateVisualization() {

        // condition data
        this.data;

        // determine layout specs
        this.layout;

        // generate svg artboard
        this.artboard = this.generateArtboard(this.container);

        // generate top-level groupings
        this.generateContainers(this.artboard);

        // generate days of week/month-year annotations
        this.generateAnnotations();

        // generate cell shapes
        const cells = this.generateCellShapes(this.containerCalendar);

        // minimally position/style cell shapes
        this.configureCellShapes(cells);

    }

    /**
     * Get ISO days of the week for a given date.
     * @param {currentDate} string - iso 8601 date value
     * @returns An array of strings where each is an iso 8601 date value representing a day in a week.
     */
    isoDaysofWeek(currentDate) {

        // get iso week start/end
        let weekStart = moment(currentDate).startOf("isoWeek");
        let weekEnd = moment(currentDate).add(6, "day");

        let days = [];

        // generate days in between iso start/end of week
        while (weekStart < weekEnd) {
            days.push(weekStart.format("YYYY-MM-DD"));
            weekStart.add(1, "day");
        }

        return days;

    }

    /**
     * Render visualization.
     * @param {node} domNode - HTML node
     */
    render(domNode) {

        // update self
        this.container = select(domNode);

        // generate visualization
        this.generateVisualization();

    }

    /**
     * Update visualization.
     * @param {object} data - key/values where each key is a series label and corresponding value is an array of values
     * @param {integer} height - height of artboard
     * @param {integer} width - width of artboard
     */
    update(data, width, height) {

        // update self
        this.dataSource = data;
        this.height = height;
        this.width = width;

        // generate visualization
        this.generateVisualization();

    }

};

export { ActivityCalendar };
export default ActivityCalendar;
