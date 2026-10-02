import { plural, type WantSpec, type WantType } from '../wants/want-evaluator';
import type { SpeciesId } from './content.types';
import { DECORATIONS } from './decorations';
import { PLANTS } from './plants';

/**
 * Pre-written wants for when the AI cannot make one (AIB-05, WNT-02 AC5): a
 * few lines per species and want type, in that species' voice (AIB-07).
 * fillWantTemplate fills the placeholders with the planet's real items:
 * {amount} ("two moonflowers"), {plant}, {plants}, {place} ("the lamp-post"
 * or "my home"), {decoration}, {count} (a number word, for variety) and
 * {item} (what to bring back). The content spec fills every line with every
 * item and checks it against the content rules (SD section 10).
 */
export const FALLBACK_WANTS: Readonly<
  Record<SpeciesId, Readonly<Record<WantType, readonly string[]>>>
> = {
  worm: {
    'plant-near': [
      'Could you plant {amount} near {place}? Their roots would make lovely company for my tunnels.',
      '{amount} near {place}, please. The soil there is just waiting for some roots.',
      'I have been tunnelling near {place} and it feels a bit bare. Some {plants} would fix that nicely.',
    ],
    'count-blooming': [
      'I would love to see {amount} in bloom. I will admire them from below.',
      '{amount} in bloom would make the soil smell wonderful. Worms notice these things.',
      'Could we have {amount} blooming? I want to count their roots from underneath.',
    ],
    'place-decoration': [
      'A {decoration} would be just the thing. I could tunnel right underneath it.',
      'Could you put a {decoration} somewhere? I like having landmarks for my tunnels.',
      'The surface needs a {decoration}. I have checked, and the soil agrees.',
    ],
    variety: [
      'Could you grow {count} different plants near my home? Every kind of root makes the soil more interesting.',
      'I dream of {count} different plants around my home. A worm likes a varied neighbourhood.',
      '{count} different plants near my home, please. My tunnels would feel like a proper little village.',
    ],
    'bring-back': [
      'The soil feels quiet without the {item}. Could we have it back, please?',
      'I keep tunnelling to where the {item} used to be. Could you bring it back?',
      'Something is missing up there, and I think it is the {item}. Would you bring it back?',
    ],
  },
  snail: {
    'plant-near': [
      '{amount} near {place} would be splendid. I shall get there by next week.',
      'I have planned a very slow stroll to {place}. Could you plant {amount} there for me to admire?',
      'Could you plant {plants} near {place}? I would like a scenic route, at my own pace.',
    ],
    'count-blooming': [
      'I should like {amount} in bloom. There is no hurry, of course, there never is.',
      '{amount} in bloom would make a fine view from my shell. Take your time.',
      'Could we have {amount} blooming? I will admire them very, very slowly.',
    ],
    'place-decoration': [
      'A {decoration} would suit this planet splendidly. I could rest beside it for a day or two.',
      'I have always wanted to visit a {decoration}. Could you place one, please?',
      'Could you put down a {decoration}? It would give me something to travel towards, slowly.',
    ],
    variety: [
      'I would love {count} different plants near my home. Variety is the salad of life.',
      '{count} different plants around my home, please. A snail deserves a menu with choices.',
      'Could you grow {count} kinds of plant near my home? I would sample each one, very slowly.',
    ],
    'bring-back': [
      'I do miss the {item}. Could it come back, if it is no trouble?',
      'My afternoon stroll is not the same without the {item}. Could you bring it back?',
      'The {item} was my favourite spot. I would be delighted to see it again.',
    ],
  },
  bee: {
    'plant-near': [
      'Bzz! {amount} near {place} would make my rounds so much quicker.',
      'Could you plant {amount} near {place}? I would fly a little loop around them every morning.',
      'My flight path passes {place}. {amount} there would make it the best route on the planet.',
    ],
    'count-blooming': [
      'Bzz, {amount} in bloom, please! I have a very busy schedule of visiting to do.',
      'I would love {amount} blooming at once. That is a proper buzz-worthy garden.',
      'Could we have {amount} in bloom? I want to visit every single one before lunch.',
    ],
    'place-decoration': [
      'A {decoration} would make a perfect landing spot. Could you place one, please?',
      'Bzz, a {decoration} would be lovely! I could rest my wings on it between flowers.',
      'Could you put a {decoration} somewhere? Every busy bee needs a place to pause.',
    ],
    variety: [
      '{count} different plants near my home would be a dream. I like a varied menu.',
      'Could you grow {count} kinds of plant around my home? Bzz, the variety!',
      'I would love {count} different plants near my home. Each one hums a different tune to me.',
    ],
    'bring-back': [
      'Bzz, my route feels odd without the {item}. Could you bring it back?',
      'I keep flying to where the {item} was. Could we have it again, please?',
      'The {item} was my favourite stop. Would you bring it back, please?',
    ],
  },
  moth: {
    'plant-near': [
      'One requires {plants}. Near {place}, obviously.',
      '{amount} near {place} would be most elegant. One has standards, you know.',
      'Could you plant {amount} near {place}? They would look divine in the evening glow.',
    ],
    'count-blooming': [
      'One would adore {amount} in bloom. For the evening view, naturally.',
      '{amount} in bloom, if you please. The night deserves a little drama.',
      'Could we have {amount} blooming? I wish to flutter past them at dusk.',
    ],
    'place-decoration': [
      'One requires a {decoration}. It is simply what a refined planet has.',
      'A {decoration} would complete the scenery beautifully. Could you place one, please?',
      'Could you put down a {decoration}? I would circle it very gracefully.',
    ],
    variety: [
      "One would like {count} different plants near one's home. Variety is terribly fashionable.",
      '{count} kinds of plant around my home, please. I do enjoy a sophisticated garden.',
      'Could you grow {count} different plants near my home? They would look so nice by lamplight.',
    ],
    'bring-back': [
      'One rather misses the {item}. Could it return, please?',
      'The evenings are not quite the same without the {item}. Would you bring it back?',
      'I keep fluttering to where the {item} used to be. Could we have it again?',
    ],
  },
  hedgehog: {
    'plant-near': [
      'Could you plant {amount} near {place}? I would snuffle around them very happily.',
      '{amount} near {place} would be lovely. Good for hiding in, and for sniffing.',
      'I like the spot near {place}. Some {plants} there would make it extra cosy.',
    ],
    'count-blooming': [
      'I would love {amount} in bloom. I promise to only sniff them a little.',
      '{amount} blooming would make the best snuffling walk. Could you manage that?',
      'Could we have {amount} in bloom? I could curl up and look at them all day.',
    ],
    'place-decoration': [
      'A {decoration} would be wonderful to hide behind. Could you place one, please?',
      'Could you put a {decoration} somewhere? I need a new spot for my afternoon naps.',
      'I have been dreaming about a {decoration}. Just a small one would do.',
    ],
    variety: [
      'Could you grow {count} different plants near my home? Each one smells different, you see.',
      '{count} kinds of plant around my home would be so cosy. More things to snuffle!',
      'I would like {count} different plants near my home. A hedgehog likes a good mix of smells.',
    ],
    'bring-back': [
      'I keep snuffling around for the {item}. Could you bring it back, please?',
      'My favourite hiding spot was by the {item}. Would you put it back?',
      'It is a bit less cosy without the {item}. Could we have it again?',
    ],
  },
  frog: {
    'plant-near': [
      'Ribbit! {amount} near {place} would make a splendid hopping spot.',
      'Could you plant {amount} near {place}? I would hop between them all day.',
      'I have big plans for the patch near {place}. Some {plants} would make it perfect.',
    ],
    'count-blooming': [
      'Ribbit, {amount} in bloom would be grand! I could hop from one to the next.',
      'I would love {amount} blooming. Something nice to look at between splashes.',
      'Could we have {amount} in bloom? I would croak them a little song.',
    ],
    'place-decoration': [
      'A {decoration} would be ribbiting! Could you place one, please?',
      'Could you put a {decoration} somewhere? I would like a new spot to hop to.',
      'Ribbit! A {decoration} would make this planet even more splendid.',
    ],
    variety: [
      '{count} different plants near my home, please. A frog likes a lively neighbourhood.',
      'Could you grow {count} kinds of plant around my home? I would hop around each one.',
      'Ribbit! I would love {count} different plants near my home.',
    ],
    'bring-back': [
      'Ribbit, I do miss the {item}. Could you bring it back, please?',
      'My hopping route feels odd without the {item}. Would you put it back?',
      'The {item} was such a splendid spot. Could we have it again?',
    ],
  },
};

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** A plant's catalogue name in lower case, such as "moonflower"; the id when unknown. */
export function plantName(id: string): string {
  return PLANTS.find((plant) => plant.id === id)?.name.toLowerCase() ?? id;
}

/** A decoration's catalogue name in lower case, such as "lamp-post"; the id when unknown. */
export function decorationName(id: string): string {
  return (
    DECORATIONS.find(
      (decoration) => decoration.id === id,
    )?.name.toLowerCase() ?? id
  );
}

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** The values a want's placeholders stand for. */
function placeholderValues(spec: WantSpec): Record<string, string> {
  switch (spec.type) {
    case 'plant-near':
    case 'count-blooming': {
      const plant = plantName(spec.plant);
      const values: Record<string, string> = {
        plant,
        plants: plural(plant, 2),
        amount: `${numberWord(spec.count)} ${plural(plant, spec.count)}`,
      };
      if (spec.type === 'plant-near') {
        values.place =
          spec.near.kind === 'home'
            ? 'my home'
            : `the ${decorationName(spec.near.decoration)}`;
      }
      return values;
    }
    case 'place-decoration':
      return { decoration: decorationName(spec.decoration) };
    case 'variety':
      return { count: numberWord(spec.distinct) };
    case 'bring-back':
      return {
        item:
          spec.itemKind === 'plant'
            ? plantName(spec.item)
            : decorationName(spec.item),
      };
  }
}

/**
 * The template with its placeholders filled from the want, every sentence
 * starting with a capital. A placeholder the want has no value for is left
 * as it is, so the content spec can catch it.
 */
export function fillWantTemplate(template: string, spec: WantSpec): string {
  const values = placeholderValues(spec);
  return template
    .replace(
      /\{(\w+)\}/g,
      (placeholder, key: string) => values[key] ?? placeholder,
    )
    .replace(
      /(^|[.!?]\s+)(\p{Ll})/gu,
      (_match, before: string, letter: string) => before + letter.toUpperCase(),
    );
}
