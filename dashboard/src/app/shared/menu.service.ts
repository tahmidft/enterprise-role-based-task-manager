import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EnvironmentService } from '../../../services/environment';
import { AuthService } from '../../../services/auth';
import { ShortcutsDialogComponent } from './shortcuts-dialog.component';
import { HelpDialogComponent } from './help-dialog.component';
import {
  BoardFilterDialogComponent,
  BoardFilterResult,
} from './board-filter-dialog.component';
import { BugReportDialogComponent } from './bug-report-dialog.component';

interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { email?: string };
}

interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
}

type TaskRow = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class MenuService {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private auth = inject(AuthService);

  /** Emits whenever board filters are applied from the shell menu. */
  readonly boardFilterApplied$ = new Subject<BoardFilterResult>();

  exportEVMReport(): void {
    this.withProjectAndTasks(({ project, tasks }) => {
      if (this.canAccessPlanningEvm() && project) {
        this.http
          .get<Record<string, unknown>>(`${this.env.apiUrl}/projects/${project.id}/evm`)
          .pipe(catchError(() => of(null)))
          .subscribe(evm => {
            if (evm) {
              this.downloadEvmCsv(project, evm, tasks);
              this.snackBar.open('EVM report exported', 'Close', { duration: 2000 });
              return;
            }
            this.downloadTaskProgressCsv(project, tasks, 'evm-report.csv');
            this.snackBar.open('Exported task progress summary (planning metrics unavailable)', 'Close', {
              duration: 3000,
            });
          });
        return;
      }

      this.downloadTaskProgressCsv(project, tasks, 'evm-report.csv');
      this.snackBar.open('Task progress report exported', 'Close', { duration: 2000 });
    }, 'Could not export EVM report');
  }

  exportTaskList(): void {
    this.fetchTasks().subscribe({
      next: tasks => {
        const cols = [
          'id',
          'title',
          'status',
          'priority',
          'assignedToId',
          'startDate',
          'dueDate',
          'budgetHours',
          'actualHours',
          'completionPercent',
          'projectId',
        ];
        const rows = [cols, ...tasks.map(t => cols.map(c => this.safeCell(t[c])))];
        this.downloadCsv('task-list.csv', rows);
        this.snackBar.open(`Exported ${tasks.length} tasks`, 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Could not export task list', 'Close', { duration: 2500 }),
    });
  }

  exportFullDashboard(): void {
    forkJoin({
      tasks: this.fetchTasks(),
      projects: this.fetchProjects(),
      analytics: this.http
        .get<Record<string, unknown>>(`${this.env.apiUrl}/analytics`)
        .pipe(catchError(() => of({}))),
    }).subscribe({
      next: ({ tasks, projects, analytics }) => {
        const completed = tasks.filter(t => t['status'] === 'completed').length;
        const rows: string[][] = [
          ['section', 'label', 'value'],
          ['summary', 'exportedAt', new Date().toISOString()],
          ['summary', 'totalTasks', String(tasks.length)],
          ['summary', 'completedTasks', String(completed)],
          ['summary', 'inProgressTasks', String(tasks.filter(t => t['status'] === 'in-progress').length)],
          ['summary', 'pendingTasks', String(tasks.filter(t => t['status'] === 'pending').length)],
          ['summary', 'projects', String(projects.length)],
        ];

        for (const [k, v] of Object.entries(analytics)) {
          rows.push(['analytics', k, this.safeCell(v)]);
        }

        const budget = tasks.reduce((sum, t) => sum + Number(t['budgetHours'] ?? 0), 0);
        const actual = tasks.reduce((sum, t) => sum + Number(t['actualHours'] ?? 0), 0);
        rows.push(['evm', 'totalBudgetHours', String(budget)]);
        rows.push(['evm', 'totalActualHours', String(actual)]);

        rows.push([]);
        const cols = ['id', 'title', 'status', 'priority', 'completionPercent', 'budgetHours', 'actualHours'];
        rows.push(cols);
        rows.push(...tasks.map(t => cols.map(c => this.safeCell(t[c]))));

        this.downloadCsv('dashboard-full.csv', rows);
        this.snackBar.open('Full dashboard exported', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Could not export full dashboard', 'Close', { duration: 2500 }),
    });
  }

  exportBoardTasks(): void {
    this.exportTaskList();
  }

  exportAuditLogAsTXT(): void {
    this.http
      .get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`)
      .pipe(catchError(() => of([] as AuditLogRow[])))
      .subscribe({
        next: rows => {
          if (!rows.length) {
            this.snackBar.open('No audit log entries to export', 'Close', { duration: 2500 });
            return;
          }
          const text = rows
            .map(
              r =>
                `${r.createdAt}\t${r.action}\t${r.resource}\t${r.resourceId ?? ''}\t${r.user?.email ?? 'system'}\t${r.ipAddress ?? ''}`,
            )
            .join('\n');
          this.downloadText('audit-log.txt', text);
          this.snackBar.open(`Exported ${rows.length} audit entries`, 'Close', { duration: 2000 });
        },
        error: () => this.snackBar.open('Could not export audit log TXT', 'Close', { duration: 2500 }),
      });
  }

  exportAuditLogAsCSV(): void {
    this.http
      .get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`)
      .pipe(catchError(() => of([] as AuditLogRow[])))
      .subscribe({
        next: rows => {
          if (!rows.length) {
            this.snackBar.open('No audit log entries to export', 'Close', { duration: 2500 });
            return;
          }
          const cols = ['id', 'action', 'resource', 'resourceId', 'createdAt', 'ipAddress', 'userEmail'];
          const dataRows = rows.map(r => [
            this.safeCell(r.id),
            this.safeCell(r.action),
            this.safeCell(r.resource),
            this.safeCell(r.resourceId),
            this.safeCell(r.createdAt),
            this.safeCell(r.ipAddress),
            this.safeCell(r.user?.email),
          ]);
          this.downloadCsv('audit-log.csv', [cols, ...dataRows]);
          this.snackBar.open(`Exported ${rows.length} audit entries`, 'Close', { duration: 2000 });
        },
        error: () => this.snackBar.open('Could not export audit log CSV', 'Close', { duration: 2500 }),
      });
  }

  copyAuditLogsToClipboard(): void {
    this.http
      .get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`)
      .pipe(catchError(() => of([] as AuditLogRow[])))
      .subscribe({
        next: async rows => {
          if (!rows.length) {
            this.snackBar.open('No audit log entries to copy', 'Close', { duration: 2500 });
            return;
          }
          try {
            await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
            this.snackBar.open(`Copied ${rows.length} entries to clipboard`, 'Close', { duration: 2000 });
          } catch {
            this.snackBar.open('Clipboard permission denied', 'Close', { duration: 2500 });
          }
        },
        error: () => this.snackBar.open('Could not copy audit logs', 'Close', { duration: 2500 }),
      });
  }

  exportAnalyticsCSV(): void {
    this.http
      .get<Record<string, unknown>>(`${this.env.apiUrl}/analytics`)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: data => {
          if (!data) {
            this.snackBar.open('Analytics unavailable for your role', 'Close', { duration: 2500 });
            return;
          }
          const rows: string[][] = [['metric', 'value']];
          for (const [k, v] of Object.entries(data)) {
            rows.push([k, this.safeCell(v)]);
          }
          this.downloadCsv('analytics.csv', rows);
          this.snackBar.open('Analytics CSV exported', 'Close', { duration: 2000 });
        },
        error: () => this.snackBar.open('Could not export analytics CSV', 'Close', { duration: 2500 }),
      });
  }

  saveAnalyticsAsImage(selector = '.chart-grid'): void {
    const html2canvasFn = (window as unknown as { html2canvas?: (el: HTMLElement) => Promise<HTMLCanvasElement> })
      .html2canvas;
    if (!html2canvasFn) {
      this.snackBar.open('Screenshot export unavailable in this build', 'Close', { duration: 2500 });
      return;
    }
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) {
      this.snackBar.open('Analytics chart area not found', 'Close', { duration: 2500 });
      return;
    }
    html2canvasFn(el)
      .then(canvas => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `analytics-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        this.snackBar.open('Analytics image saved', 'Close', { duration: 2000 });
      })
      .catch(() => this.snackBar.open('Could not save analytics image', 'Close', { duration: 2500 }));
  }

  openBoardFilterDialog(): void {
    this.fetchTasks().subscribe({
      next: tasks => {
        const assigneeMap = new Map<string, string>();
        for (const task of tasks) {
          const id = String(task['assignedToId'] ?? '');
          if (!id) continue;
          const assigned = task['assignedTo'] as { name?: string; email?: string } | undefined;
          assigneeMap.set(id, assigned?.name || assigned?.email || id);
        }
        this.dialog
          .open(BoardFilterDialogComponent, {
            panelClass: 'm3-dialog-panel',
            width: '420px',
            data: { assignees: [...assigneeMap.entries()].map(([id, label]) => ({ id, label })) },
          })
          .afterClosed()
          .subscribe(result => {
            if (!result) return;
            sessionStorage.setItem('boardFilter', JSON.stringify(result));
            this.boardFilterApplied$.next(result);
            void this.router.navigate(['/board']).then(() => {
              this.snackBar.open('Board filters applied', 'Close', { duration: 2000 });
            });
          });
      },
      error: () => this.snackBar.open('Could not open board filter', 'Close', { duration: 2500 }),
    });
  }

  openKeyboardShortcutsDialog(): void {
    this.dialog.open(ShortcutsDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '440px',
    });
  }

  openHelpDialog(): void {
    this.dialog.open(HelpDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '680px',
    });
  }

  reportBug(): void {
    const user = this.auth.getCurrentUser();
    this.dialog.open(BugReportDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '480px',
      data: {
        route: this.router.url,
        userEmail: user?.email,
        userRole: user?.role?.name,
      },
    });
  }

  private withProjectAndTasks(
    fn: (ctx: { project: ProjectSummary | null; tasks: TaskRow[] }) => void,
    errorMessage: string,
  ): void {
    forkJoin({
      projects: this.fetchProjects(),
      tasks: this.fetchTasks(),
    }).subscribe({
      next: ({ projects, tasks }) => {
        fn({ project: this.pickPrimaryProject(projects, tasks), tasks });
      },
      error: () => this.snackBar.open(errorMessage, 'Close', { duration: 2500 }),
    });
  }

  /** Prefer a project that actually has tasks (avoids empty alphabetical first like Growth Initiative). */
  private pickPrimaryProject(projects: ProjectSummary[], tasks: TaskRow[]): ProjectSummary | null {
    if (!projects.length) return null;
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const id = String(t['projectId'] ?? '');
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    let best: ProjectSummary | null = null;
    let bestCount = -1;
    for (const p of projects) {
      const n = counts.get(p.id) ?? 0;
      if (n > bestCount) {
        best = p;
        bestCount = n;
      }
    }
    return best ?? projects[0] ?? null;
  }

  private fetchTasks() {
    return this.http
      .get<{ data: TaskRow[] }>(`${this.env.apiUrl}/tasks?limit=500`)
      .pipe(map(r => r.data ?? []), catchError(() => of([] as TaskRow[])));
  }

  private fetchProjects() {
    return this.http
      .get<ProjectSummary[]>(`${this.env.apiUrl}/projects`)
      .pipe(catchError(() => of([] as ProjectSummary[])));
  }

  private canAccessPlanningEvm(): boolean {
    const role = this.auth.getCurrentUser()?.role?.name ?? '';
    return role === 'owner' || role === 'admin' || role === 'manager';
  }

  private downloadEvmCsv(project: ProjectSummary, evm: Record<string, unknown>, tasks: TaskRow[]): void {
    const rows: string[][] = [
      ['metric', 'value'],
      ['projectId', project.id],
      ['projectName', project.name],
      ['PV', this.safeCell(evm['pv'])],
      ['EV', this.safeCell(evm['ev'])],
      ['AC', this.safeCell(evm['ac'])],
      ['SPI', this.safeCell(evm['spi'])],
      ['CPI', this.safeCell(evm['cpi'])],
      ['EAC', this.safeCell(evm['eac'])],
      ['totalTasks', String(tasks.length)],
      ['completedTasks', String(tasks.filter(t => t['status'] === 'completed').length)],
    ];
    this.downloadCsv(`evm-${this.fileSlug(project.name)}.csv`, rows);
  }

  private downloadTaskProgressCsv(
    project: ProjectSummary | null,
    tasks: TaskRow[],
    fileName: string,
  ): void {
    const rows: string[][] = [
      ['project', project?.name ?? ''],
      ['metric', 'value'],
      ['totalTasks', String(tasks.length)],
      ['completedTasks', String(tasks.filter(t => t['status'] === 'completed').length)],
      [
        'totalBudgetHours',
        String(tasks.reduce((sum, t) => sum + Number(t['budgetHours'] ?? 0), 0)),
      ],
      [
        'totalActualHours',
        String(tasks.reduce((sum, t) => sum + Number(t['actualHours'] ?? 0), 0)),
      ],
      [],
      ['id', 'title', 'status', 'priority', 'budgetHours', 'actualHours', 'completionPercent'],
      ...tasks.map(t => [
        this.safeCell(t['id']),
        this.safeCell(t['title']),
        this.safeCell(t['status']),
        this.safeCell(t['priority']),
        this.safeCell(t['budgetHours']),
        this.safeCell(t['actualHours']),
        this.safeCell(t['completionPercent']),
      ]),
    ];
    this.downloadCsv(fileName, rows);
  }

  private fileSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
  }

  private downloadCsv(fileName: string, rows: Array<Array<string | number | null | undefined>>): void {
    const csv = rows
      .map(r =>
        r
          .map(v => {
            const s = this.safeCell(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(','),
      )
      .join('\n');
    this.downloadText(fileName, csv, 'text/csv;charset=utf-8');
  }

  private downloadText(fileName: string, text: string, type = 'text/plain;charset=utf-8'): void {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private safeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
