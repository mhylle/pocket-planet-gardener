import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlanetIdentityService } from './planet-identity.service';

/**
 * HTTP to the backend. Callers pass paths such as '/config'; the '/api' prefix is added here
 * and the proxy forwards it. Requests carry X-Planet-Id whenever a planet id is known.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = '/api';
  private readonly http = inject(HttpClient);
  private readonly identity = inject(PlanetIdentityService);

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(this.baseUrl + path, { headers: this.headers() });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.baseUrl + path, body, { headers: this.headers() });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.baseUrl + path, body, { headers: this.headers() });
  }

  delete<T>(path: string, body?: unknown): Observable<T> {
    return this.http.delete<T>(this.baseUrl + path, { headers: this.headers(), body });
  }

  private headers(): HttpHeaders {
    const planetId = this.identity.planetId();
    return planetId ? new HttpHeaders({ 'X-Planet-Id': planetId }) : new HttpHeaders();
  }
}
