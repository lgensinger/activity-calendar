import test from "ava";
import moment from "moment";

import { configuration, configurationDimension } from "../src/configuration.js";
import { ActivityCalendar } from "../src/index.js";

let testData = [
    {date: "2020-01-01", type: "abc", value: 1},
    {date: "2020-01-02", type: "def", value: 3}
];

/******************** EMPTY VARIABLES ********************/

// initialize
const ac = new ActivityCalendar();

// TEST INIT //
test("init", t => {

    t.true(ac.height === configurationDimension.height);
    t.true(ac.width === configurationDimension.width);

});

// TEST get DATA //
test("get_data", t => {

    // data formatting
    ac.data;

    t.true(typeof(ac.dataAggregateDays) == "object");
    t.true(typeof(ac.dataCells) == "object");
    t.true(typeof(ac.months) == "object");
    t.true(typeof(ac.weekIndicies) == "object");
    t.true(typeof(ac.weekdays) == "object");

});

// TEST get LAYOUT //
test("get_layout", t => {

    // layout formatting
    ac.layout;

    t.true(typeof(ac.height) == "number");
    t.true(typeof(ac.width) == "number");

});

// TEST CONSTRUCTTHRESHOLD //
test("constructThreshold", t => {

    // style formatting
    let result = ac.constructThreshold();

    t.true(typeof(result) == "function");

});

// TEST EXTRACTACTIVITY //
test("extractActivity", t => {

    // pull node label from id
    let result = ac.extractActivity(testData[0].type);

    t.true(typeof(result) == "object");

});

// TEST RENDER //
test("render", t => {

    // clear document
    document.body.innerHTML = "";

    // render to dom
    ac.render(document.body);

    // get generated element
    let artboard = document.querySelector(`.${configuration.name}`);

    t.true(artboard !== undefined);
    t.true(artboard.nodeName == "svg");
    t.true(artboard.getAttribute("viewBox").split(" ")[3] == ac.height);
    t.true(artboard.getAttribute("viewBox").split(" ")[2] == ac.width);

});

/******************** DECLARED PARAMS ********************/

let testWidth = 300;
let testHeight = 500;

// initialize
const acp = new ActivityCalendar(
    testData,
    moment().format("YYYY-MM-DD"),
    moment(moment().format("YYYY-MM-DD")).add(5, "days"),
    testWidth,
    testHeight
);

// TEST INIT //
test("init_params", t => {

    t.true(acp.height === testHeight);
    t.true(acp.width === testWidth);

});

// TEST get DATA //
test("get_data_params", t => {

    // data formatting
    acp.data;

    t.true(typeof(acp.dataAggregateDays) == "object");
    t.true(typeof(acp.dataCells) == "object");
    t.true(typeof(acp.months) == "object");
    t.true(typeof(acp.weekIndicies) == "object");
    t.true(typeof(acp.weekdays) == "object");

});

// TEST get LAYOUT //
test("get_layout_params", t => {

    // layout formatting
    acp.layout;

    t.true(typeof(acp.height) == "number");
    t.true(typeof(acp.width) == "number");

});

// TEST CONSTRUCTTHRESHOLD //
test("constructThreshold_params", t => {

    // style formatting
    let result = acp.constructThreshold();

    t.true(typeof(result) == "function");

});

// TEST EXTRACTACTIVITY //
test("extractActivity_params", t => {

    // pull node label from id
    let result = acp.extractActivity(testData[0].type);

    t.true(typeof(result) == "object");

});

// TEST RENDER //
test("render_params", t => {

    // clear document
    document.body.innerHTML = "";

    // render to dom
    acp.render(document.body);

    // get generated element
    let artboard = document.querySelector(`.${configuration.name}`);

    t.true(artboard !== undefined);
    t.true(artboard.nodeName == "svg");
    t.true(artboard.getAttribute("viewBox").split(" ")[3] == acp.height);
    t.true(artboard.getAttribute("viewBox").split(" ")[2] == acp.width);

});
