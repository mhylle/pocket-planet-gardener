import { TestBed } from '@angular/core/testing';
import { StatusIcon } from '../../core/helpers/status-text';
import { StatusIconComponent } from './status-icon.component';

/** Every StatusIcon: the type check fails here when one is added to or taken from the type. */
const ICONS = Object.keys({
  'drop-empty': true,
  'drop-low': true,
  'drop-half': true,
  'drop-full': true,
  'drop-puddle': true,
  drops: true,
  sun: true,
  'sun-check': true,
  'sun-cloud': true,
  moon: true,
  seed: true,
  sprout: true,
  young: true,
  bloom: true,
  sparkle: true,
  content: true,
  cheerful: true,
  overjoyed: true,
  wistful: true,
  wish: true,
} satisfies Record<StatusIcon, true>) as StatusIcon[];

describe('StatusIconComponent', () => {
  function draw(icon: StatusIcon): SVGSVGElement {
    const fixture = TestBed.createComponent(StatusIconComponent);
    fixture.componentRef.setInput('icon', icon);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('svg');
  }

  const shapes = (svg: SVGSVGElement) => [...svg.querySelectorAll('path, circle, ellipse')];

  it.each(ICONS)('draws "%s", hidden from screen readers beside its words (SET-04)', (icon) => {
    const svg = draw(icon);

    expect(svg.getAttribute('data-icon')).toBe(icon);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(shapes(svg).length).toBeGreaterThan(0);
  });

  it('draws each status with a shape of its own', () => {
    const drawings = ICONS.map((icon) =>
      shapes(draw(icon))
        .map((shape) => shape.outerHTML)
        .join(''),
    );

    expect(new Set(drawings).size).toBe(ICONS.length);
  });
});
