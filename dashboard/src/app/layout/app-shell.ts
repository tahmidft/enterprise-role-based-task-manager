import { Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { EnvironmentService } from '../../../services/environment';
import { ThemeService } from '../shared/theme.service';
import { SidebarService } from '../shared/sidebar.service';
import { AppearanceService } from '../shared/appearance.service';
import { initialsFromUser } from '../shared/task-ui';
import { MenuService } from '../shared/menu.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  board: 'Project board',
  analytics: 'Analytics',
  team: 'Team',
  audit: 'Audit log',
  'audit-log': 'Audit log',
  security: 'Security',
  settings: 'Settings',
};

const ALLOWED_ACTIONS = new Set([
  'task:create',
  'task:update',
  'task:delete',
  'task:priority-escalated',
  'auth:login',
]);

export interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  user?: { id?: string; email?: string; name?: string };
}

export interface NotifItem {
  id: string;
  iconClass: string;
  iconName: string;
  message: string;
  time: string;
  date: Date;
  unread: boolean;
  action?: 'board' | 'security';
  resourceId?: string;
  rawAction?: string;
  isMock?: boolean;
}

function toTaskNotifItem(row: AuditLogRow, readIds: Set<string>): NotifItem | null {
  const a = row.action.toLowerCase();
  if (!ALLOWED_ACTIONS.has(a)) return null;
  const title = (row.metadata?.['title'] as string | undefined) ?? row.resourceId ?? '';
  const ip = row.ipAddress ?? 'unknown IP';

  let message = '';
  let iconClass = 'notif-icon notif-icon--default';
  let iconName = 'ti-bell';
  let action: NotifItem['action'];

  if (a === 'task:create') {
    message = title ? `New task created: ${title}` : 'New task created';
    iconClass = 'notif-icon notif-icon--create';
    iconName = 'ti-circle-plus';
    action = 'board';
  } else if (a === 'task:update') {
    message = title ? `Task updated: ${title}` : 'Task updated';
    iconClass = 'notif-icon notif-icon--update';
    iconName = 'ti-edit';
    action = 'board';
  } else if (a === 'task:delete') {
    message = 'Task deleted';
    iconClass = 'notif-icon notif-icon--delete';
    iconName = 'ti-trash';
  } else if (a === 'task:priority-escalated') {
    message = title ? `⚠ Priority escalated: ${title}` : '⚠ Priority escalated';
    iconClass = 'notif-icon notif-icon--escalate';
    iconName = 'ti-alert-triangle';
    action = 'board';
  } else if (a === 'auth:login') {
    message = `Signed in from ${ip}`;
    iconClass = 'notif-icon notif-icon--login';
    iconName = 'ti-login';
    action = 'security';
  } else {
    return null;
  }

  return {
    id: row.id,
    iconClass,
    iconName,
    message,
    time: row.createdAt,
    date: new Date(row.createdAt),
    unread: !readIds.has(row.id),
    action,
    resourceId: row.resourceId,
    rawAction: row.action,
  };
}

function dayLabel(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  return 'EARLIER';
}

export interface NotifGroup {
  label: string;
  items: NotifItem[];
}

interface SecurityAlertItem {
  id: string;
  riskScore: number;
  reviewed?: boolean;
  createdAt: string;
}

interface TeamMemberSeed {
  id: number;
  name: string;
  role: string;
  avatar: string;
}

interface SeedNotification {
  id: number;
  memberId: number;
  action: string;
  taskTitle?: string;
  oldPriority?: string;
  newPriority?: string;
  device?: string;
  newSeverity?: string;
  timestamp: string;
  type: 'task' | 'priority' | 'security';
  link: string;
}

const TEAM_MEMBERS: TeamMemberSeed[] = [
  { id: 1, name: 'Sarah Chen', role: 'Frontend Lead', avatar: 'SC' },
  { id: 2, name: 'Marcus Johnson', role: 'Backend Engineer', avatar: 'MJ' },
  { id: 3, name: 'Priya Patel', role: 'Product Manager', avatar: 'PP' },
  { id: 4, name: 'David Okafor', role: 'DevOps', avatar: 'DO' },
  { id: 5, name: 'Elena Vasquez', role: 'QA Lead', avatar: 'EV' },
];

type MenuAction =
  | 'dashboardEvmCsv'
  | 'dashboardTasksCsv'
  | 'dashboardFullCsv'
  | 'boardTasksCsv'
  | 'boardFilter'
  | 'auditTxt'
  | 'auditCsv'
  | 'auditCopy'
  | 'analyticsCsv'
  | 'analyticsScreenshot'
  | 'shortcuts'
  | 'help'
  | 'bug';

interface MenuItem {
  icon: string;
  label: string;
  action: MenuAction;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShellComponent {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private menuService = inject(MenuService);
  readonly theme = inject(ThemeService);
  readonly sidebar = inject(SidebarService);
  private appearance = inject(AppearanceService);

  isOwner = signal(false);
  canViewTeam = signal(true);
  securityBadge = signal(0);
  boardBadge = signal(0);
  notifCount = signal(0);
  notificationsOpen = signal(false);
  notifGroups = signal<NotifGroup[]>([]);
  userName = signal('');
  userEmail = signal('');
  userInitials = signal('??');
  pageTitle = signal('Dashboard');
  currentRoute = signal('dashboard');
  searchQuery = '';

  private readNotifIds = new Set<string>();
  @ViewChild('topSearch') topSearch?: ElementRef<HTMLInputElement>;

  get isDarkMode(): boolean {
    return this.theme.darkMode();
  }
  set isDarkMode(value: boolean) {
    this.theme.setDarkMode(value);
  }

  constructor() {
    const themePref = localStorage.getItem('theme');
    if (themePref === 'dark' || themePref === 'light') {
      this.theme.setDarkMode(themePref === 'dark');
    }
    this.sidebar.setCollapsed(localStorage.getItem('sidebarCollapsed') === 'true');

    const user = this.auth.getCurrentUser();
    const name = user?.name ?? '';
    const email = user?.email ?? '';
    this.userName.set(name || email || 'User');
    this.userEmail.set(email);
    this.userInitials.set(this.buildInitials(name, email));
    this.isOwner.set(user?.role?.name === 'owner');
    const role = user?.role?.name ?? '';
    this.canViewTeam.set(role === 'owner' || role === 'admin' || role === 'manager');
    this.appearance.activateForCurrentUser();
    this.readNotifIds = this.readStoredReadIds();

    this.updateTitle(this.router.url);
    this.currentRoute.set(this.routeSegment(this.router.url));
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.updateTitle(e.urlAfterRedirects);
        this.currentRoute.set(this.routeSegment(e.urlAfterRedirects));
      });

    this.http
      .get<{ data: Array<{ status: string }> }>(`${this.env.apiUrl}/tasks?limit=500`)
      .subscribe(({ data }) => {
        const open = data.filter(
          t => t.status === 'pending' || t.status === 'in-progress',
        ).length;
        this.boardBadge.set(open);
      });

    if (this.isOwner()) {
      this.http
        .get<{ unreadCount: number }>(`${this.env.apiUrl}/security/alerts`)
        .subscribe(r => this.securityBadge.set(r.unreadCount ?? 0));
    }

    this.loadNotificationCount();
  }

  toggleSidebar(): void {
    this.sidebar.toggle();
  }

  openNotifications(): void {
    this.notificationsOpen.set(true);
    forkJoin({
      logs: this.http.get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`),
      security: this.isOwner()
        ? this.http
            .get<{ alerts?: SecurityAlertItem[] } | SecurityAlertItem[]>(`${this.env.apiUrl}/security/alerts`)
            .pipe(catchError(() => of([] as SecurityAlertItem[])))
        : of([] as SecurityAlertItem[]),
    }).subscribe({
      next: ({ logs, security }) => {
        const taskItems = this.buildTaskItems(logs);
        const securityItems = this.buildSecurityItems(security);
        const sourceItems = [...taskItems, ...securityItems];
        const items = (sourceItems.length > 0 ? sourceItems : this.seedDemoNotifications())
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 10);
        this.notifGroups.set(this.groupNotifications(items));
        this.notifCount.set(items.filter(i => i.unread).length);
      },
      error: () => {
        const fallback = this.seedDemoNotifications();
        this.notifGroups.set(this.groupNotifications(fallback));
        this.notifCount.set(fallback.filter(i => i.unread).length);
      },
    });
  }

  closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  markAllRead(): void {
    for (const g of this.notifGroups()) {
      for (const item of g.items) {
        this.readNotifIds.add(item.id);
        item.unread = false;
      }
    }
    this.notifCount.set(0);
    this.persistReadIds();
    // Force signal refresh
    this.notifGroups.set([...this.notifGroups()]);
  }

  notifAction(item: NotifItem): void {
    this.readNotifIds.add(item.id);
    item.unread = false;
    this.removeNotification(item.id);
    this.closeNotifications();
    if (item.action === 'board') {
      this.router.navigate(['/board']);
    } else if (item.action === 'security') {
      this.router.navigate(['/security']);
    }
  }

  clearNotifications(): void {
    for (const g of this.notifGroups()) {
      for (const item of g.items) {
        this.readNotifIds.add(item.id);
      }
    }
    this.notifGroups.set([]);
    this.notifCount.set(0);
    this.persistReadIds();
  }

  menuItems(): MenuItem[] {
    const route = this.currentRoute();
    if (route === 'dashboard') {
      return [
        { icon: 'ti-file-export', label: 'Export EVM report (CSV)', action: 'dashboardEvmCsv' },
        { icon: 'ti-file-export', label: 'Export task list (CSV)', action: 'dashboardTasksCsv' },
        { icon: 'ti-file-export', label: 'Export full dashboard (CSV)', action: 'dashboardFullCsv' },
        { icon: '', label: '---', action: 'shortcuts' },
        { icon: 'ti-keyboard', label: 'Keyboard shortcuts', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
        { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
      ];
    }
    if (route === 'board') {
      return [
        { icon: 'ti-file-export', label: 'Export board tasks (CSV)', action: 'boardTasksCsv' },
        { icon: 'ti-filter', label: 'Filter tasks', action: 'boardFilter' },
        { icon: '', label: '---', action: 'shortcuts' },
        { icon: 'ti-keyboard', label: 'Keyboard shortcuts', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
      ];
    }
    if (route === 'audit' || route === 'audit-log') {
      return [
        { icon: 'ti-file-text', label: 'Export as TXT', action: 'auditTxt' },
        { icon: 'ti-file-spreadsheet', label: 'Export as CSV', action: 'auditCsv' },
        { icon: 'ti-clipboard', label: 'Copy all to clipboard', action: 'auditCopy' },
        { icon: '', label: '---', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
      ];
    }
    if (route === 'analytics') {
      const hasHtml2Canvas = !!(window as unknown as { html2canvas?: unknown }).html2canvas;
      return [
        { icon: 'ti-file-export', label: 'Export analytics (CSV)', action: 'analyticsCsv' },
        ...(hasHtml2Canvas
          ? [{ icon: 'ti-screenshot', label: 'Save as image', action: 'analyticsScreenshot' as const }]
          : []),
        { icon: '', label: '---', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
      ];
    }
    return [
      { icon: 'ti-keyboard', label: 'Keyboard shortcuts', action: 'shortcuts' },
      { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
      { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
    ];
  }

  runMenuAction(action: MenuAction): void {
    switch (action) {
      case 'dashboardEvmCsv':
        this.menuService.exportEVMReport();
        break;
      case 'dashboardTasksCsv':
        this.menuService.exportTaskList();
        break;
      case 'dashboardFullCsv':
        this.menuService.exportFullDashboard();
        break;
      case 'boardTasksCsv':
        this.menuService.exportBoardTasks();
        break;
      case 'auditCsv':
        this.menuService.exportAuditLogAsCSV();
        break;
      case 'analyticsCsv':
        this.menuService.exportAnalyticsCSV();
        break;
      case 'auditTxt':
        this.menuService.exportAuditLogAsTXT();
        break;
      case 'auditCopy':
        this.menuService.copyAuditLogsToClipboard();
        break;
      case 'analyticsScreenshot':
        this.menuService.saveAnalyticsAsImage();
        break;
      case 'boardFilter':
        this.snackBar.open('Board filter panel coming soon', 'Close', { duration: 2500 });
        break;
      case 'shortcuts':
        this.menuService.openKeyboardShortcutsDialog();
        break;
      case 'help':
        this.menuService.openHelpDialog();
        break;
      case 'bug':
        this.menuService.reportBug();
        break;
      default:
        break;
    }
  }

  totalUnread(): number {
    return this.notifGroups().reduce(
      (sum, g) => sum + g.items.filter(i => i.unread).length,
      0,
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.notificationsOpen()) this.closeNotifications();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.topSearch?.nativeElement.focus();
      this.topSearch?.nativeElement.select();
    }
    if (!event.ctrlKey && !event.metaKey && event.key === '[') {
      event.preventDefault();
      this.toggleSidebar();
    }
  }

  logout(): void {
    this.auth.logout();
  }


  private loadNotificationCount(): void {
    forkJoin({
      logs: this.http.get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`),
      security: this.isOwner()
        ? this.http
            .get<{ alerts?: SecurityAlertItem[] } | SecurityAlertItem[]>(`${this.env.apiUrl}/security/alerts`)
            .pipe(catchError(() => of([] as SecurityAlertItem[])))
        : of([] as SecurityAlertItem[]),
    }).subscribe({
      next: ({ logs, security }) => {
        const sourceItems = [...this.buildTaskItems(logs), ...this.buildSecurityItems(security)];
        const items = (sourceItems.length > 0 ? sourceItems : this.seedDemoNotifications())
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 10);
        this.notifCount.set(items.filter(i => i.unread).length);
      },
      error: () => this.notifCount.set(this.seedDemoNotifications().filter(i => i.unread).length),
    });
  }

  private updateTitle(url: string): void {
    const segment = url.split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard';
    this.pageTitle.set(ROUTE_TITLES[segment] ?? 'Dashboard');
  }

  private removeNotification(id: string): void {
    const nextGroups = this.notifGroups()
      .map(g => ({ ...g, items: g.items.filter(i => i.id !== id) }))
      .filter(g => g.items.length > 0);
    this.notifGroups.set(nextGroups);
    this.notifCount.set(Math.min(9, this.totalUnread()));
    this.persistReadIds();
  }

  private buildInitials(name: string, email: string): string {
    return initialsFromUser({ name, email });
  }

  private readStoredReadIds(): Set<string> {
    try {
      const raw = localStorage.getItem('notificationsRead');
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw) as string[];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set<string>();
    }
  }

  private persistReadIds(): void {
    try {
      localStorage.setItem('notificationsRead', JSON.stringify([...this.readNotifIds]));
    } catch {
      // ignore session persistence errors
    }
  }

  private routeSegment(url: string): string {
    return url.split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard';
  }

  private buildTaskItems(logs: AuditLogRow[]): NotifItem[] {
    const byDayUser = new Set<string>();
    return logs
      .map(l => toTaskNotifItem(l, this.readNotifIds))
      .filter((i): i is NotifItem => i !== null)
      .filter(item => {
        if (item.rawAction !== 'auth:login') return true;
        const day = item.date.toISOString().slice(0, 10);
        const key = `${item.message}|${day}`;
        if (byDayUser.has(key)) return false;
        byDayUser.add(key);
        return true;
      });
  }

  private buildSecurityItems(security: { alerts?: SecurityAlertItem[] } | SecurityAlertItem[]): NotifItem[] {
    const alerts = Array.isArray(security) ? security : security.alerts ?? [];
    const unreviewed = alerts.filter(a => !a.reviewed).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (unreviewed.length === 0) return [];
    if (unreviewed.length === 1) {
      const a = unreviewed[0];
      return [{
        id: `security-${a.id}`,
        iconClass: 'notif-icon notif-icon--security',
        iconName: 'ti-shield-exclamation',
        message: '🔴 Security alert: suspicious activity detected',
        time: a.createdAt,
        date: new Date(a.createdAt),
        unread: !this.readNotifIds.has(`security-${a.id}`),
        action: 'security',
      }];
    }
    const latest = unreviewed[0];
    return [{
      id: 'security-aggregate',
      iconClass: 'notif-icon notif-icon--security',
      iconName: 'ti-alert-triangle',
      message: `⚠ ${unreviewed.length} security alerts require review`,
      time: latest.createdAt,
      date: new Date(latest.createdAt),
      unread: !this.readNotifIds.has('security-aggregate'),
      action: 'security',
    }];
  }

  private groupNotifications(items: NotifItem[]): NotifGroup[] {
    const map = new Map<string, NotifItem[]>();
    for (const item of items) {
      const label = dayLabel(item.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    }
    const ORDER = ['TODAY', 'YESTERDAY', 'EARLIER'];
    return ORDER.filter(l => map.has(l)).map(l => ({ label: l, items: map.get(l)! }));
  }

  private seedDemoNotifications(): NotifItem[] {
    const seededSource: SeedNotification[] = [
      { id: 1, memberId: 1, action: 'created task', taskTitle: 'Update API documentation', timestamp: '2026-06-02T05:54:00Z', type: 'task', link: '/task/1' },
      { id: 2, memberId: 2, action: 'changed priority', taskTitle: 'Fix login bug', oldPriority: 'Medium', newPriority: 'High', timestamp: '2026-06-02T02:54:00Z', type: 'priority', link: '/task/2' },
      { id: 3, memberId: 4, action: 'new login', device: 'Chrome on Windows', timestamp: '2026-06-02T09:54:00Z', type: 'security', link: '/security/review' },
      { id: 4, memberId: 3, action: 'escalated', taskTitle: 'Database migration', newSeverity: 'Critical', timestamp: '2026-06-01T03:54:00Z', type: 'task', link: '/task/3' },
    ];
    const seeded: Array<Omit<NotifItem, 'unread'>> = seededSource.map(row => {
      const member = TEAM_MEMBERS.find(m => m.id === row.memberId);
      const memberName = member?.name ?? 'Unknown Member';
      let message = `${memberName} ${row.action}`;
      let iconClass = 'notif-icon notif-icon--default';
      let iconName = 'ti-bell';
      let action: NotifItem['action'] = 'board';
      let rawAction = 'task:update';

      if (row.type === 'task' && row.action === 'created task') {
        message = `${memberName} created task "${row.taskTitle ?? ''}"`;
        iconClass = 'notif-icon notif-icon--create';
        iconName = 'ti-circle-plus';
        rawAction = 'task:create';
      } else if (row.type === 'priority') {
        message = `${memberName} changed priority of "${row.taskTitle ?? ''}" from ${row.oldPriority ?? 'N/A'} to ${row.newPriority ?? 'N/A'}`;
        iconClass = 'notif-icon notif-icon--update';
        iconName = 'ti-edit';
        rawAction = 'task:update';
      } else if (row.type === 'security') {
        message = `${memberName} new login from ${row.device ?? 'Unknown device'}`;
        iconClass = 'notif-icon notif-icon--login';
        iconName = 'ti-login';
        action = 'security';
        rawAction = 'auth:login';
      } else if (row.action === 'escalated') {
        message = `${memberName} escalated "${row.taskTitle ?? ''}" to ${row.newSeverity ?? 'Critical'}`;
        iconClass = 'notif-icon notif-icon--escalate';
        iconName = 'ti-alert-triangle';
        rawAction = 'task:priority-escalated';
      }

      return {
        id: `mock-${row.id}`,
        iconClass,
        iconName,
        message,
        time: row.timestamp,
        date: new Date(row.timestamp),
        action,
        rawAction,
      };
    });
    return seeded.map(item => ({ ...item, isMock: true, unread: !this.readNotifIds.has(item.id) }));
  }

}
