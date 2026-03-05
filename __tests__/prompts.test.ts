/**
 * Tests for lib/ai/prompts.ts
 *
 * Covers: DIAGRAM_SYSTEM_PROMPT, DIAGRAM_TYPES, individual prompt constants
 */

import {
  DIAGRAM_SYSTEM_PROMPT,
  DIAGRAM_TYPES,
  ARCHITECTURE_PROMPT,
  LIFECYCLE_PROMPT,
  DATAFLOW_PROMPT,
  LAYERS_PROMPT,
  CALL_GRAPH_PROMPT,
  SCHEMA_PROMPT,
  DEPLOYMENT_PROMPT,
} from '@/lib/ai/prompts';

describe('AI Prompts', () => {
  describe('DIAGRAM_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(typeof DIAGRAM_SYSTEM_PROMPT).toBe('string');
      expect(DIAGRAM_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('mentions Mermaid', () => {
      expect(DIAGRAM_SYSTEM_PROMPT).toContain('Mermaid');
    });

    it('instructs to output valid mermaid code', () => {
      expect(DIAGRAM_SYSTEM_PROMPT).toContain('mermaid');
    });
  });

  describe('prompt constants', () => {
    const prompts = [
      { name: 'ARCHITECTURE_PROMPT', value: ARCHITECTURE_PROMPT },
      { name: 'LIFECYCLE_PROMPT', value: LIFECYCLE_PROMPT },
      { name: 'DATAFLOW_PROMPT', value: DATAFLOW_PROMPT },
      { name: 'LAYERS_PROMPT', value: LAYERS_PROMPT },
      { name: 'CALL_GRAPH_PROMPT', value: CALL_GRAPH_PROMPT },
      { name: 'SCHEMA_PROMPT', value: SCHEMA_PROMPT },
      { name: 'DEPLOYMENT_PROMPT', value: DEPLOYMENT_PROMPT },
    ];

    test.each(prompts)('$name is a non-empty string', ({ value }) => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(10);
    });
  });

  describe('DIAGRAM_TYPES', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(DIAGRAM_TYPES)).toBe(true);
      expect(DIAGRAM_TYPES.length).toBeGreaterThan(0);
    });

    it('each type has required fields', () => {
      for (const type of DIAGRAM_TYPES) {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('label');
        expect(type).toHaveProperty('description');
        expect(type).toHaveProperty('icon');
        expect(type).toHaveProperty('prompt');
        expect(typeof type.id).toBe('string');
        expect(typeof type.label).toBe('string');
        expect(typeof type.prompt).toBe('string');
      }
    });

    it('includes architecture type', () => {
      const arch = DIAGRAM_TYPES.find(t => t.id === 'architecture');
      expect(arch).toBeDefined();
      expect(arch!.prompt).toBe(ARCHITECTURE_PROMPT);
    });

    it('includes lifecycle type', () => {
      const lc = DIAGRAM_TYPES.find(t => t.id === 'lifecycle');
      expect(lc).toBeDefined();
    });

    it('includes dataflow type', () => {
      const df = DIAGRAM_TYPES.find(t => t.id === 'dataflow');
      expect(df).toBeDefined();
    });

    it('has unique ids', () => {
      const ids = DIAGRAM_TYPES.map(t => t.id);
      const unique = new Set(ids);
      expect(ids.length).toBe(unique.size);
    });
  });
});
