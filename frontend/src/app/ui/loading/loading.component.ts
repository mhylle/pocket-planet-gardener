import { Component } from '@angular/core';
import { PipCloudComponent } from '../pip-cloud/pip-cloud.component';

/** Pip, a small cloud, keeps the player company while the planet opens (NFR-03). */
@Component({
  selector: 'app-loading',
  imports: [PipCloudComponent],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent {}
