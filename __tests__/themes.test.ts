/**
 * Tests for utils/themes/index.ts
 *
 * Covers: theme.getNodeColor, theme.getVisualizationColor
 */

import { theme } from '@/utils/themes';

describe('theme', () => {
  describe('getNodeColor', () => {
    it('returns component color for component paths', () => {
      const color = theme.getNodeColor('components/button.tsx');
      expect(color).toBe(theme.colors.visualization.nodes.component);
    });

    it('returns lib color for lib paths', () => {
      const color = theme.getNodeColor('lib/utils.ts');
      expect(color).toBe(theme.colors.visualization.nodes.lib);
    });

    it('returns lib color for utils paths', () => {
      const color = theme.getNodeColor('utils/helpers.ts');
      expect(color).toBe(theme.colors.visualization.nodes.lib);
    });

    it('returns api color for api paths', () => {
      const color = theme.getNodeColor('api/routes.ts');
      expect(color).toBe(theme.colors.visualization.nodes.api);
    });

    it('returns api color for server paths', () => {
      const color = theme.getNodeColor('server/index.ts');
      expect(color).toBe(theme.colors.visualization.nodes.api);
    });

    it('returns hook color for hook paths', () => {
      const color = theme.getNodeColor('hooks/useAuth.ts');
      expect(color).toBe(theme.colors.visualization.nodes.hook);
    });

    it('returns type color for type paths', () => {
      const color = theme.getNodeColor('types/index.ts');
      expect(color).toBe(theme.colors.visualization.nodes.type);
    });

    it('returns default color for other paths', () => {
      const color = theme.getNodeColor('random/file.ts');
      expect(color).toBe(theme.colors.visualization.nodes.default);
    });
  });

  describe('getVisualizationColor', () => {
    it('returns a color for index 0', () => {
      const color = theme.getVisualizationColor(0);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });

    it('wraps around when index exceeds palette length', () => {
      const paletteLen = theme.colors.visualization.palette.length;
      expect(theme.getVisualizationColor(0)).toBe(theme.getVisualizationColor(paletteLen));
    });

    it('returns different colors for different indices', () => {
      const c0 = theme.getVisualizationColor(0);
      const c1 = theme.getVisualizationColor(1);
      expect(c0).not.toBe(c1);
    });
  });

  describe('colors object', () => {
    it('has visualization palette array', () => {
      expect(Array.isArray(theme.colors.visualization.palette)).toBe(true);
      expect(theme.colors.visualization.palette.length).toBeGreaterThan(0);
    });

    it('has node color mappings', () => {
      expect(theme.colors.visualization.nodes).toBeDefined();
      expect(theme.colors.visualization.nodes.default).toBeDefined();
    });
  });
});
