import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'sidebarCollapsed';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  readonly collapsed = signal(this.readStored());

  toggle(): void {
    this.setCollapsed(!this.collapsed());
  }

  setCollapsed(value: boolean): void {
    this.collapsed.set(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    document.documentElement.classList.toggle('sidebar-collapsed', value);
  }

  private readStored(): boolean {
    try {
      const v = localStorage.getItem(STORAGE_KEY) === 'true';
      if (v) {
        document.documentElement.classList.add('sidebar-collapsed');
      }
      return v;
    } catch {
      return false;
    }
  }
}
