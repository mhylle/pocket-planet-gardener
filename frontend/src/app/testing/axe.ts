import axe from 'axe-core';

/** The WCAG 2.1 level A and AA rules (NFR-05). */
export const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * A stand-in 2D canvas for the one thing these rules draw text for: telling an icon-font
 * ligature from words (label-content-name-mismatch). jsdom has no canvas, and this app draws
 * its icons as SVG with no icon font, so every run of text measures as plain words.
 */
const PLAIN_TEXT_CANVAS = {
  canvas: {},
  measureText: (text: string) => ({ width: text.length * 30 }),
  fillText: () => undefined,
  clearRect: () => undefined,
  getImageData: (_x: number, _y: number, width: number, height: number) => ({
    data: new Uint8ClampedArray(Math.ceil(width) * Math.ceil(height) * 4).fill(255),
  }),
};

/**
 * Runs axe with the WCAG 2.1 A and AA rules over a rendered element, and returns each failure
 * as "rule: element", so a spec that expects none says what is wrong where.
 *
 * jsdom lays nothing out and computes no colours, so the color-contrast rule is switched off
 * here, and only here. The token contrast spec (src/styles.spec.ts) checks contrast instead.
 */
export async function axeViolations(element: Element): Promise<string[]> {
  const getContext = HTMLCanvasElement.prototype.getContext;
  const plainText = (() => PLAIN_TEXT_CANVAS) as unknown as typeof getContext;
  HTMLCanvasElement.prototype.getContext = plainText;
  try {
    const results = await axe.run(element, {
      runOnly: { type: 'tag', values: WCAG_AA_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    return results.violations.flatMap(({ id, nodes }) =>
      nodes.map(({ target }) => `${id}: ${target.join(' ')}`),
    );
  } finally {
    HTMLCanvasElement.prototype.getContext = getContext;
  }
}
