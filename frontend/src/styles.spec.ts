import styles from './styles.scss' with { loader: 'text' };

/** WCAG 2.1 AA minimums: 1.4.3 for text, 1.4.11 for focus rings, control borders and icons. */
const TEXT = 4.5;
const NON_TEXT = 3;

/**
 * Each pair of colour tokens the 2D interface puts together, with the stricter minimum it
 * needs and where it is used. Icons are drawn in the colour of the words beside them, so the
 * text pairs cover them. The border token only edges cards and panels, never a control on its
 * own (inputs and inventory items are edged with the muted text colour), so it is not here.
 */
const PAIRS: [fg: string, bg: string, min: number, use: string][] = [
  ['fg', 'bg', TEXT, 'page text, creature chat lines, the thank-you bubble'],
  ['fg', 'surface', TEXT, 'text and status icons on cards and panels'],
  ['fg', 'sky-top', TEXT, 'loading text over the sky'],
  ['fg', 'sky-bottom', TEXT, 'journal pages, loading text over the sky'],
  ['fg-muted', 'bg', TEXT, 'hints on the create-planet page, the planet-code input border'],
  ['fg-muted', 'surface', TEXT, 'hints, labels, counts; borders of inputs and inventory items'],
  ['fg-muted', 'sky-bottom', TEXT, 'the journal page kicker'],
  ['accent', 'bg', TEXT, 'the planet-code disclosure; the focus ring on the page'],
  ['accent', 'surface', TEXT, 'secondary buttons, milestones; focus ring, selection, cursor ring'],
  ['accent', 'sky-top', NON_TEXT, "the focus ring and Pip's outline on the planet view"],
  ['accent', 'sky-bottom', NON_TEXT, 'the focus ring on journal pages'],
  ['danger-fg', 'bg', TEXT, 'errors on the create-planet page'],
  ['danger-fg', 'surface', TEXT, 'errors and refused spots on cards'],
  ['surface', 'accent', TEXT, 'primary buttons, your chat lines, the "Here!" label'],
  ['surface', 'danger-fg', TEXT, 'danger buttons'],
];

/** The hex colour tokens on :root in styles.scss, by name without the leading dashes. */
function colourTokens(css: string): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  return Object.fromEntries(
    [...root.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, name, hex]) => [name, hex]),
  );
}

/** Relative luminance of an sRGB colour such as "#1f2933" (WCAG 2.1 definition). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('colour tokens (NFR-05)', () => {
  const colours = colourTokens(styles);

  it('works out contrast the WCAG way', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#777777')).toBeCloseTo(4.48, 2);
  });

  it('reads every colour token the pairs use from styles.scss', () => {
    const used = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]));
    expect(Object.keys(colours)).toEqual(expect.arrayContaining([...used]));
  });

  it.each(PAIRS)('%s on %s reaches %s:1 (%s)', (fg, bg, min) => {
    expect(contrast(colours[fg], colours[bg])).toBeGreaterThanOrEqual(min);
  });
});
