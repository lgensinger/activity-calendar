import { name } from "../package.json";

const configuration = {
    name: name.replace("/", "-").slice(1)
};

const configurationDimension = {
    height: process.env.DIMENSION_HEIGHT || 600,
    width: process.env.DIMENSION_WIDTH || 600
}

const configurationLayout = {
    cellSize: process.env.LAYOUT_CELL_SIZE || 10
}

export { configuration, configurationDimension, configurationLayout };
export default configuration;
