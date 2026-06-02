import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { EnvironmentService } from '../../../services/environment';
import { ShortcutsDialogComponent } from './shortcuts-dialog.component';
import { HelpDialogComponent } from './help-dialog.component';

interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { email?: string };
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  exportEVMReport(): void {
    this.http.get<{ data: Array<Record<string, unknown>> }>(`${this.env.apiUrl}/tasks?limit=500`).subscribe({
      next: ({ data }) => {
        const projectId = (data.find(t => !!t['projectId'])?.['projectId'] as string | undefined) ?? '';
        if (!projectId) {
          this.snackBar.open('No project data found', 'Close', { duration: 2000 });
          return;
        }
        this.http.get<Record<string, unknown>>(`${this.env.apiUrl}/projects/${projectId}/evm`).subscribe({
          next: evm => {
            const rows = [
              ['metric', 'value'],
              ['SPI', String(evm['spi'] ?? '')],
              ['CPI', String(evm['cpi'] ?? '')],
              ['EAC', String(evm['eac'] ?? '')],
              ['Total Tasks', String(data.length)],
              ['Completed Tasks', String(data.filter(t => t['status'] === 'completed').length)],
            ];
            this.downloadCsv('evm-report.csv', rows);
          },
        });
      },
    });
  }

  exportTaskList(): void {
    this.http.get<{ data: Array<Record<string, unknown>> }>(`${this.env.apiUrl}/tasks?limit=500`).subscribe({
      next: ({ data }) => {
        const cols = ['id', 'title', 'status', 'priority', 'assignedToId', 'startDate', 'dueDate', 'budgetHours', 'actualHours', 'completionPercent'];
        const rows = [cols, ...data.map(t => cols.map(c => this.safeCell(t[c])))];
        this.downloadCsv('task-list.csv', rows);
      },
    });
  }

  exportFullDashboard(): void {
    forkJoin({
      tasks: this.http.get<{ data: Array<Record<string, unknown>> }>(`${this.env.apiUrl}/tasks?limit=500`),
    }).subscribe(({ tasks }) => {
      const cols = ['id', 'title', 'status', 'priority', 'completionPercent'];
      const rows: string[][] = [
        ['section', 'label', 'value'],
        ['summary', 'totalTasks', String(tasks.data.length)],
        ['summary', 'completedTasks', String(tasks.data.filter(t => t['status'] === 'completed').length)],
        [],
        cols,
        ...tasks.data.map(t => cols.map(c => this.safeCell(t[c]))),
      ];
      this.downloadCsv('dashboard-full.csv', rows);
    });
  }

  exportBoardTasks(): void {
    this.exportTaskList();
  }

  exportAuditLogAsTXT(): void {
    this.http.get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`).subscribe(rows => {
      const text = rows.map(r => `${r.createdAt} | ${r.action} | ${r.resource} | ${r.user?.email ?? 'unknown'}`).join('\n');
      this.downloadText('audit-log.txt', text);
    });
  }

  exportAuditLogAsCSV(): void {
    this.http.get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`).subscribe(rows => {
      const cols = ['id', 'action', 'resource', 'resourceId', 'createdAt', 'ipAddress'];
      const dataRows = rows.map(r => [
        this.safeCell(r.id),
        this.safeCell(r.action),
        this.safeCell(r.resource),
        this.safeCell(r.resourceId),
        this.safeCell(r.createdAt),
        this.safeCell(r.ipAddress),
      ]);
      this.downloadCsv('audit-log.csv', [cols, ...dataRows]);
    });
  }

  copyAuditLogsToClipboard(): void {
    this.http.get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`).subscribe(async rows => {
      await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
      this.snackBar.open('Copied to clipboard', 'Close', { duration: 2000 });
    });
  }

  exportAnalyticsCSV(): void {
    this.http.get<Record<string, unknown>>(`${this.env.apiUrl}/analytics`).subscribe({
      next: data => {
        const rows: string[][] = [['metric', 'value']];
        for (const [k, v] of Object.entries(data)) {
          rows.push([k, this.safeCell(v)]);
        }
        this.downloadCsv('analytics.csv', rows);
      },
    });
  }

  saveAnalyticsAsImage(selector = '.chart-grid'): void {
    const html2canvasFn = (window as unknown as { html2canvas?: (el: HTMLElement) => Promise<HTMLCanvasElement> }).html2canvas;
    if (!html2canvasFn) {
      this.snackBar.open('Screenshot export unavailable in this build', 'Close', { duration: 2500 });
      return;
    }
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) {
      this.snackBar.open('Analytics chart area not found', 'Close', { duration: 2500 });
      return;
    }
    html2canvasFn(el).then(canvas => {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `analytics-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    });
  }

  openKeyboardShortcutsDialog(): void {
    this.dialog.open(ShortcutsDialogComponent, { panelClass: 'm3-dialog-panel' });
  }

  openHelpDialog(): void {
    this.dialog.open(HelpDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '680px',
    });
  }

  reportBug(): void {
    window.location.href = 'mailto:support@nexuspm.com';
  }

  private downloadCsv(fileName: string, rows: Array<Array<string | number | null | undefined>>): void {
    const csv = rows
      .map(r => r.map(v => {
        const s = this.safeCell(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\n');
    this.downloadText(fileName, csv, 'text/csv');
  }

  private downloadText(fileName: string, text: string, type = 'text/plain'): void {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private safeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}

