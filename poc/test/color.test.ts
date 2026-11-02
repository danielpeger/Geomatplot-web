import { describe, expect, it } from 'vitest';
import { parseColor } from '../src/api/style.ts';

function expectRgba(input: string, expected: [number, number, number, number], digits = 3): void {
  const actual = parseColor(input);
  expect(actual).toHaveLength(4);
  actual.forEach((channel, i) => expect(channel, `${input} channel ${i}`).toBeCloseTo(expected[i]!, digits));
}

describe('parseColor', () => {
  it('parses named colours, case-insensitively', () => {
    expectRgba('red', [1, 0, 0, 1]);
    expectRgba('RebeccaPurple', [0x66 / 255, 0x33 / 255, 0x99 / 255, 1]);
    expectRgba('  orange ', [1, 0xa5 / 255, 0, 1]);
  });

  it('parses hex in all four lengths', () => {
    expectRgba('#f00', [1, 0, 0, 1]);
    expectRgba('#0f08', [0, 1, 0, 0x88 / 255]);
    expectRgba('#0072bd', [0, 0x72 / 255, 0xbd / 255, 1]);
    expectRgba('#11223380', [0x11 / 255, 0x22 / 255, 0x33 / 255, 0x80 / 255]);
  });

  it('parses rgb() in comma and space syntax, with alpha', () => {
    expectRgba('rgb(255, 0, 0)', [1, 0, 0, 1]);
    expectRgba('rgba(0, 0, 255, 0.5)', [0, 0, 1, 0.5]);
    expectRgba('rgb(0 128 0 / 25%)', [0, 128 / 255, 0, 0.25]);
  });

  it('parses hsl() in comma and space syntax, with alpha', () => {
    expectRgba('hsl(120, 100%, 50%)', [0, 1, 0, 1]);
    expectRgba('hsla(240, 100%, 50%, 0.3)', [0, 0, 1, 0.3]);
    expectRgba('hsl(0 100% 50% / 0.75)', [1, 0, 0, 0.75]);
  });

  it('parses hwb()', () => {
    expectRgba('hwb(0 0% 0%)', [1, 0, 0, 1]);
    expectRgba('hwb(240 0% 0% / 0.5)', [0, 0, 1, 0.5]);
  });

  it('parses oklch() and lab()', () => {
    expectRgba('oklch(62.8% 0.2577 29.23)', [1, 0, 0, 1], 2);
    expectRgba('oklch(1 0 0)', [1, 1, 1, 1]);
    expectRgba('lab(0% 0 0)', [0, 0, 0, 1]);
    expectRgba('lab(54.29% 80.8 69.89 / 0.5)', [1, 0, 0, 0.5], 2);
  });

  it('parses color(display-p3 ...) and clamps out-of-gamut values to sRGB', () => {
    expectRgba('color(display-p3 1 1 1)', [1, 1, 1, 1]);
    expectRgba('color(display-p3 1 0 0)', [1, 0, 0, 1], 2);
    for (const channel of parseColor('color(display-p3 0 1 0 / 0.4)')) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it('parses transparent', () => {
    expect(parseColor('transparent')).toEqual([0, 0, 0, 0]);
  });

  it('throws a clear error for invalid input', () => {
    for (const bad of ['', 'notacolor', '#12', '#12345', 'rgb(1, 2)', 'hsl(red)', 'color(rec2020 1 0 0)']) {
      expect(() => parseColor(bad), bad).toThrow(`Unknown colour: "${bad}"`);
    }
  });
});
