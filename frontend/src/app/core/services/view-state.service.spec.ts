import { TestBed } from '@angular/core/testing';
import { ViewStateService } from './view-state.service';

describe('ViewStateService', () => {
  const startUrl = location.href;

  beforeEach(() => localStorage.clear());
  afterEach(() => history.replaceState(null, '', startUrl));

  function openWith(search: string) {
    history.replaceState(null, '', search);
  }

  it('opens create-planet when no planet is stored', () => {
    expect(TestBed.inject(ViewStateService).view()).toBe('create-planet');
  });

  it('opens the planet when a planet id is stored', () => {
    localStorage.setItem('ppg.planetId', 'planet-1');

    expect(TestBed.inject(ViewStateService).view()).toBe('planet');
  });

  it('opens admin with ?admin=1, even when a planet id is stored', () => {
    localStorage.setItem('ppg.planetId', 'planet-1');
    openWith('?admin=1');

    expect(TestBed.inject(ViewStateService).view()).toBe('admin');
  });

  it('ignores admin values other than 1', () => {
    openWith('?admin=0');

    expect(TestBed.inject(ViewStateService).view()).toBe('create-planet');
  });

  it('show switches the view', () => {
    const views = TestBed.inject(ViewStateService);

    views.show('planet');

    expect(views.view()).toBe('planet');
  });

  it('counts as returning while it shows the stored planet it opened on (NFR-03)', () => {
    localStorage.setItem('ppg.planetId', 'planet-1');
    const views = TestBed.inject(ViewStateService);
    expect(views.returning).toBe(true);

    views.show('planet');
    expect(views.returning).toBe(true);

    views.show('create-planet');
    views.show('planet');
    expect(views.returning).toBe(false);
  });

  it('never counts as returning when it opened on another view', () => {
    const views = TestBed.inject(ViewStateService);
    expect(views.returning).toBe(false);

    views.show('planet');
    expect(views.returning).toBe(false);
  });
});
