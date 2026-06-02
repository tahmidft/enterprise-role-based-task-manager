import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-shortcuts-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="sc-shell">
      <header class="sc-header">
        <h2 class="sc-title">Keyboard shortcuts</h2>
        <button type="button" class="sc-close" mat-dialog-close aria-label="Close">
          <i class="ti ti-x"></i>
        </button>
      </header>
      <div class="sc-list">
        <div class="sc-head">
          <span>Action</span>
          <span>Shortcut</span>
        </div>
        <div *ngFor="let s of shortcuts" class="sc-row">
          <span class="sc-desc">{{ s.label }}</span>
          <span class="sc-keys"><kbd>{{ s.keys }}</kbd></span>
        </div>
      </div>
      <div class="sc-footer">
        <button mat-flat-button color="primary" mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .sc-shell { min-width: 360px; max-width: 440px; }
    .sc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .sc-title  { margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--md-on-surface); }
    .sc-close  { width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; cursor: pointer; color: var(--md-on-surface-secondary); display: flex; align-items: center; justify-content: center; }
    .sc-list   { display: flex; flex-direction: column; gap: 10px; }
    .sc-head,
    .sc-row    { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; }
    .sc-head { font-size: 12px; font-weight: 600; color: var(--md-on-surface-hint); padding-bottom: 4px; border-bottom: 1px solid var(--md-outline); }
    .sc-desc   { font-size: 14px; color: var(--md-on-surface); }
    .sc-keys   { display: flex; gap: 4px; }
    kbd {
      padding: 2px 8px;
      border-radius: 6px;
      background: var(--md-surface-variant, #f3edf7);
      border: 1px solid var(--md-outline);
      font-size: 12px;
      font-family: monospace;
      color: var(--md-on-surface);
    }
    .sc-footer { display: flex; justify-content: flex-end; margin-top: 20px; }
  `],
})
export class ShortcutsDialogComponent {
  readonly shortcuts = [
    { label: 'New task', keys: 'N' },
    { label: 'Search', keys: 'Ctrl+K' },
    { label: 'Toggle sidebar', keys: '[' },
    { label: 'Toggle dark mode', keys: 'Ctrl+Shift+D' },
    { label: 'Go to Dashboard', keys: 'G then D' },
    { label: 'Go to Board', keys: 'G then B' },
    { label: 'Go to Analytics', keys: 'G then A' },
  ];
}
