import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

export interface BugReportDialogData {
  route: string;
  userEmail?: string;
  userRole?: string;
}

@Component({
  selector: 'app-bug-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="bug-shell">
      <header class="bug-header">
        <h2 class="bug-title">Report a bug</h2>
        <button type="button" class="bug-close" mat-dialog-close aria-label="Close">
          <i class="ti ti-x"></i>
        </button>
      </header>

      <p class="bug-intro">
        Describe what went wrong. We will include your current page and account context in the report.
      </p>

      <label class="bug-label" for="bug-summary">Summary</label>
      <input
        id="bug-summary"
        class="bug-input"
        [(ngModel)]="summary"
        placeholder="e.g. Export menu does nothing on dashboard"
        maxlength="120"
      />

      <label class="bug-label" for="bug-details">Steps to reproduce</label>
      <textarea
        id="bug-details"
        class="bug-textarea"
        [(ngModel)]="details"
        rows="5"
        placeholder="What did you click? What did you expect?"
      ></textarea>

      <footer class="bug-footer">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="button" (click)="copyReport()">
          Copy report
        </button>
        <button mat-stroked-button type="button" (click)="emailReport()">Email support</button>
      </footer>
    </div>
  `,
  styles: [`
    .bug-shell { min-width: 420px; max-width: 520px; }
    .bug-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .bug-title { margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--md-on-surface); }
    .bug-close { width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; cursor: pointer; color: var(--md-on-surface-secondary); display: inline-flex; align-items: center; justify-content: center; }
    .bug-intro { margin: 0 0 14px; font-size: 13px; color: var(--md-on-surface-secondary); line-height: 1.45; }
    .bug-label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: var(--md-on-surface-hint); }
    .bug-input,
    .bug-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--md-outline);
      border-radius: 12px;
      padding: 10px 12px;
      font: inherit;
      color: var(--md-on-surface);
      background: var(--md-surface);
      margin-bottom: 12px;
    }
    .bug-textarea { resize: vertical; min-height: 110px; }
    .bug-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  `],
})
export class BugReportDialogComponent {
  private readonly ref = inject(MatDialogRef<BugReportDialogComponent>);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<BugReportDialogData>(MAT_DIALOG_DATA);

  summary = '';
  details = '';

  private buildReportText(): string {
    const lines = [
      'Nexus PM bug report',
      `Summary: ${this.summary.trim() || '(no summary)'}`,
      '',
      'Details:',
      this.details.trim() || '(no details provided)',
      '',
      `Page: ${this.data.route}`,
      `User: ${this.data.userEmail ?? 'unknown'}`,
      `Role: ${this.data.userRole ?? 'unknown'}`,
      `Time: ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
    ];
    return lines.join('\n');
  }

  async copyReport(): Promise<void> {
    if (!this.summary.trim() && !this.details.trim()) {
      this.snackBar.open('Add a summary or description first', 'Close', { duration: 2500 });
      return;
    }
    try {
      await navigator.clipboard.writeText(this.buildReportText());
      this.snackBar.open('Bug report copied to clipboard', 'Close', { duration: 2500 });
      this.ref.close();
    } catch {
      this.snackBar.open('Could not copy — try Email support instead', 'Close', { duration: 3000 });
    }
  }

  emailReport(): void {
    if (!this.summary.trim() && !this.details.trim()) {
      this.snackBar.open('Add a summary or description first', 'Close', { duration: 2500 });
      return;
    }
    const subject = encodeURIComponent(`[Nexus PM] ${this.summary.trim() || 'Bug report'}`);
    const body = encodeURIComponent(this.buildReportText());
    window.location.href = `mailto:support@nexuspm.com?subject=${subject}&body=${body}`;
    this.ref.close();
  }
}
