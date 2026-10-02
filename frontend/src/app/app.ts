import { Component, inject } from '@angular/core';
import { ViewStateService } from './core/services/view-state.service';
import { AdminComponent } from './ui/admin/admin.component';
import { CreatePlanetComponent } from './ui/create-planet/create-planet.component';
import { PlanetPageComponent } from './ui/planet-page/planet-page.component';

@Component({
  selector: 'app-root',
  imports: [AdminComponent, CreatePlanetComponent, PlanetPageComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly view = inject(ViewStateService).view;
}
