import { Injectable } from '@angular/core';

declare const window: Window & {
  __env?: { API_URL?: string };
};

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  readonly apiUrl: string =
    (typeof window !== 'undefined' && window.__env?.API_URL) ||
    'http://localhost:3333/api';
}
