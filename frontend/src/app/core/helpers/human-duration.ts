/**
 * Roughly how long some minutes are, the way a player would say it, such as "about 10 minutes"
 * or "about 1½ hours" (GRD-05 AC2). Under an hour it rounds to 5 minutes, never below 5; from
 * an hour on, to the half hour.
 */
export function humanDuration(minutes: number): string {
  const fives = Math.max(5, Math.round(minutes / 5) * 5);
  if (fives < 60) {
    return `about ${fives} minutes`;
  }
  const halves = Math.round(minutes / 30);
  const hours = Math.floor(halves / 2);
  if (halves % 2 === 1) {
    return `about ${hours}½ hours`;
  }
  return hours === 1 ? 'about 1 hour' : `about ${hours} hours`;
}
