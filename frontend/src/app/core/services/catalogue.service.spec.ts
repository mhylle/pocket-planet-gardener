import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CATALOGUE } from '../../testing/garden-fixtures';
import { CatalogueService } from './catalogue.service';

describe('CatalogueService', () => {
  let http: HttpTestingController;
  let catalogue: CatalogueService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    catalogue = TestBed.inject(CatalogueService);
  });

  afterEach(() => http.verify());

  it('fetches the catalogue once and looks entries up by id', () => {
    catalogue.load();
    catalogue.load();
    http.expectOne({ method: 'GET', url: '/api/catalogue' }).flush(CATALOGUE);
    catalogue.load();

    expect(catalogue.catalogue()).toEqual(CATALOGUE);
    expect(catalogue.plant('sunflower')?.bloomMinutes).toBe(120);
    expect(catalogue.decoration('pond')?.isWater).toBe(true);
    expect(catalogue.plant('pond')).toBeUndefined();
  });

  it('names seeds and decorations the way the player reads them', () => {
    catalogue.load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);

    expect(catalogue.itemName({ itemType: 'clover', kind: 'seed' })).toBe('Clover seed');
    expect(catalogue.itemName({ itemType: 'clover', kind: 'seed' }, 2)).toBe('Clover seeds');
    expect(catalogue.itemName({ itemType: 'pond', kind: 'decoration' })).toBe('Pond');
    expect([catalogue.name('clover'), catalogue.name('pond'), catalogue.name('lamp-post')]).toEqual(
      ['Clover', 'Pond', 'Lamp post'],
    );
  });

  it('names species as the catalogue does', () => {
    catalogue.load();
    http.expectOne('/api/catalogue').flush({
      ...CATALOGUE,
      species: [{ id: 'bee', name: 'Bumblebee', hint: 'Likes flowers.' }],
    });

    expect(catalogue.name('bee')).toBe('Bumblebee');
  });

  it('falls back to readable ids when loading fails, and may load again later', () => {
    catalogue.load();
    http
      .expectOne('/api/catalogue')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });

    expect(catalogue.itemName({ itemType: 'lamp-post', kind: 'decoration' })).toBe('Lamp post');
    expect(catalogue.itemName({ itemType: 'clover', kind: 'seed' })).toBe('Clover seed');

    catalogue.load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    expect(catalogue.plant('clover')?.name).toBe('Clover');
  });
});
