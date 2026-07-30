import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { EnvironmentService } from '../../../services/environment';
import { auditActionIconClass, initialsFromUser } from '../shared/task-ui';

export interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  user?: { email?: string; name?: string };
}

type ActionFilter = 'all' | 'task:create' | 'task:update' | 'task:delete' | 'auth:login';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './audit.html',
  styleUrl: './audit.css',
})
export class AuditComponent implements OnInit {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private snackBar = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  loading = signal(true);
  error = signal('');
  restricted = signal(false);
  expandedIds = signal<Set<string>>(new Set());
  allRows = signal<AuditLogRow[]>([]);
  searchText = signal('');
  actionFilter = signal<ActionFilter>('all');
  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);
  private requestedAction = signal<ActionFilter | null>(null);

  readonly filterChips: { id: ActionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'task:create', label: 'task:create' },
    { id: 'task:update', label: 'task:update' },
    { id: 'task:delete', label: 'task:delete' },
    { id: 'auth:login', label: 'auth:login' },
  ];

  filteredRows = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const action = this.actionFilter();
    const from = this.dateFrom();
    const to = this.dateTo();

    return this.allRows().filter(row => {
      if (action !== 'all' && row.action !== action) return false;

      if (from) {
        const d = new Date(row.createdAt);
        if (d < startOfDay(from)) return false;
      }
      if (to) {
        const d = new Date(row.createdAt);
        if (d > endOfDay(to)) return false;
      }

      if (!q) return true;
      const hay = [
        row.action,
        row.resource,
        row.resourceId ?? '',
        row.user?.email ?? '',
        row.user?.name ?? '',
        row.ipAddress ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const action = params.get('action');
      if (action && this.filterChips.some(c => c.id === action)) {
        const typedAction = action as ActionFilter;
        this.actionFilter.set(typedAction);
        this.requestedAction.set(typedAction);
      }
    });
    this.http.get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`).subscribe({
      next: logs => {
        if (logs.length === 0) {
          this.allRows.set(this.buildDemoAuditRows(this.requestedAction() ?? undefined));
          this.snackBar.open('Showing demo audit activity', 'Close', { duration: 2200 });
        } else {
          const requested = this.requestedAction();
          if (requested && !logs.some(row => row.action === requested)) {
            this.allRows.set([...this.buildDemoAuditRows(requested), ...logs]);
            this.snackBar.open(`No ${requested} events found, added demo entry`, 'Close', { duration: 2400 });
          } else {
            this.allRows.set(logs);
          }
        }
        this.loading.set(false);
      },
      error: err => {
        const message = err.error?.message ?? 'Unable to load audit log.';
        if (typeof message === 'string' && message.includes('audit:read')) {
          this.restricted.set(true);
          this.error.set('');
        } else {
          this.error.set(message);
        }
        this.loading.set(false);
      },
    });
  }

  setActionFilter(id: ActionFilter): void {
    this.actionFilter.set(id);
  }

  iconClass(action: string): string {
    return auditActionIconClass(action);
  }

  iconName(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('create')) return 'ti-plus';
    if (a.includes('update')) return 'ti-edit';
    if (a.includes('delete')) return 'ti-trash';
    if (a.includes('login')) return 'ti-login';
    if (a.includes('auth')) return 'ti-shield';
    return 'ti-history';
  }

  userInitials(row: AuditLogRow): string {
    return initialsFromUser(row.user);
  }

  summary(row: AuditLogRow): string {
    const meta = row.metadata ? JSON.stringify(row.metadata) : '';
    return [row.resource, row.resourceId, meta].filter(Boolean).join(' · ') || '—';
  }

  toggleExpanded(id: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
  }

  toggleExpand(row: AuditLogRow): void {
    this.toggleExpanded(row.id);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  expandAll(): void {
    this.expandedIds.set(new Set(this.filteredRows().map(r => r.id)));
  }

  collapseAll(): void {
    this.expandedIds.set(new Set());
  }

  actionLabel(action: string): string {
    const a = action.toLowerCase();
    if (a === 'task:create') return 'New task created';
    if (a === 'task:update') return 'Task updated';
    if (a === 'task:delete') return 'Task deleted';
    if (a === 'auth:login') return 'Signed in';
    return action.replace(/[:_-]/g, ' ');
  }

  async copyEntry(row: AuditLogRow): Promise<void> {
    await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    this.snackBar.open('Copied to clipboard', 'Close', { duration: 2000 });
  }

  async copyAll(): Promise<void> {
    await navigator.clipboard.writeText(JSON.stringify(this.filteredRows(), null, 2));
    this.snackBar.open('Copied to clipboard', 'Close', { duration: 2000 });
  }

  exportCsv(): void {
    const rows = this.filteredRows();
    const cols = ['id', 'action', 'resource', 'resourceId', 'createdAt', 'ipAddress'];
    const header = cols.join(',');
    const lines = rows.map(r =>
      cols.map(c => {
        const v =
          c === 'id' ? r.id :
          c === 'action' ? r.action :
          c === 'resource' ? r.resource :
          c === 'resourceId' ? (r.resourceId ?? '') :
          c === 'createdAt' ? r.createdAt :
          c === 'ipAddress' ? (r.ipAddress ?? '') :
          '';
        const s = String(v);
        return s.includes(',') ? `"${s}"` : s;
      }).join(','),
    );
    this.downloadFile('audit-log.csv', [header, ...lines].join('\n'), 'text/csv');
  }

  exportTxt(): void {
    const text = this.filteredRows()
      .map(r => `${r.createdAt} | ${this.actionLabel(r.action)} | ${r.resource} | ${r.user?.email ?? 'unknown'}`)
      .join('\n');
    this.downloadFile('audit-log.txt', text, 'text/plain');
  }

  private downloadFile(name: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  private buildDemoAuditRows(actionOnly?: ActionFilter): AuditLogRow[] {
    const user = this.auth.getCurrentUser();
    const actorName = user?.name || user?.email || 'Team Member';
    const actorEmail = user?.email || 'member@nexuspm.com';
    const now = Date.now();
    const rows: AuditLogRow[] = [
      {
        id: `demo-login-${now}`,
        action: 'auth:login',
        resource: 'auth/session',
        resourceId: 'session-demo',
        ipAddress: '::1',
        createdAt: new Date(now - 8 * 60 * 1000).toISOString(),
        metadata: { userAgent: 'Chrome on Windows', role: user?.role?.name ?? 'member' },
        user: { name: actorName, email: actorEmail },
      },
      {
        id: `demo-create-${now}`,
        action: 'task:create',
        resource: 'task',
        resourceId: 'task-demo-1',
        ipAddress: '::1',
        createdAt: new Date(now - 28 * 60 * 1000).toISOString(),
        metadata: { title: 'Update API documentation', role: user?.role?.name ?? 'member' },
        user: { name: actorName, email: actorEmail },
      },
      {
        id: `demo-update-${now}`,
        action: 'task:update',
        resource: 'task',
        resourceId: 'task-demo-2',
        ipAddress: '::1',
        createdAt: new Date(now - 95 * 60 * 1000).toISOString(),
        metadata: { title: 'Fix login bug', from: 'Medium', to: 'High', role: user?.role?.name ?? 'member' },
        user: { name: actorName, email: actorEmail },
      },
      {
        id: `demo-escalate-${now}`,
        action: 'task:priority-escalated',
        resource: 'task',
        resourceId: 'task-demo-3',
        ipAddress: '::1',
        createdAt: new Date(now - 22 * 60 * 60 * 1000).toISOString(),
        metadata: { title: 'Database migration', severity: 'Critical', role: user?.role?.name ?? 'member' },
        user: { name: actorName, email: actorEmail },
      },
    ];
    if (!actionOnly) return rows;
    return rows.filter(r => r.action === actionOnly);
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
