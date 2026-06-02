import { Injectable, signal } from '@angular/core';
import { ThemeService } from './theme.service';

export type Density = 'compact' | 'normal' | 'comfortable';

export interface AccentOption {
  id: string;
  label: string;
  primary: string;
  container: string;
  onContainer: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'purple', label: 'Purple', primary: '#6750A4', container: '#EADDFF', onContainer: '#21005D' },
  { id: 'blue', label: 'Blue', primary: '#1976D2', container: '#BBDEFB', onContainer: '#0D47A1' },
  { id: 'teal', label: 'Teal', primary: '#00695C', container: '#B2DFDB', onContainer: '#004D40' },
  { id: 'coral', label: 'Coral', primary: '#BF360C', container: '#FFCCBC', onContainer: '#7B1C00' },
  { id: 'green', label: 'Green', primary: '#2E7D32', container: '#C8E6C9', onContainer: '#1B5E20' },
];

@Injectable({ providedIn: 'root' })
export class AppearanceService {
  readonly accentIndex = signal(0);
  readonly density = signal<Density>('normal');

  private readonly DEFAULT_ACCENT = 0;
  private readonly DEFAULT_DENSITY: Density = 'normal';

  constructor(private readonly theme: ThemeService) {
    // Before login: always start from default branding colors
    this.applyAccentIndex(this.DEFAULT_ACCENT);
    this.applyDensity(this.DEFAULT_DENSITY);
  }

  setAccent(indexOrId: number | string): void {
    let index = 0;
    if (typeof indexOrId === 'number') {
      index = indexOrId;
    } else {
      const byName = ACCENT_OPTIONS.findIndex(
        a => a.label.toLowerCase() === indexOrId.toLowerCase() || a.id === indexOrId.toLowerCase(),
      );
      index = byName >= 0 ? byName : 0;
    }
    this.accentIndex.set(index);
    this.applyAccentIndex(index);
    localStorage.setItem('accentColor', String(index));
  }

  setDensity(value: Density): void {
    this.density.set(value);
    this.applyDensity(value);
    localStorage.setItem('density', value);
  }

  setDarkMode(enabled: boolean): void {
    this.theme.setDarkMode(enabled);
  }

  isDarkMode(): boolean {
    return this.theme.darkMode();
  }

  activateForCurrentUser(): void {
    this.accentIndex.set(this.readAccentIndex());
    this.density.set(this.readDensity());
    this.applyAccentIndex(this.accentIndex());
    this.applyDensity(this.density());
  }

  private applyAccentIndex(index: number): void {
    const option = ACCENT_OPTIONS[index] ?? ACCENT_OPTIONS[0];
    this.applyAccentColor(option.primary, option.container, option.onContainer);
  }

  private applyAccentColor(primary: string, container: string, onContainer: string): void {
    const root = document.documentElement;
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-container', container);
    root.style.setProperty('--on-primary-container', onContainer);
    root.style.setProperty('--md-primary', primary);
    root.style.setProperty('--md-primary-container', container);
    root.style.setProperty('--md-on-primary-container', onContainer);
    root.style.setProperty('--color-primary', primary);

    let styleTag = document.getElementById('dynamic-theme') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-theme';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = `
      .mat-mdc-raised-button.mat-primary,
      .mat-mdc-fab.mat-primary,
      .mat-mdc-mini-fab.mat-primary {
        background-color: ${primary} !important;
      }
      .mat-mdc-outlined-button.mat-primary {
        color: ${primary} !important;
        border-color: ${primary} !important;
      }
      .mat-primary .mdc-list-item--activated {
        background-color: ${container} !important;
        color: ${onContainer} !important;
      }
      .active-nav-item {
        background-color: ${container} !important;
        color: ${onContainer} !important;
      }
      .mat-mdc-slide-toggle.mat-primary .mdc-switch:enabled .mdc-switch__track::after {
        background: ${primary} !important;
      }
      .mat-mdc-slide-toggle.mat-primary .mdc-switch--selected:enabled .mdc-switch__handle::after {
        background: ${primary} !important;
      }
      .logo-blob, .avatar, .user-avatar, .card-avatar, .member-avatar, .audit-avatar, .notif-avatar {
        background: linear-gradient(135deg, ${primary}, ${primary}CC) !important;
      }
      .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label { color: ${primary} !important; }
      .mat-mdc-tab .mdc-tab-indicator__content--underline { border-color: ${primary} !important; }
      .extended-fab,
      .invite-btn {
        background: ${primary} !important;
      }
      .nav-item.nav-active {
        background: ${container} !important;
        color: ${onContainer} !important;
      }
      .nav-item.nav-active .nav-ti {
        color: ${onContainer} !important;
      }
      .mat-mdc-slider .mdc-slider__track--active_fill,
      .mat-mdc-slider .mdc-slider__track--inactive {
        border-color: ${primary} !important;
      }
    `;
  }

  private applyDensity(value: Density): void {
    document.body.classList.remove('density-compact', 'density-normal', 'density-comfortable');
    document.body.classList.add(`density-${value}`);
  }

  private readAccentIndex(): number {
    try {
      const raw = localStorage.getItem('accentColor');
      if (raw === null) return this.DEFAULT_ACCENT;
      const num = Number(raw);
      if (Number.isInteger(num) && num >= 0 && num < ACCENT_OPTIONS.length) return num;
      const oldByName = ACCENT_OPTIONS.findIndex(a => a.id === raw || a.label.toLowerCase() === raw.toLowerCase());
      return oldByName >= 0 ? oldByName : this.DEFAULT_ACCENT;
    } catch {
      return this.DEFAULT_ACCENT;
    }
  }

  private readDensity(): Density {
    try {
      const v = localStorage.getItem('density') as Density | null;
      return v === 'compact' || v === 'comfortable' ? v : this.DEFAULT_DENSITY;
    } catch {
      return this.DEFAULT_DENSITY;
    }
  }
}
