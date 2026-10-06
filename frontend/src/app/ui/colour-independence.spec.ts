import { PlacementReason } from '../core/helpers/placement-rules';
import { PLACEMENT_STATUS } from './placement-hud/placement-hud.component';
import { cloudStatus } from './sky-list/sky-list.component';

/**
 * The statuses kept outside the status-text tables have words and an icon of their own too,
 * never colour alone (SET-04). The placement HUD and sky list specs check both are drawn.
 */
describe('statuses beyond the status-text tables (SET-04)', () => {
  it.each(Object.entries(PLACEMENT_STATUS))(
    'the placement verdict "%s" has an icon and words',
    (_reason, { text, icon }) => {
      expect(icon.trim()).not.toBe('');
      expect(text.trim()).not.toBe('');
    },
  );

  it('tells an allowed spot from each kind of refused one by its icon', () => {
    const icon = (reason: PlacementReason) => PLACEMENT_STATUS[reason].icon;
    const refused: PlacementReason[] = ['occupied-plant', 'occupied-water', 'planet-full'];

    expect(new Set([icon('ok'), ...refused.map(icon)]).size).toBe(4);
    // Either way the spot is taken, so the plant and the decoration share their status.
    expect(PLACEMENT_STATUS['occupied-decoration']).toEqual(PLACEMENT_STATUS['occupied-plant']);
  });

  it("puts each cloud's water in words, each with its own icon", () => {
    const states = [
      cloudStatus(1, true),
      cloudStatus(1, false),
      cloudStatus(0.5, false),
      cloudStatus(0.25, false),
      cloudStatus(0, false),
    ];

    expect(states.map(({ text }) => text)).toEqual([
      'raining',
      'full',
      'half full',
      'low',
      'empty',
    ]);
    expect(new Set(states.map(({ icon }) => icon)).size).toBe(states.length);
  });
});
