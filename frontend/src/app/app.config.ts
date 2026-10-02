import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { GameConfigService } from './core/services/game-config.service';
import { SCENE_RENDERER } from './scene/scene-renderer';
import { WebGlSceneRenderer } from './scene/webgl-scene-renderer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    { provide: SCENE_RENDERER, useClass: WebGlSceneRenderer },
    // Starts the config request without waiting for it, so a slow or failing backend never
    // holds up the first render.
    provideAppInitializer(() => inject(GameConfigService).load()),
  ],
};
