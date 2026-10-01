import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { appConfig } from './app.config';
import { DEFAULT_GAME_CONFIG } from './core/models/game-config';
import { GameConfigService } from './core/services/game-config.service';

describe('appConfig', () => {
  it('loads the game config at startup', () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);

    const served = { ...DEFAULT_GAME_CONFIG, maxPlants: 12 };
    http.expectOne({ method: 'GET', url: '/api/config' }).flush(served);

    expect(TestBed.inject(GameConfigService).config()).toEqual(served);
    http.verify();
  });
});
