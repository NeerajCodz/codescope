/**
 * Tests for lib/utils.ts
 *
 * Covers: cn (className merger utility)
 */

import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    // tailwind-merge resolves conflicts: last wins
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('handles undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles empty string', () => {
    expect(cn('')).toBe('');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles objects (clsx-style)', () => {
    expect(cn({ hidden: true, visible: false })).toBe('hidden');
  });

  it('merges Tailwind variants correctly', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('preserves non-conflicting classes', () => {
    const result = cn('bg-red-500', 'text-white', 'p-4');
    expect(result).toContain('bg-red-500');
    expect(result).toContain('text-white');
    expect(result).toContain('p-4');
  });
});
