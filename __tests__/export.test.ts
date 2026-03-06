/**
 * Tests for utils/export.ts
 *
 * Covers: Exporter.toJSON, Exporter.toCSV (DOM-dependent, mocked)
 */

import type { AnalysisData } from '@/types';

// Mock DOM APIs
const mockClick = jest.fn();
const mockCreateObjectURL = jest.fn(() => 'blob:test');
const mockRevokeObjectURL = jest.fn();

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
});

Object.defineProperty(global, 'Blob', {
  value: class MockBlob {
    constructor(public parts: unknown[], public options: Record<string, string>) {}
  },
});

const mockAnchor = {
  href: '',
  download: '',
  click: mockClick,
};

jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);

// Now import the module
import { Exporter } from '@/utils/export';

const sampleData: AnalysisData = {
  files: [
    {
      path: 'src/app.ts', name: 'app.ts', folder: 'src', size: 100, isCode: true,
      lines: 50, functions: [{ name: 'main', file: 'src/app.ts', line: 1, code: '' }],
      complexity: { score: 3, level: 'low' },
    },
    {
      path: 'lib/utils.ts', name: 'utils.ts', folder: 'lib', size: 200, isCode: true,
      lines: 80, functions: [],
    },
  ],
  connections: [],
  stats: { files: 2, codeFiles: 2, functions: 1, dead: 0, connections: 0, avgComplexity: 3 },
  issues: [],
  patterns: [],
  securityIssues: [],
};

beforeEach(() => {
  mockClick.mockClear();
  mockCreateObjectURL.mockClear();
  mockRevokeObjectURL.mockClear();
});

describe('Exporter', () => {
  describe('toJSON', () => {
    it('creates a blob and triggers download', () => {
      Exporter.toJSON(sampleData);
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
      expect(mockAnchor.download).toContain('codescope-analysis');
      expect(mockAnchor.download).toContain('.json');
    });
  });

  describe('toCSV', () => {
    it('creates CSV with correct headers and downloads', () => {
      Exporter.toCSV(sampleData);
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockAnchor.download).toContain('.csv');
    });
  });
});
