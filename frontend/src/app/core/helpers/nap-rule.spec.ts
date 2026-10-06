import { NAP_LIGHT, isNapping } from './nap-rule';
import { lightAt } from './sun-model';

describe('isNapping (NAV-04 AC2)', () => {
  it('naps in the dark and wakes once the light reaches NAP_LIGHT', () => {
    expect(isNapping(0)).toBe(true);
    expect(isNapping(NAP_LIGHT - 0.01)).toBe(true);
    expect(isNapping(NAP_LIGHT)).toBe(false);
    expect(isNapping(1)).toBe(false);
  });

  it('naps on the night side and is awake under the sun', () => {
    const spot = { lat: 0, lon: 0 };

    expect(isNapping(lightAt(spot, 0))).toBe(false);
    expect(isNapping(lightAt(spot, 180))).toBe(true);
  });
});
