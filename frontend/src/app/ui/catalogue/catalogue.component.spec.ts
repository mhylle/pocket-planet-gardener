import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlanetSnapshotDto } from '../../core/models/planet-snapshot';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CATALOGUE, MOSSY } from '../../testing/garden-fixtures';
import { CatalogueComponent } from './catalogue.component';

describe('CatalogueComponent', () => {
  let fixture: ComponentFixture<CatalogueComponent>;
  let page: HTMLElement;
  let opener: HTMLButtonElement;
  let closed: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CatalogueComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    // Clover and the pond are unlocked; the sunflower, tulip, mushroom and rock are not.
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    // Stands in for the Catalogue button, which has the focus when it opens.
    opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    fixture = TestBed.createComponent(CatalogueComponent);
    page = fixture.nativeElement;
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    await fixture.whenStable();
  });

  afterEach(() => opener.remove());

  const section = (title: string) =>
    [...page.querySelectorAll('section section')].find(
      (each) => each.querySelector('h4')?.textContent?.trim() === title,
    )!;
  const entries = (title: string) => [...section(title).querySelectorAll('.entries > li')];
  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
  /** The words of each part of an entry, such as its name and hint, one space apart. */
  const words = (element: Element) =>
    [...element.children]
      .map(text)
      .filter((part) => part)
      .join(' ');
  const withPlanet = async (changes: Partial<PlanetSnapshotDto>) => {
    TestBed.inject(PlanetStore).setSnapshot({ ...MOSSY, ...changes });
    await fixture.whenStable();
  };

  it('is a labelled dialog that takes the focus, with plants, decorations and creatures', () => {
    const dialog = page.querySelector<HTMLElement>('[role="dialog"]')!;

    expect(dialog.getAttribute('aria-labelledby')).toBe('catalogue-title');
    expect(document.activeElement).toBe(dialog);
    expect([...page.querySelectorAll('h4')].map((each) => each.textContent!.trim())).toEqual([
      'Plants',
      'Decorations',
      'Creatures',
    ]);
    expect(entries('Plants')).toHaveLength(4);
    expect(entries('Decorations')).toHaveLength(2);
  });

  it('shows an unlocked plant with its description, needs and time to bloom (ITM-03 AC2, GRD-05 AC2)', () => {
    const [clover] = entries('Plants');

    expect(clover.querySelector('h5')!.textContent).toBe('Clover');
    expect(text(clover)).toContain('Pops up fast.');
    expect(
      [...clover.querySelectorAll('.needs li')].map((need) => ({
        icon: need.querySelector('svg')?.getAttribute('data-icon'),
        text: text(need),
      })),
    ).toEqual([
      { icon: 'drop-half', text: 'Likes some water' },
      { icon: 'sun-cloud', text: 'Likes some sun' },
    ]);
    expect(text(clover.querySelector('.bloom')!)).toBe('Blooms in about 10 minutes');
  });

  it('shows a locked tulip as a silhouette with its hint, giving nothing else away (ITM-03 AC1)', () => {
    const tulip = entries('Plants')[2];

    expect(tulip.classList.contains('locked')).toBe(true);
    expect(tulip.querySelector('svg.silhouette')).not.toBeNull();
    expect(words(tulip)).toBe('Not found yet Creatures sometimes hand these out as presents.');
    expect(text(tulip)).not.toContain('Tulip');
    expect(tulip.querySelector('.bloom, .needs')).toBeNull();
  });

  it('shows a decoration once unlocked, without needs', async () => {
    const [pond, rock] = entries('Decorations');

    expect(words(pond)).toBe('Pond Splashy.');
    expect(rock.classList.contains('locked')).toBe(true);
    expect(words(rock)).toBe('Not found yet A reward.');

    await withPlanet({ unlocks: [...MOSSY.unlocks, 'rock'] });
    expect(words(entries('Decorations')[1])).toBe('Rock Confident.');
  });

  it('shows each species with its arrival hint (CRT-01 AC2)', () => {
    expect(entries('Creatures').map(words)).toEqual(['Snail Likes clover.']);
  });

  it('says the planet is cosy enough once it has as many creatures as it can hold (CRT-02 AC1)', async () => {
    const note = () => section('Creatures').querySelector('.cosy');
    expect(note()).toBeNull();

    await withPlanet({ creatures: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}` })) });
    expect(note()).toBeNull();

    await withPlanet({ creatures: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}` })) });
    expect(note()?.textContent).toContain('Your planet is cosy enough for now');
  });

  it('closes on Escape or Close, and gives the focus back', () => {
    page
      .querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(1);

    page.querySelector<HTMLButtonElement>('.head button')!.click();
    expect(closed).toBe(2);

    fixture.destroy();
    expect(document.activeElement).toBe(opener);
  });
});
