import { summarise, type SummarisedEvent } from './event-summary';

function bloom(lat: number, lon: number): SummarisedEvent {
  return {
    type: 'plant-bloomed',
    payload: { plantId: `plant-${lat}`, type: 'sunflower', lat, lon },
  };
}

function event(type: string, payload: Record<string, unknown> = {}) {
  return { type, payload };
}

describe('summarise', () => {
  it('lists 3 blooms and 1 arrival as two lines in that order, focused on the latest bloom', () => {
    const lines = summarise([
      bloom(10, 20),
      event('creature-arrived', { creatureId: 'c-1', lat: -5, lon: 90 }),
      bloom(11, 21),
      bloom(12, 22),
    ]);

    expect(lines).toEqual([
      {
        kind: 'blooms',
        count: 3,
        text: '3 plants bloomed',
        focus: { lat: 12, lon: 22 },
      },
      {
        kind: 'creatures',
        count: 1,
        text: '1 new creature',
        focus: { lat: -5, lon: 90 },
      },
    ]);
  });

  it('gives [] for no events (TIM-03 AC2)', () => {
    expect(summarise([])).toEqual([]);
  });

  it('ignores types that are not news, such as stage changes', () => {
    expect(
      summarise([
        event('plant-stage', { stage: 'sprout' }),
        event('something-new', { lat: 1, lon: 2 }),
      ]),
    ).toEqual([]);
    expect(summarise([event('plant-stage'), bloom(1, 2)])).toEqual([
      {
        kind: 'blooms',
        count: 1,
        text: '1 plant bloomed',
        focus: { lat: 1, lon: 2 },
      },
    ]);
  });

  it('orders blooms, creatures, wants, gifts whatever order they happened in', () => {
    const lines = summarise([
      event('gift-received'),
      event('want-fulfilled'),
      event('creature-arrived'),
      bloom(0, 0),
    ]);

    expect(lines.map((line) => line.kind)).toEqual([
      'blooms',
      'creatures',
      'wants',
      'gifts',
    ]);
  });

  it('words one and many of each kind', () => {
    const twice = (type: string) => [event(type), event(type)];

    expect(
      summarise([
        event('creature-arrived'),
        event('want-fulfilled'),
        event('gift-received'),
      ]).map((line) => line.text),
    ).toEqual(['1 new creature', '1 wish came true', '1 gift waiting']);
    expect(
      summarise([
        ...twice('creature-arrived'),
        ...twice('want-fulfilled'),
        ...twice('gift-received'),
      ]).map((line) => [line.count, line.text]),
    ).toEqual([
      [2, '2 new creatures'],
      [2, '2 wishes came true'],
      [2, '2 gifts waiting'],
    ]);
  });

  it('leaves out the focus when no event of the kind has a position', () => {
    const [line] = summarise([
      event('creature-arrived', { creatureId: 'c-1' }),
    ]);

    expect(line).toEqual({
      kind: 'creatures',
      count: 1,
      text: '1 new creature',
    });
  });

  it('focuses on the latest event of the kind that has a position', () => {
    const [line] = summarise([
      event('creature-arrived', { lat: 3, lon: 4 }),
      event('creature-arrived', { creatureId: 'no position yet' }),
    ]);

    expect(line.focus).toEqual({ lat: 3, lon: 4 });
  });
});
