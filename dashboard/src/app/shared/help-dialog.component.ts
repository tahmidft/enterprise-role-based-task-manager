import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-help-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="help-shell">
      <header class="help-header">
        <h2 class="help-title">Help & documentation</h2>
        <button type="button" class="help-close" mat-dialog-close aria-label="Close">
          <i class="ti ti-x"></i>
        </button>
      </header>

      <section class="help-section">
        <h3 class="help-subtitle">Nexus PM</h3>
        <p>
          Nexus PM is a mission-focused planning workspace for task execution, schedule analysis, earned value
          tracking, audit traceability, and security oversight.
        </p>
      </section>

      <section class="help-section">
        <h3 class="help-subtitle">Core areas</h3>
        <ul class="help-list">
          <li><strong>Dashboard:</strong> EVM cards, WBS hierarchy, CPM graph, and task table.</li>
          <li><strong>Board:</strong> Drag-and-drop Kanban workflow with quick task actions.</li>
          <li><strong>Analytics:</strong> Trend and workload charts for delivery visibility.</li>
          <li><strong>Audit log:</strong> Searchable compliance trail with structured metadata.</li>
          <li><strong>Security:</strong> Risk alerts, review workflow, and anomaly monitoring.</li>
        </ul>
      </section>

      <section class="help-section">
        <h3 class="help-subtitle">Defense & aerospace context</h3>
        <p>
          Earned Value Management (EVM) aligns with DFARS-style program controls, while Critical Path Method (CPM)
          supports dependency-driven planning used in mission-critical delivery programs.
        </p>
      </section>

      <section class="help-section">
        <h3 class="help-subtitle">Quick tips</h3>
        <ul class="help-list">
          <li>Use <kbd>Ctrl</kbd> + <kbd>K</kbd> to focus top search.</li>
          <li>Use <kbd>[</kbd> to collapse or expand the sidebar.</li>
          <li>Use the bell panel to mark notifications as read or clear them.</li>
        </ul>
      </section>

      <footer class="help-footer">
        <button mat-flat-button color="primary" mat-dialog-close>Close</button>
      </footer>
    </div>
  `,
  styles: [`
    .help-shell { min-width: 520px; max-width: 700px; max-height: 75vh; display: flex; flex-direction: column; }
    .help-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--md-outline); margin-bottom: 14px; }
    .help-title { margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--md-on-surface); }
    .help-close { width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; cursor: pointer; color: var(--md-on-surface-secondary); display: inline-flex; align-items: center; justify-content: center; }
    .help-section { margin-bottom: 12px; }
    .help-subtitle { margin: 0 0 6px; font-size: 0.95rem; font-weight: 600; color: var(--md-on-surface); }
    .help-section p { margin: 0; color: var(--md-on-surface-secondary); line-height: 1.45; font-size: 0.9rem; }
    .help-list { margin: 0; padding-left: 18px; color: var(--md-on-surface-secondary); font-size: 0.9rem; line-height: 1.45; }
    .help-list li { margin-bottom: 4px; }
    kbd {
      padding: 1px 6px;
      border-radius: 6px;
      background: var(--md-surface-variant);
      border: 1px solid var(--md-outline);
      color: var(--md-on-surface);
      font-size: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .help-footer { display: flex; justify-content: flex-end; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--md-outline); }
  `],
})
export class HelpDialogComponent {}

