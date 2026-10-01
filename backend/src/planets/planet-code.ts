/**
 * The characters a planet code is made of: upper-case letters and digits
 * without 0, O, 1, I and L, so a code read aloud or copied by hand cannot be
 * mistyped as another one (ACC-04).
 */
export const PLANET_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const PLANET_CODE_LENGTH = 8;

const PLANET_CODE = new RegExp(
  `^[${PLANET_CODE_ALPHABET}]{${PLANET_CODE_LENGTH}}$`,
);

/** A fresh code drawn from the alphabet; uniqueness is the caller's concern. */
export function generatePlanetCode(random: {
  int(min: number, max: number): number;
}): string {
  return Array.from(
    { length: PLANET_CODE_LENGTH },
    () => PLANET_CODE_ALPHABET[random.int(0, PLANET_CODE_ALPHABET.length - 1)],
  ).join('');
}

/** The code as stored: without surrounding spaces and in upper case. */
export function normalisePlanetCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** True for a normalised code that could have been generated. */
export function isPlanetCode(code: string): boolean {
  return PLANET_CODE.test(code);
}
