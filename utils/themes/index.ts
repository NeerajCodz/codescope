import colors from './colors.json';

export const theme = {
  colors,
  getNodeColor: (path: string): string => {
    if (path.includes('components')) return colors.visualization.nodes.component;
    if (path.includes('lib') || path.includes('utils')) return colors.visualization.nodes.lib;
    if (path.includes('api') || path.includes('server')) return colors.visualization.nodes.api;
    if (path.includes('hook')) return colors.visualization.nodes.hook;
    if (path.includes('type')) return colors.visualization.nodes.type;
    return colors.visualization.nodes.default;
  },
  getVisualizationColor: (index: number): string => {
    return colors.visualization.palette[index % colors.visualization.palette.length];
  }
};

export default theme;
