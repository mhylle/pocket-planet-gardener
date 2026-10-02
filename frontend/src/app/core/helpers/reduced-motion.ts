/** True when the device asks for less motion (SET-03). The settings take this over later. */
export function prefersReducedMotion(): boolean {
  // jsdom, where the specs run, has no matchMedia.
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
