import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Mock } from 'vitest';
import { PlanetDto } from '../../core/models/planet';
import { PlanetSnapshotDto } from '../../core/models/planet-snapshot';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ViewStateService } from '../../core/services/view-state.service';
import { SettingsPanelComponent } from './settings-panel.component';

const mossy: PlanetDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
};

const mossySnapshot: PlanetSnapshotDto = {
  ...mossy,
  radiusLevel: 1,
  maxPlants: 60,
  tutorialStep: 0,
  serverTime: '2026-10-01T10:00:00.000Z',
  plants: [],
  decorations: [],
  inventory: [],
  unlocks: [],
  clouds: [],
  sun: { angle: 0, overrideAngle: null, overrideAt: null },
};

describe('SettingsPanelComponent', () => {
  let fixture: ComponentFixture<SettingsPanelComponent>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let writeText: Mock<(text: string) => Promise<void>>;

  beforeEach(async () => {
    localStorage.clear();
    writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    TestBed.configureTestingModule({
      imports: [SettingsPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(mossy.id);
    TestBed.inject(PlanetStore).setSnapshot(mossySnapshot);
    TestBed.inject(ViewStateService).show('planet');

    fixture = TestBed.createComponent(SettingsPanelComponent);
    fixture.componentRef.setInput('planet', mossySnapshot);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  /** Lets pending promise callbacks run, then waits for the re-render. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const buttonTexts = () => [...page.querySelectorAll('button')].map((b) => b.textContent!.trim());

  function button(text: string): HTMLButtonElement {
    const found = [...page.querySelectorAll('button')].find((b) => b.textContent!.trim() === text);
    if (!found) {
      throw new Error(`No button "${text}" among ${buttonTexts().join(', ')}`);
    }
    return found;
  }

  async function click(text: string) {
    button(text).click();
    await fixture.whenStable();
  }

  const text = (selector: string) => page.querySelector(selector)!.textContent!.trim();
  const storedId = () => localStorage.getItem('ppg.planetId');
  const view = () => TestBed.inject(ViewStateService).view();

  describe('planet code', () => {
    it('shows the code and what it is for', () => {
      expect(text('.code')).toBe('MOSS2345');
      expect(page.textContent).toContain('To open this planet on another device');
    });

    it('copies the code to the clipboard and says so', async () => {
      button('Copy').click();
      await settle();

      expect(writeText).toHaveBeenCalledWith('MOSS2345');
      expect(text('.copy-note')).toBe('Copied');
    });

    it('suggests copying by hand when the clipboard refuses', async () => {
      writeText.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));

      button('Copy').click();
      await settle();

      expect(text('.copy-note')).toContain('copy it yourself');
    });

    it('suggests copying by hand when there is no clipboard', async () => {
      Reflect.deleteProperty(navigator, 'clipboard');

      button('Copy').click();
      await settle();

      expect(text('.copy-note')).toContain('copy it yourself');
    });
  });

  describe('rename', () => {
    const field = () => page.querySelector<HTMLInputElement>('app-planet-name-form input')!;

    async function renameTo(name: string) {
      field().value = name;
      field().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      button('Rename').click();
    }

    it('starts from the current name', () => {
      expect(field().value).toBe('Mossy');
    });

    it('sends the new name and keeps it in the loaded planet', async () => {
      await renameTo(' Fernhill ');

      const req = http.expectOne({ method: 'PATCH', url: '/api/planet/name' });
      expect(req.request.body).toEqual({ name: 'Fernhill' });
      req.flush({ ...mossy, name: 'Fernhill', version: 2 });
      await settle();

      expect(TestBed.inject(PlanetStore).snapshot()?.name).toBe('Fernhill');
      expect(text('.rename-note')).toBe('Name saved.');
    });

    it("shows the server's message and keeps the typed name when it is refused", async () => {
      await renameTo('Grumpy');

      http
        .expectOne('/api/planet/name')
        .flush(
          { statusCode: 400, message: 'That name is not very kind. How about another?' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(text('app-planet-name-form .error')).toBe(
        'That name is not very kind. How about another?',
      );
      expect(field().value).toBe('Grumpy');
      expect(text('.rename-note')).toBe('');
    });
  });

  describe('leave', () => {
    it('explains the code is needed to come back before anything happens', async () => {
      await click('Leave this planet');

      const prompt = page.querySelector('p[tabindex="-1"]')!;
      expect(prompt.textContent).toContain("You'll need the planet code");
      expect(prompt.textContent).toContain('to come back to Mossy later');
      expect(prompt.textContent).toContain('MOSS2345');
      expect(document.activeElement).toBe(prompt);
      expect(storedId()).toBe(mossy.id);
      expect(view()).toBe('planet');
    });

    it('clears the stored planet and shows create-planet once confirmed', async () => {
      await click('Leave this planet');
      await click('Yes, leave');

      expect(storedId()).toBeNull();
      expect(view()).toBe('create-planet');
    });

    it('stays when the player changes their mind', async () => {
      await click('Leave this planet');
      await click('Stay here');

      expect(storedId()).toBe(mossy.id);
      expect(buttonTexts()).toContain('Leave this planet');
    });
  });

  describe('delete', () => {
    it('asks twice, then deletes with the confirmation and shows create-planet', async () => {
      await click('Delete my planet');
      http.expectNone('/api/planet');
      expect(document.activeElement?.textContent).toContain('Delete Mossy?');

      await click('Yes, delete it');
      http.expectNone('/api/planet');
      expect(document.activeElement?.textContent).toContain('One last check');

      button('Delete forever').click();
      const req = http.expectOne({ method: 'DELETE', url: '/api/planet' });
      expect(req.request.body).toEqual({ confirm: 'DELETE' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(storedId()).toBeNull();
      expect(view()).toBe('create-planet');
    });

    it('puts the final button where the first one was not, so a double click cannot delete', async () => {
      await click('Delete my planet');
      const firstCheck = buttonTexts();
      await click('Yes, delete it');
      const secondCheck = buttonTexts();

      const spot = firstCheck.indexOf('Yes, delete it');
      expect(secondCheck[spot]).toBe('Keep my planet');
    });

    it.each([
      ['the first', ['Delete my planet']],
      ['the second', ['Delete my planet', 'Yes, delete it']],
    ])('keeps the planet when the player backs out at %s check', async (_label, steps) => {
      for (const step of steps) {
        await click(step);
      }
      await click('Keep my planet');

      expect(buttonTexts()).toContain('Delete my planet');
      expect(storedId()).toBe(mossy.id);
    });

    it('shows a calm message and keeps the planet when the delete fails', async () => {
      await click('Delete my planet');
      await click('Yes, delete it');
      button('Delete forever').click();

      http
        .expectOne('/api/planet')
        .flush({ statusCode: 500 }, { status: 500, statusText: 'Internal Server Error' });
      await settle();

      expect(text('.delete-error')).toContain('Please try again');
      expect(storedId()).toBe(mossy.id);
      expect(view()).toBe('planet');
    });
  });
});
