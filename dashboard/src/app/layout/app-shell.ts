import { Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
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
import { initialsFromUser, priorityDotClass } from '../shared/task-ui';
import { MenuService } from '../shared/menu.service';
import { TaskSearchService } from '../shared/task-search.service';
import {
  TaskSearchHit,
  taskStatusLabel,
  titleMatchParts,
  TitlePart,
} from '../shared/task-search.util';
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
  userId?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: { name?: string };
  };
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
  link?: string;
}

function capitalizeWord(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roleDisplayName(roleName?: string | null): string {
  if (!roleName?.trim()) return 'Team member';
  return capitalizeWord(roleName.trim());
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

interface TeamMemberLite {
  id: string;
  roleLabel: string;
  displayName: string;
  email?: string;
}

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
  private taskSearch = inject(TaskSearchService);
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
  teamMembers = signal<TeamMemberLite[]>([]);
  teamMembersById = signal<Map<string, TeamMemberLite>>(new Map());
  pageTitle = signal('Dashboard');
  currentRoute = signal('dashboard');
  moreMenuItems = computed(() => this.buildMenuItems(this.currentRoute()));
  searchQuery = '';
  searchSuggestionsOpen = signal(false);
  searchSuggestions = signal<TaskSearchHit[]>([]);
  searchActiveIndex = signal(-1);
  readonly priorityDotClass = priorityDotClass;
  readonly taskStatusLabel = taskStatusLabel;
  readonly titleMatchParts = titleMatchParts;

  private searchDebounce?: ReturnType<typeof setTimeout>;
  private searchFocused = false;

  @ViewChild('topSearch') topSearch?: ElementRef<HTMLInputElement>;
  @ViewChild('searchWrap') searchWrap?: ElementRef<HTMLElement>;

  private readNotifIds = new Set<string>();

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
    const email = user?.email ?? '';
    const display = roleDisplayName(user?.role?.name);
    this.userName.set(display);
    this.userEmail.set(email);
    this.userInitials.set(this.buildInitials(display, ''));
    this.isOwner.set(user?.role?.name === 'owner');
    const role = user?.role?.name ?? '';
    this.canViewTeam.set(role === 'owner' || role === 'admin' || role === 'manager');
    this.appearance.activateForCurrentUser();
    this.readNotifIds = this.readStoredReadIds();

    this.syncSearchFromRoute(this.router.url);
    this.updateTitle(this.router.url);
    this.currentRoute.set(this.routeSegment(this.router.url));
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.syncSearchFromRoute(e.urlAfterRedirects);
        this.updateTitle(e.urlAfterRedirects);
        this.currentRoute.set(this.routeSegment(e.urlAfterRedirects));
      });

    this.loadTeamRoster();

    if (this.isOwner()) {
      this.http
        .get<{ unreadCount: number }>(`${this.env.apiUrl}/security/alerts`)
        .subscribe(r => this.securityBadge.set(r.unreadCount ?? 0));
    }

    this.loadNotificationCount();
    this.taskSearch.ensureLoaded().subscribe();
  }

  toggleSidebar(): void {
    this.sidebar.toggle();
  }

  submitSearch(): void {
    const hits = this.searchSuggestions();
    const idx = this.searchActiveIndex();
    if (this.searchSuggestionsOpen() && idx >= 0 && hits[idx]) {
      this.selectSearchHit(hits[idx]);
      return;
    }

    const q = this.searchQuery.trim();
    this.closeSearchSuggestions();
    void this.router.navigate(['/board'], {
      queryParams: q ? { search: q, task: null } : { search: null, task: null },
    });
  }

  onSearchInput(): void {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.refreshSearchSuggestions(), 100);
  }

  onSearchFocus(): void {
    this.searchFocused = true;
    if (this.searchQuery.trim()) {
      this.refreshSearchSuggestions();
    }
  }

  onSearchBlur(): void {
    this.searchFocused = false;
    setTimeout(() => {
      if (!this.searchFocused) this.closeSearchSuggestions();
    }, 150);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.searchSuggestionsOpen()) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submitSearch();
      }
      return;
    }

    const hits = this.searchSuggestions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.searchActiveIndex.update(i => Math.min(i + 1, hits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.searchActiveIndex.update(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.searchActiveIndex();
      if (idx >= 0 && hits[idx]) this.selectSearchHit(hits[idx]);
      else this.submitSearch();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearchSuggestions();
    }
  }

  onSearchClear(): void {
    if (!this.searchQuery.trim()) {
      this.closeSearchSuggestions();
      void this.router.navigate(['/board'], { queryParams: { search: null, task: null } });
    }
  }

  selectSearchHit(hit: TaskSearchHit, event?: Event): void {
    event?.preventDefault();
    this.searchQuery = hit.title;
    this.closeSearchSuggestions();
    this.topSearch?.nativeElement.blur();
    void this.router.navigate(['/board'], {
      queryParams: { task: hit.id, search: null },
    });
  }

  suggestionTitleParts(title: string): TitlePart[] {
    return titleMatchParts(title, this.searchQuery);
  }

  private refreshSearchSuggestions(): void {
    const q = this.searchQuery.trim();
    if (!q) {
      this.closeSearchSuggestions();
      return;
    }

    this.taskSearch.ensureLoaded().subscribe({
      next: () => {
        const hits = this.taskSearch.search(q);
        this.searchSuggestions.set(hits);
        this.searchActiveIndex.set(hits.length ? 0 : -1);
        this.searchSuggestionsOpen.set(hits.length > 0);
      },
    });
  }

  private closeSearchSuggestions(): void {
    this.searchSuggestionsOpen.set(false);
    this.searchActiveIndex.set(-1);
  }

  private syncSearchFromRoute(url: string): void {
    if (this.searchFocused) return;
    const search = this.router.parseUrl(url).queryParams['search'];
    this.searchQuery = typeof search === 'string' ? search : '';
    if (!this.searchQuery.trim()) this.closeSearchSuggestions();
  }

  openNotifications(): void {
    this.notificationsOpen.set(true);
    forkJoin({
      logs: this.http
        .get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`)
        .pipe(catchError(() => of([] as AuditLogRow[]))),
      security: this.isOwner()
        ? this.http
            .get<{ alerts?: SecurityAlertItem[] } | SecurityAlertItem[]>(`${this.env.apiUrl}/security/alerts`)
            .pipe(catchError(() => of([] as SecurityAlertItem[])))
        : of([] as SecurityAlertItem[]),
    }).subscribe({
      next: ({ logs, security }) => {
        this.mergeTeamRosterFromAuditLogs(logs);
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
    const fallback = item.action === 'security' ? '/security' : '/board';
    const target = item.link ?? fallback;
    const [path, query = ''] = target.split('?');
    const queryParams = new URLSearchParams(query);
    queryParams.set('fromNotif', String(Date.now()));
    const nextQuery = Object.fromEntries(queryParams.entries());
    this.router.navigate([path], { queryParams: nextQuery }).then(() => {
      this.snackBar.open('Opened from notification', 'Close', { duration: 1500 });
    });
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

  onMoreMenuAction(action: MenuAction): void {
    setTimeout(() => this.runMenuAction(action), 0);
  }

  trackMenuItem(_index: number, item: MenuItem): string {
    return item.label;
  }

  private buildMenuItems(route: string): MenuItem[] {
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
        { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
      ];
    }
    if (route === 'audit' || route === 'audit-log') {
      return [
        { icon: 'ti-file-text', label: 'Export as TXT', action: 'auditTxt' },
        { icon: 'ti-file-spreadsheet', label: 'Export as CSV', action: 'auditCsv' },
        { icon: 'ti-clipboard', label: 'Copy all to clipboard', action: 'auditCopy' },
        { icon: '', label: '---', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
        { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
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
        { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
      ];
    }
    if (route === 'team') {
      return [
        { icon: 'ti-file-export', label: 'Export task list (CSV)', action: 'dashboardTasksCsv' },
        { icon: '', label: '---', action: 'shortcuts' },
        { icon: 'ti-keyboard', label: 'Keyboard shortcuts', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
        { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
      ];
    }
    if (route === 'settings') {
      return [
        { icon: 'ti-keyboard', label: 'Keyboard shortcuts', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
        { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
      ];
    }
    if (route === 'security') {
      return [
        { icon: 'ti-file-export', label: 'Export task list (CSV)', action: 'dashboardTasksCsv' },
        { icon: '', label: '---', action: 'shortcuts' },
        { icon: 'ti-keyboard', label: 'Keyboard shortcuts', action: 'shortcuts' },
        { icon: 'ti-help', label: 'Help & documentation', action: 'help' },
        { icon: 'ti-bug', label: 'Report a bug', action: 'bug' },
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
        this.menuService.openBoardFilterDialog();
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
    if (this.searchSuggestionsOpen()) {
      this.closeSearchSuggestions();
      return;
    }
    if (this.notificationsOpen()) this.closeNotifications();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.searchSuggestionsOpen() &&
      this.searchWrap &&
      !this.searchWrap.nativeElement.contains(event.target as Node)
    ) {
      this.closeSearchSuggestions();
    }
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
      logs: this.http
        .get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`)
        .pipe(catchError(() => of([] as AuditLogRow[]))),
      security: this.isOwner()
        ? this.http
            .get<{ alerts?: SecurityAlertItem[] } | SecurityAlertItem[]>(`${this.env.apiUrl}/security/alerts`)
            .pipe(catchError(() => of([] as SecurityAlertItem[])))
        : of([] as SecurityAlertItem[]),
    }).subscribe({
      next: ({ logs, security }) => {
        this.mergeTeamRosterFromAuditLogs(logs);
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

  private loadTeamRoster(): void {
    const current = this.auth.getCurrentUser();
    const seed = new Map<string, TeamMemberLite>();
    if (current?.id) {
      seed.set(current.id, this.toTeamMember(current.id, current.role?.name, current.email));
    }

    forkJoin({
      tasks: this.http.get<{
        data: Array<{
          status: string;
          assignedTo?: {
            id: string;
            name?: string;
            email?: string;
            role?: { name?: string };
          };
        }>;
      }>(`${this.env.apiUrl}/tasks?limit=500`),
      logs: this.http
        .get<AuditLogRow[]>(`${this.env.apiUrl}/audit-log`)
        .pipe(catchError(() => of([] as AuditLogRow[]))),
    }).subscribe({
      next: ({ tasks, logs }) => {
        const byId = new Map(seed);
        const open = tasks.data.filter(
          t => t.status === 'pending' || t.status === 'in-progress',
        ).length;
        this.boardBadge.set(open);

        for (const task of tasks.data) {
          const u = task.assignedTo;
          if (!u?.id || byId.has(u.id)) continue;
          byId.set(u.id, this.toTeamMember(u.id, u.role?.name, u.email));
        }

        for (const row of logs) {
          const u = row.user;
          if (!u?.id || byId.has(u.id)) continue;
          byId.set(u.id, this.toTeamMember(u.id, u.role?.name, u.email));
        }

        this.teamMembersById.set(byId);
        this.teamMembers.set([...byId.values()]);
      },
      error: () => {
        if (seed.size) {
          this.teamMembersById.set(seed);
          this.teamMembers.set([...seed.values()]);
        }
      },
    });
  }

  private mergeTeamRosterFromAuditLogs(logs: AuditLogRow[]): void {
    const byId = new Map(this.teamMembersById());
    for (const row of logs) {
      const u = row.user;
      if (!u?.id || byId.has(u.id)) continue;
      byId.set(u.id, this.toTeamMember(u.id, u.role?.name, u.email));
    }
    if (byId.size !== this.teamMembersById().size) {
      this.teamMembersById.set(byId);
      this.teamMembers.set([...byId.values()]);
    }
  }

  private toTeamMember(id: string, roleName?: string, email?: string): TeamMemberLite {
    const roleLabel = roleName?.trim() || 'member';
    return {
      id,
      roleLabel,
      displayName: roleDisplayName(roleLabel),
      email,
    };
  }

  private currentUserId(): string | undefined {
    return (
      this.auth.getCurrentUser()?.id ??
      sessionStorage.getItem('currentUserId') ??
      undefined
    );
  }

  private currentUserEmail(): string | undefined {
    return this.auth.getCurrentUser()?.email?.trim().toLowerCase();
  }

  private currentUserRole(): string | undefined {
    const fromAuth = this.auth.getCurrentUser()?.role?.name?.trim().toLowerCase();
    if (fromAuth) return fromAuth;
    const email = this.currentUserEmail();
    if (!email) return undefined;
    const local = email.split('@')[0]?.toLowerCase();
    const known = new Set(['owner', 'admin', 'manager', 'member', 'viewer']);
    return local && known.has(local) ? local : undefined;
  }

  private actorIdFromRow(row: AuditLogRow): string | undefined {
    return row.userId ?? row.user?.id;
  }

  private actorRoleFromRow(row: AuditLogRow): string | undefined {
    const actorId = this.actorIdFromRow(row);
    if (actorId) {
      const member = this.teamMembersById().get(actorId);
      if (member) return member.roleLabel.toLowerCase();
    }
    return row.user?.role?.name?.trim().toLowerCase();
  }

  /** True when the logged-in user performed this action. */
  private isOwnActivity(row: AuditLogRow): boolean {
    const actorId = this.actorIdFromRow(row);
    const currentId = this.currentUserId();
    if (currentId && actorId && actorId === currentId) return true;

    const actorEmail = row.user?.email?.trim().toLowerCase();
    const currentEmail = this.currentUserEmail();
    if (currentEmail && actorEmail && actorEmail === currentEmail) return true;

    return false;
  }

  /** True when another user with the same role performed this action (e.g. Member → Member). */
  private isPeerRoleActivity(row: AuditLogRow): boolean {
    if (this.isOwnActivity(row)) return false;
    const myRole = this.currentUserRole();
    const actorRole = this.actorRoleFromRow(row);
    return !!myRole && !!actorRole && myRole === actorRole;
  }

  private isVisibleNotification(row: AuditLogRow): boolean {
    return !this.isOwnActivity(row) && !this.isPeerRoleActivity(row);
  }

  private resolveNotificationActor(row: AuditLogRow): string | null {
    const action = row.action.toLowerCase();
    if (action === 'task:priority-escalated') return null;
    if (row.ipAddress === 'system' && !row.userId && !row.user?.id) return null;

    const userId = this.actorIdFromRow(row);
    if (!userId) return null;

    const member = this.teamMembersById().get(userId);
    if (member) return member.displayName;

    return roleDisplayName(row.user?.role?.name);
  }

  private notificationMessage(row: AuditLogRow): string {
    const action = row.action.toLowerCase();
    const meta = row.metadata ?? {};
    const title =
      (meta['title'] as string | undefined)?.trim() ||
      (row.resourceId ?? '').trim();
    const ip = row.ipAddress ?? 'unknown IP';
    const actor = this.resolveNotificationActor(row);
    const withActor = (body: string) => (actor ? `${actor} ${body}` : body);

    if (action === 'task:priority-escalated') {
      const newPriority = capitalizeWord(String(meta['newPriority'] ?? 'critical'));
      return title
        ? `"${title}" was escalated to ${newPriority}`
        : `A task was escalated to ${newPriority}`;
    }
    if (action === 'task:create') {
      return withActor(title ? `created task "${title}"` : 'created a new task');
    }
    if (action === 'task:update') {
      const priority = meta['priority'] as string | undefined;
      const oldPriority = meta['oldPriority'] as string | undefined;
      if (priority && title) {
        const next = capitalizeWord(priority);
        if (oldPriority) {
          return withActor(
            `changed priority of "${title}" from ${capitalizeWord(oldPriority)} to ${next}`,
          );
        }
        return withActor(`changed priority of "${title}" to ${next}`);
      }
      return withActor(title ? `updated task "${title}"` : 'updated a task');
    }
    if (action === 'task:delete') {
      return withActor(title ? `deleted task "${title}"` : 'deleted a task');
    }
    if (action === 'auth:login') {
      return withActor(`signed in from ${ip}`);
    }
    return '';
  }

  private buildTaskNotifItem(row: AuditLogRow): NotifItem | null {
    const action = row.action.toLowerCase();
    if (!ALLOWED_ACTIONS.has(action)) return null;

    const message = this.notificationMessage(row);
    if (!message) return null;

    let iconClass = 'notif-icon notif-icon--default';
    let iconName = 'ti-bell';
    let navAction: NotifItem['action'];

    if (action === 'task:create') {
      iconClass = 'notif-icon notif-icon--create';
      iconName = 'ti-circle-plus';
      navAction = 'board';
    } else if (action === 'task:update') {
      iconClass = 'notif-icon notif-icon--update';
      iconName = 'ti-edit';
      navAction = 'board';
    } else if (action === 'task:delete') {
      iconClass = 'notif-icon notif-icon--delete';
      iconName = 'ti-trash';
    } else if (action === 'task:priority-escalated') {
      iconClass = 'notif-icon notif-icon--escalate';
      iconName = 'ti-alert-triangle';
      navAction = 'board';
    } else if (action === 'auth:login') {
      iconClass = 'notif-icon notif-icon--login';
      iconName = 'ti-login';
      navAction = 'security';
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
      unread: !this.readNotifIds.has(row.id),
      action: navAction,
      resourceId: row.resourceId,
      rawAction: row.action,
      link:
        action === 'auth:login'
          ? '/audit?action=auth:login'
          : `/board${row.resourceId ? `?task=${encodeURIComponent(row.resourceId)}` : ''}`,
    };
  }

  private buildTaskItems(logs: AuditLogRow[]): NotifItem[] {
    const byDayUser = new Set<string>();
    return logs
      .filter(l => this.isVisibleNotification(l))
      .map(l => this.buildTaskNotifItem(l))
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
        link: '/security?focus=latest',
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
      link: '/security?focus=aggregate',
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

  /** Team members eligible to appear as demo notification actors for the current user. */
  private demoNotificationActors(): TeamMemberLite[] {
    const currentId = this.currentUserId();
    const currentRole = this.currentUserRole();
    return this.teamMembers().filter(m => {
      if (currentId && m.id === currentId) return false;
      if (currentRole && m.roleLabel.toLowerCase() === currentRole) return false;
      return true;
    });
  }

  private seedDemoNotifications(): NotifItem[] {
    const actors = this.demoNotificationActors();
    if (!actors.length) return [];
    const now = Date.now();
    const hours = (h: number) => new Date(now - h * 3_600_000).toISOString();
    const days = (d: number, hour = 12) => {
      const dt = new Date(now - d * 86_400_000);
      dt.setHours(hour, 34, 0, 0);
      return dt.toISOString();
    };

    const a0 = actors[0 % actors.length].displayName;
    const a1 = actors[1 % actors.length].displayName;
    const a2 = actors[2 % actors.length].displayName;

    const seeded: Array<Omit<NotifItem, 'unread'>> = [
      {
        id: 'mock-1',
        iconClass: 'notif-icon notif-icon--create',
        iconName: 'ti-circle-plus',
        message: `${a0} created task "Update API documentation"`,
        time: hours(2),
        date: new Date(hours(2)),
        action: 'board',
        rawAction: 'task:create',
        link: '/board?task=Update%20API%20documentation',
      },
      {
        id: 'mock-2',
        iconClass: 'notif-icon notif-icon--update',
        iconName: 'ti-edit',
        message: `${a1} changed priority of "Fix login bug" from Medium to High`,
        time: hours(5),
        date: new Date(hours(5)),
        action: 'board',
        rawAction: 'task:update',
        link: '/board?task=Fix%20login%20bug',
      },
      {
        id: 'mock-3',
        iconClass: 'notif-icon notif-icon--login',
        iconName: 'ti-login',
        message: 'New login from Chrome on Windows',
        time: days(1, 9),
        date: new Date(days(1, 9)),
        action: 'security',
        rawAction: 'auth:login',
        link: '/audit?action=auth:login',
      },
      {
        id: 'mock-4',
        iconClass: 'notif-icon notif-icon--escalate',
        iconName: 'ti-alert-triangle',
        message: '"Database migration" was escalated to Critical',
        time: days(1, 15),
        date: new Date(days(1, 15)),
        action: 'board',
        rawAction: 'task:priority-escalated',
        link: '/board?task=Database%20migration',
      },
      {
        id: 'mock-5',
        iconClass: 'notif-icon notif-icon--security',
        iconName: 'ti-alert-triangle',
        message: '2 security alerts require review',
        time: days(2, 10),
        date: new Date(days(2, 10)),
        action: 'security',
        rawAction: 'security',
        link: '/security?focus=aggregate',
      },
      {
        id: 'mock-6',
        iconClass: 'notif-icon notif-icon--default',
        iconName: 'ti-trash',
        message: `${a2} deleted task "Old backup script"`,
        time: days(3, 14),
        date: new Date(days(3, 14)),
        action: 'board',
        rawAction: 'task:delete',
        link: '/board',
      },
      {
        id: 'mock-7',
        iconClass: 'notif-icon notif-icon--create',
        iconName: 'ti-circle-plus',
        message: `${a0} created task "Design system audit"`,
        time: days(3, 11),
        date: new Date(days(3, 11)),
        action: 'board',
        rawAction: 'task:create',
        link: '/board?task=Design%20system%20audit',
      },
    ];

    return seeded
      .map(item => ({ ...item, isMock: true, unread: !this.readNotifIds.has(item.id) }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }

}
