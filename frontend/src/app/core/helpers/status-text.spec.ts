import {
  LIGHT_PREF_TEXT,
  LIGHT_TEXT,
  MOOD_TEXT,
  NO_WISH_TEXT,
  SEEDS_READY_TEXT,
  STAGE_TEXT,
  StatusText,
  WATER_PREF_TEXT,
  WATER_TEXT,
  WISTFUL_TEXT,
  lightText,
  moodText,
  needsText,
  stageText,
  statusLine,
  waterText,
} from './status-text';

describe('statusText', () => {
  const tables: [string, Record<string, StatusText>][] = [
    ['water', WATER_TEXT],
    ['light', LIGHT_TEXT],
    ['stage', STAGE_TEXT],
    ['seeds ready', { ready: SEEDS_READY_TEXT }],
    ['water preference', WATER_PREF_TEXT],
    ['light preference', LIGHT_PREF_TEXT],
    ['mood', { ...MOOD_TEXT, wistful: WISTFUL_TEXT }],
    ['want', { none: NO_WISH_TEXT }],
  ];
  const entries = tables.flatMap(([table, rows]) =>
    Object.entries(rows).map(([key, status]) => ({ table, key, status })),
  );

  it.each(entries)(
    '$table "$key" has an icon and words, never colour alone (SET-04)',
    ({ status }) => {
      expect(status.icon.trim()).not.toBe('');
      expect(status.text.trim()).not.toBe('');
    },
  );

  it('gives each status within a table its own icon', () => {
    for (const rows of [
      WATER_TEXT,
      LIGHT_TEXT,
      { ...STAGE_TEXT, ready: SEEDS_READY_TEXT },
      { ...MOOD_TEXT, wistful: WISTFUL_TEXT },
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
