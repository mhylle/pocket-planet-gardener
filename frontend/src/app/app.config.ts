import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { GameConfigService } from './core/services/game-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Starts the config request without waiting for it, so a slow or failing backend never
    // holds up the first render.
    provideAppInitializer(() => inject(GameConfigService).load()),
  ],
};
