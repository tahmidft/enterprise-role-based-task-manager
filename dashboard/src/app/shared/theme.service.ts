import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(this.readStored());

  constructor() {
    this.apply(this.darkMode());
  }

  setDarkMode(enabled: boolean): void {
    this.darkMode.set(enabled);
    localStorage.setItem(STORAGE_KEY, enabled ? 'dark' : 'light');
    this.apply(enabled);
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('dark-theme', dark);
    document.body.classList.toggle('dark-theme', dark);
  }

  private readStored(): boolean {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'dark') return true;
      if (value === 'light') return false;
      // Legacy key support
      return localStorage.getItem('darkMode') === 'true';
    } catch {
      return false;
    }
  }
}
