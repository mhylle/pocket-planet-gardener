/** The kinds of news a welcome-back summary reports, in the order it lists them. */
export type SummaryKind = 'blooms' | 'creatures' | 'wants' | 'gifts';

/** A point on the surface to turn the camera to, in degrees. */
export interface SummaryFocus {
  lat: number;
  lon: number;
}

/** One line of the welcome-back summary, such as "3 plants bloomed". */
export interface SummaryLine {
  kind: SummaryKind;
  count: number;
  text: string;
  // Where the latest of these happened, when the events say (TIM-03 AC3).
  focus?: SummaryFocus;
}

/** The part of a logged event the summary reads. */
export interface SummarisedEvent {
  type: string;
  payload: Record<string, unknown>;
}

/** Each kind with the event type it counts and its wording for one and many. */
const KINDS: readonly {
  kind: SummaryKind;
  type: string;
  one: string;
  many: string;
}[] = [
  {
    kind: 'blooms',
    type: 'plant-bloomed',
    one: 'plant bloomed',
    many: 'plants bloomed',
  },
  {
    kind: 'creatures',
    type: 'creature-arrived',
    one: 'new creature',
    many: 'new creatures',
  },
  {
    kind: 'wants',
    type: 'want-fulfilled',
    one: 'wish came true',
    many: 'wishes came true',
  },
  {
    kind: 'gifts',
    type: 'gift-received',
    one: 'gift waiting',
    many: 'gifts waiting',
  },
];

/**
 * The factual welcome-back list for some events, oldest first (TIM-03 AC1):
 * one line per kind that happened, in KINDS order. Other event types, such
 * as stage changes, are not news and are left out, so nothing worth saying
 * gives [] (AC2).
 */
export function summarise(events: readonly SummarisedEvent[]): SummaryLine[] {
  const lines: SummaryLine[] = [];
  for (const { kind, type, one, many } of KINDS) {
    const matching = events.filter((event) => event.type === type);
    const count = matching.length;
    if (count === 0) {
      continue;
    }
    const line: SummaryLine = {
      kind,
      count,
      text: `${count} ${count === 1 ? one : many}`,
    };
    const focus = latestFocus(matching);
    if (focus) {
      line.focus = focus;
    }
    lines.push(line);
  }
  return lines;
}

/** The position of the last event that has one. */
function latestFocus(
  events: readonly SummarisedEvent[],
): SummaryFocus | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const { lat, lon } = events[i].payload;
    if (typeof lat === 'number' && typeof lon === 'number') {
      return { lat, lon };
    }
  }
  return undefined;
}
