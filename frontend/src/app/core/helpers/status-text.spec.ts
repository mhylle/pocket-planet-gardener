import {
  LIGHT_TEXT,
  MOOD_TEXT,
  NAPPING_TEXT,
  NO_WISH_TEXT,
  SEEDS_READY_TEXT,
  STAGE_TEXT,
  StatusText,
  WATER_TEXT,
  WISTFUL_TEXT,
  lightText,
  moodText,
  needsText,
  stageText,
  statusLine,
  waterText,
} from './status-text';
import * as statusText from './status-text';

const isStatus = (value: unknown): value is StatusText =>
  typeof value === 'object' && value !== null && 'icon' in value && 'text' in value;

describe('statusText', () => {
  // Every table and single status the module exports, found by shape, so a new one is checked
  // without being listed here.
  const exported = Object.entries(statusText).filter(([, value]) => typeof value === 'object');
  const entries = exported.flatMap(([table, value]) =>
    isStatus(value)
      ? [{ table, key: 'the status', status: value }]
      : Object.entries(value as Record<string, unknown>).map(([key, status]) => ({
          table,
          key,
          status,
        })),
  );

  it('finds every table and single status, and nothing that is not a status', () => {
    expect(exported.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'WATER_TEXT',
        'LIGHT_TEXT',
        'STAGE_TEXT',
        'SEEDS_READY_TEXT',
        'WATER_PREF_TEXT',
        'LIGHT_PREF_TEXT',
        'MOOD_TEXT',
        'WISTFUL_TEXT',
        'NAPPING_TEXT',
        'NO_WISH_TEXT',
      ]),
    );
    expect(entries.every(({ status }) => isStatus(status))).toBe(true);
  });

  it.each(entries)(
    '$table $key has an icon and words, never colour alone (SET-04)',
    ({ status }) => {
      const { icon, text } = status as StatusText;
      expect(icon.trim()).not.toBe('');
      expect(text.trim()).not.toBe('');
    },
  );

  it('gives each status within a table its own icon', () => {
    for (const rows of [
      WATER_TEXT,
      LIGHT_TEXT,
      { ...STAGE_TEXT, ready: SEEDS_READY_TEXT },
      // Every status a creature card can show.
      { ...MOOD_TEXT, wistful: WISTFUL_TEXT, napping: NAPPING_TEXT, wish: NO_WISH_TEXT },
    ]) {
      const icons = Object.values(rows).map(({ icon }) => icon);
      expect(new Set(icons).size).toBe(icons.length);
    }
  });

  it('suggests what to do for every unmet need, and nothing when all is well (GRD-04 AC2)', () => {
    expect(statusLine(waterText('thirsty'))).toBe('Thirsty — hold a cloud over it');
    expect(statusLine(waterText('a-bit-thirsty'))).toBe('A bit thirsty — a little rain would help');
    expect(statusLine(waterText('happy'))).toBe('Happy');
    expect(statusLine(waterText('soggy'))).toBe('Soggy — let it dry out');
    expect(statusLine(lightText('too-sunny'))).toBe('A bit too sunny — move the sun away');
    expect(statusLine(lightText('too-dark'))).toBe('A bit too dark — drag the sun over it');
    expect(statusLine(lightText('ok'))).toBe('Just the right light');
  });

  it('names the stage, and seeds that are ready on a bloom (GRD-08 AC1)', () => {
    expect(
      ['seed', 'sprout', 'young', 'bloom'].map((stage) => stageText(stage as never, false).text),
    ).toEqual(['Seed', 'Sprout', 'Young', 'In bloom']);
    expect(statusLine(stageText('bloom', true))).toBe(
      'In bloom, seeds ready — tap it to collect them',
    );
    // Only a bloom has seeds to collect.
    expect(stageText('young', true).text).toBe('Young');
  });

  it("puts a plant type's needs in words, water first (ITM-03 AC2)", () => {
    expect(needsText({ waterPref: 'high', lightPref: 'shade' }).map(({ text }) => text)).toEqual([
      'Likes lots of water',
      'Likes the shade',
    ]);
  });

  it("names a creature's mood, and shows wistful as a variant of content (CRT-04)", () => {
    expect(moodText('content', false).text).toBe('Content');
    expect(moodText('cheerful', false).text).toBe('Cheerful');
    expect(moodText('overjoyed', false).text).toBe('Overjoyed');
    expect(moodText('content', true).text).toBe('A bit wistful');
  });
});
