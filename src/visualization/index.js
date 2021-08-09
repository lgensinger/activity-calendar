import { extent, groups, rollup } from "d3-array";
import { path } from "d3-path";
import { scaleQuantize } from "d3-scale";
import { select } from "d3-selection";
import moment from "moment";

import { configuration, configurationDimension, configurationLayout } from "../configuration.js";

/**
 * ActivityCalendar is a time series visualization.
 * @param {array} data - objects where each represents a path in the hierarchy
 * @param {string} dateEnd - iso 8601 date value
 * @param {string} dateStart - iso 8601 date value
 * @param {integer} height - artboard height
 * @param {integer} width - artboard width
 */
class ActivityCalendar {
    constructor(data, dateStart, dateEnd, width=configurationDimension.width, height=configurationDimension.height, cellSize=configurationLayout.cellSize) {

        // update self
        this.activityTypes = data ? Object.keys(data) : [];
        this.artboard = null;
        this.cellSize = cellSize;
        this.dataAggregateDays = null;
        this.dataCells = null;
        this.dataSource = data;
        this.dateEnd = dateEnd;
        this.dateStart = dateStart;
        this.height = height;
        this.months = null;
        this.name = configuration.name;
        this.paddingDaysOfWeek = null;
        this.paddingMonthsOfYear = null;
        this.weekdays = null;
        this.weekIndicies = null;
        this.width = width;

        // using font size as the base unit of measure make responsiveness easier to manage across devices
        this.artboardUnit = typeof window === "undefined" ? 16 : parseFloat(getComputedStyle(document.body).fontSize);

    }

    /**
     * Condition data for visualization requirements.
     * @returns A xx.
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

            // nest data by year and iso week
            let nestByYearWeek = groups(this.dataAggregateDays,
                d => moment(d[0]).format("YYYY"),
                d => moment(d[0]).isoWeek()
            );

            // sort years/weeks
            let nestByYearWeekSorted = nestByYearWeek.map(y => [y[0], y[1].sort((a, b) => a[0] - b[0])]).sort((a, b) => a[0] - b[0]);

            // because the time range may/may not be an entire year
            // we need to map index to iso week so we can reference the position later
            this.weekIndicies = nestByYearWeekSorted.map(d => d[1]).flat().map(d => d[0]);

            let dateEnd = moment(this.dateEnd);
            let dateStart = moment(this.dateStart);

            // get weekday values
            let weekdays = moment.weekdays();

            // shift so monday is the first day of the week
            weekdays.push(weekdays.shift());

            // update self
            this.weekdays = weekdays;

            let months = [];

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

        this.paddingDaysOfWeek = this.cellSize;
        this.paddingMonthsOfYear = this.cellSize;
        let weeks = moment(this.dateEnd).diff(moment(this.dateStart), "week");

        this.height = (this.cellSize * 7) + this.paddingMonthsOfYear;
        this.width = this.cellSize * weeks + this.paddingDaysOfWeek;

    }

    /**
     * Position and minimally style days of week in SVG dom element.
     * @param {node} domNode - d3.js SVG selection
     */
    configureAnnotationDaysOfWeek(domNode) {
        domNode
            .attr("class", "lgv-annotation-day-of-week")
            .attr("x", -5)
            .attr("y", (d, i) => (i * this.cellSize) + (this.cellSize * (this.artboardUnit * 0.048)))
            .text(d => d);
    }

    /**
     * Position and minimally style months in SVG dom element.
     * @param {node} domNode - d3.js SVG selection
     */
    configureAnnotationMonths(domNode) {
        domNode.append("text")
            .attr("class", "lgv-annotation-month")
            .attr("x", d => this.weekIndicies.indexOf(moment(d).isoWeek()) * this.cellSize)
            .attr("y", -5)
            .each((d, i, nodes) => {
                select(nodes[i])
                    .selectAll("tspan")
                    .data(i == 0 ? [moment(d).format("MMM"), moment(d).format("YYYY")] : (moment(d).format("M") == 1 ? [moment(d).format("MMM"), moment(d).format("YYYY")] : [moment(d).format("MMM")])
                    )
                    .enter()
                    .append("tspan")
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

                let i = this.activityTypes.indexOf(d[2]);
                let left = this.weekIndicies.indexOf(moment(d[0]).isoWeek()) * this.cellSize;
                let top = (moment(d[0]).isoWeekday() * this.cellSize) - this.cellSize;

                let right = left + (this.cellSize - 1);
                let bottom = top + (this.cellSize - 1);

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
                        xy: [e.clientX + this.cellSize, e.clientY + this.cellSize]
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
     * @param {node} domNode - d3.js SVG selection
     */
    generateAnnotations(domNode) {

        // days of week
        const daysOfWeek = this.generateDaysOfWeek(domNode);
        this.configureAnnotationDaysOfWeek(daysOfWeek);

        // months / year
        const month = this.generateMonths(domNode);
        this.configureAnnotationMonths(month);

    }

    /**
     * Generate SVG artboard in the HTML DOM.
     * @param {node} domNode - HTML node
     * @returns A d3.js selection.
     */
    generateArtboard(domNode) {
        return select(domNode)
            .append("svg")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .attr("class", this.name);
    }

    /**
     * Generate SVG shapes in the HTML DOM.
     * @param {node} domNode - HTML node
     * @returns A d3.js selection.
     */
    generateCellShapes(domNode) {
        return domNode.selectAll(".lgv-cell")
            .data(this.dataCells || [])
            .join("path");
    }

    /**
     * Generate SVG text elements in the HTML DOM.
     * @param {node} domNode - HTML node
     * @returns A d3.js selection.
     */
    generateDaysOfWeek(domNode) {
        return domNode.append("g")
            .selectAll("text")
            .data(this.weekdays ? this.weekdays.map(d => d[0]) : [])
            .join("text");
    }

    /**
     * Generate SVG text elements in the HTML DOM.
     * @param {node} domNode - HTML node
     * @returns A d3.js selection.
     */
    generateMonths(domNode) {
        return domNode.append("g")
            .selectAll("g")
            .data(this.months ? this.months : [])
            .join("g");
    }

    /**
     * Render visualization.
     * @param {node} domNode - HTML node
     */
    render(domNode) {

        // determine layout specs
        this.layout;

        // condition data
        this.data;

        // generate svg artboard
        this.artboard = this.generateArtboard(domNode);

        // calendar content group
        const artwork = this.artboard
            .append("g")
            .attr("transform", d => `translate(${this.paddingDaysOfWeek},${this.paddingMonthsOfYear})`);

        // generate days of week/month-year annotations
        this.generateAnnotations(artwork);

        // generate cell shapes
        const cells = this.generateCellShapes(artwork);

        // minimally position/style cell shapes
        this.configureCellShapes(cells);

    }

};

export { ActivityCalendar };
export default ActivityCalendar;
