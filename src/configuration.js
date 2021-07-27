const configuration = {};

const configurationDimension = {
    height: process.env.DIMENSION_HEIGHT || 600,
    width: process.env.DIMENSION_WIDTH || 600
}

const configurationLayout = {
    cellSize: process.env.LAYOUT_CELL_SIZE || 10
}

export { configuration, configurationDimension, configurationLayout };
export default configuration;
