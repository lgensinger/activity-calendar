import { groups, rollup } from "d3-array";
import { path } from "d3-path";
import { scaleQuantile } from "d3-scale";
import { select } from "d3-selection";
import moment from "moment";

import { configurationDimension, configurationLayout } from "../configuration.js";

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
        this.cellSize = cellSize;
        this.dataAggregateDays = null;
        this.dataSource = data;
        this.dateEnd = dateEnd;
        this.dateStart = dateStart;
        this.height = height;
        this.months = null;
        this.paddingDaysOfWeek = null;
        this.paddingMonthsOfYear = null;
        this.weekdays = null;
        this.weekIndicies = null;
        this.width = width;

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

        }

    }

    /**
     * Construct layout.
     * @returns A d3 pack layout function.
     */
    get layout() {

        this.paddingDaysOfWeek = this.cellSize * 2;
        this.paddingMonthsOfYear = this.cellSize;
        let weeks = moment(this.dateEnd).diff(moment(this.dateStart), "week");

        this.height = (this.cellSize * 7) + this.paddingMonthsOfYear;
        this.width = this.cellSize * weeks + this.paddingDaysOfWeek;

    }

    /**
     * Construct color.
     * @param {integer} d - datum
     * @param {integer} index - Index of activity type
     * @returns A d3 color function.
     */
    constructColor(index) {

        let result = function() { return "black" };

        let indexIsOdd = index % 2;
        let values = [];

        // check for valid range data
        if (this.dataAggregateDays) {

            if (indexIsOdd) {

                // build values
                values = Array.from(this.dataAggregateDays)
                    .map(d => Array.from(d[1]))
                    .flat()
                    .filter((d,i) => i % 2)
                    .map(d => d[1]);

            } else {

                // build values
                values = Array.from(this.dataAggregateDays)
                    .map(d => Array.from(d[1]))
                    .flat()
                    .filter((d,i) => i % 2 - 1)
                    .map(d => d[1]);

            }

            result = scaleQuantile()
                .domain(values)
                .range(indexIsOdd ? ["#cee9f5", "#34b6ed", "#0070a1"] : ["#fce9cc", "#eda12f", "#995e06"]);

            }

        return result;

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

        return result;

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
        let artboard = select(domNode)
            .append("svg")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .attr("class", "lgv-activity-calendar");

        // calendar content group
        const artwork = artboard.append("g")
            .attr("transform", (d, i) => `translate(${this.paddingDaysOfWeek},${this.paddingMonthsOfYear})`);

        // days of week
        artwork.append("g")
            .attr("text-anchor", "end")
            .selectAll("text")
            .data(this.weekdays ? this.weekdays.map(d => d[0]) : [])
            .join("text")
            .attr("x", -5)
            .attr("y", (d, i) => (i * this.cellSize) + (this.cellSize * 0.8))
            .text(d => d);

        // loop through keys
        for (const i in this.activityTypes) {

            let key = this.activityTypes[i];

            // activity cell
            artwork.selectAll(`.lgv-${key}`)
                .data(this.extractActivity(key))
                .join("path")
                .attr("class", `lgv-${key}`)
                .attr("d", d => {

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
                .attr("fill", d => this.constructColor(i)(d[1]));

        }

        // group for months
        const month = artwork.append("g")
            .selectAll("g")
            .data(this.months ? this.months : [])
            .join("g");

        // month labels
        month.append("text")
            .attr("x", d => this.weekIndicies.indexOf(moment(d).isoWeek()) * this.cellSize)
            .attr("y", -5)
            .text((d,i) => i == 0 ? `${moment(d).format("MMM")} ${moment(d).format("YYYY")}` : (moment(d).format("M") == 1 ? `${moment(d).format("MMM")} ${moment(d).format("YYYY")}` : moment(d).format("MMM")));

    }

};

export { ActivityCalendar };
export default ActivityCalendar;
