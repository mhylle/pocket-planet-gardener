import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_GAME_CONFIG, GameConfig } from '../models/game-config';
import { GameConfigService } from './game-config.service';

const served: GameConfig = { ...DEFAULT_GAME_CONFIG, maxPlants: 12, chatDailyLimit: 5 };

describe('GameConfigService', () => {
  let http: HttpTestingController;
  let service: GameConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(GameConfigService);
  });

  afterEach(() => http.verify());

  it('holds the defaults before loading', () => {
    expect(service.config()).toEqual(DEFAULT_GAME_CONFIG);
  });

  it('load replaces the defaults with the fetched config', () => {
    service.load();
    http.expectOne({ method: 'GET', url: '/api/config' }).flush(served);

    expect(service.config()).toEqual(served);
  });

  it('keeps the defaults when the request fails', () => {
    service.load();
    http
      .expectOne({ method: 'GET', url: '/api/config' })
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });

    expect(service.config()).toEqual(DEFAULT_GAME_CONFIG);
  });
});
