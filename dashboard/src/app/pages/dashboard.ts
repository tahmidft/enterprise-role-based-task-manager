import { NestedTreeControl } from '@angular/cdk/tree';
import { moveItemInArray, CdkDragDrop } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTreeNestedDataSource, MatTreeModule } from '@angular/material/tree';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AuthService } from '../../../services/auth';
import { EnvironmentService } from '../../../services/environment';
import { IUser, IRole } from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';
import {
  evmPillClass,
  evmTrafficFromValue,
  priorityChipClass,
  floatClass,
  priorityPillClass,
  priorityToneClass,
  statusChipClass,
  statusPillClass,
  varianceClass,
} from '../shared/task-ui';
import { TaskCreateDialogComponent, TaskDialogData } from '../shared/task-create-dialog.component';
import {
  CpmGanttChartComponent,
  CpmGanttScheduleTask,
  CpmGanttTaskMeta,
} from '../shared/cpm-gantt-chart.component';

interface UserWithRole extends IUser {
  role?: IRole & { permissions?: Array<{ name: string }> };
}

interface TaskModel {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  completionPercent: number;
  budgetHours: number;
  actualHours: number;
  startDate?: string;
  dueDate?: string;
  assignedToId?: string;
  assignedTo?: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    role?: { name?: string };
  };
  parentTaskId?: string;
  projectId?: string;
  dependsOn?: Array<{ id: string }>;
  children?: TaskModel[];
}

interface EvmResponse {
  pv: number;
  ev: number;
  ac: number;
  spi: number;
  cpi: number;
  eac: number;
}

interface CriticalPathResponse {
  nodes: Array<{ taskId: string; title: string; float: number; duration?: number }>;
  criticalTaskIds: string[];
  criticalEdges: Array<{ from: string; to: string }>;
}

interface ResourceLevelingResponse {
  suggestions: Array<{ taskId: string; taskTitle: string; suggestion: string }>;
}

interface EvmPill {
  class: string;
  label: string;
}

interface WbsTeamMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatTableModule,
    MatTreeModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    FormsModule,
    DragDropModule,
    CpmGanttChartComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private env = inject(EnvironmentService);
  private apiUrl = this.env.apiUrl;
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  currentUser = signal<UserWithRole | null>(null);
  tasks = signal<TaskModel[]>([]);
  loading = signal(false);
  evm = signal<EvmResponse | null>(null);
  criticalPath = signal<CriticalPathResponse | null>(null);
  cpmLoading = signal(false);
  evmAccessLimited = signal(false);
  resourceSuggestions = signal<ResourceLevelingResponse['suggestions']>([]);
  dismissedSuggestionIds = signal<Set<string>>(new Set());
  projectId = signal<string | null>(null);
  floatByTaskId = signal<Record<string, number>>({});
  editedHours = signal<Map<string, number>>(new Map());
  editingHoursId = signal<string | null>(null);
  teamMembers = signal<WbsTeamMember[]>([]);
  assigneePickerTaskId = signal<string | null>(null);

  userById = computed(() => {
    const map = new Map<string, WbsTeamMember>();
    for (const m of this.teamMembers()) {
      map.set(m.id, m);
    }
    return map;
  });

  treeControl = new NestedTreeControl<TaskModel>(node => node.children ?? []);
  treeDataSource = new MatTreeNestedDataSource<TaskModel>();
  hasChild = (_: number, node: TaskModel) => !!node.children && node.children.length > 0;

  readonly displayedColumns = [
    'title',
    'status',
    'priority',
    'completionPercent',
    'budgetHours',
    'actualHours',
    'variance',
    'float',
  ];
  readonly statusClass = statusChipClass;
  readonly priorityClass = priorityChipClass;
  readonly statusPill = statusPillClass;
  readonly priorityPill = priorityPillClass;
  readonly rowTone = priorityToneClass;
  readonly varianceCls = varianceClass;
  readonly floatCls = floatClass;

  ngOnInit(): void {
    const user = this.authService.getCurrentUser() as UserWithRole;
    this.currentUser.set(user);
    this.loadTeamMembers();
    this.loadTasksAndProject();
  }

  @HostListener('document:click')
  closeAssigneePicker(): void {
    this.assigneePickerTaskId.set(null);
  }

  showPvWarning(): boolean {
    const role = this.currentUser()?.role?.name;
    const privileged = role === 'owner' || role === 'admin';
    return privileged && (this.evm()?.pv ?? 1) === 0;
  }

  averageCompletion(): number {
    const list = this.tasks();
    if (!list.length) return 0;
    const sum = list.reduce((a, t) => a + (t.completionPercent ?? 0), 0);
    return Math.round(sum / list.length);
  }

  evmPvPill(): EvmPill {
    return { class: 'pill pill-green', label: 'Baseline' };
  }

  evmEvPill(): EvmPill {
    return {
      class: 'pill pill-amber',
      label: `${this.averageCompletion()}% complete`,
    };
  }

  evmAcPill(evm: EvmResponse): EvmPill {
    if (evm.ac > evm.pv && evm.pv > 0) {
      return { class: 'pill pill-red', label: 'Over budget' };
    }
    return { class: 'pill pill-green', label: 'On track' };
  }

  spiCardTone(): string {
    return 'evm-card--primary';
  }

  spiPill(spi: number): EvmPill {
    const level = evmTrafficFromValue(spi);
    const labels: Record<string, string> = {
      green: 'Ahead',
      amber: 'On schedule',
      red: 'Behind',
    };
    return { class: evmPillClass(level), label: labels[level] };
  }

  cpiCardTone(cpi: number): string {
    return cpi < 1 ? 'evm-card--error' : 'evm-card--primary';
  }

  cpiPill(cpi: number): EvmPill {
    if (cpi > 1) return { class: 'pill pill-green', label: 'Efficient' };
    if (cpi >= 0.9) return { class: 'pill pill-amber', label: 'On budget' };
    return { class: 'pill pill-red', label: 'At risk' };
  }

  eacPill(evm: EvmResponse): EvmPill {
    if (evm.eac > evm.pv && evm.pv > 0) {
      return { class: 'pill pill-red', label: 'Over baseline' };
    }
    return { class: 'pill pill-amber', label: 'Forecast' };
  }

  variance(row: TaskModel): number {
    return (row.budgetHours ?? 0) - (row.actualHours ?? 0);
  }

  taskFloat(row: TaskModel): number | null {
    const f = this.floatByTaskId()[row.id];
    return f === undefined ? null : f;
  }

  cpmTaskMeta(): CpmGanttTaskMeta[] {
    return this.tasks().map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      completionPercent: t.completionPercent ?? 0,
      budgetHours: t.budgetHours ?? 1,
      dependsOn: t.dependsOn,
      startDate: t.startDate,
      dueDate: t.dueDate,
    }));
  }

  onGanttTaskClick(task: CpmGanttScheduleTask): void {
    const row = this.tasks().find(t => t.id === task.id);
    if (!row) return;
    const ref = this.dialog.open(TaskCreateDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '520px',
      data: {
        taskId: row.id,
        projectId: row.projectId,
        prefill: {
          title: row.title,
          description: row.description,
          status: row.status,
          priority: row.priority,
          budgetHours: row.budgetHours,
          actualHours: row.actualHours,
          completionPercent: row.completionPercent,
          assignedToId: row.assignedToId,
        },
      } satisfies TaskDialogData,
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        this.snackBar.open('Task updated', 'Close', { duration: 3000 });
        this.loadTasksAndProject();
      }
    });
  }

  createSubtask(parent: TaskModel): void {
    const ref = this.dialog.open(TaskCreateDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '520px',
      data: {
        parentTaskId: parent.id,
        parentTitle: parent.title,
        projectId: parent.projectId,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        this.snackBar.open('Subtask created', 'Close', { duration: 3000 });
        this.loadTasksAndProject();
      }
    });
  }

  /** WBS helpers ———————————————————————— */

  dateRange(node: TaskModel): string {
    if (!node.startDate && !node.dueDate) return '';
    const fmt = (s: string) => {
      const d = new Date(s);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    if (!node.dueDate) return fmt(node.startDate!);
    if (!node.startDate) return `Due ${fmt(node.dueDate)}`;
    return `${fmt(node.startDate)} – ${fmt(node.dueDate)}`;
  }

  /** Return the effective hours: edited value or the original budgetHours. */
  getHours(node: TaskModel): number {
    return this.editedHours().get(node.id) ?? node.budgetHours ?? 0;
  }

  /** Return the effective budget label. */
  budgetLabel(node: TaskModel): string {
    return `${this.getHours(node)}h`;
  }

  /** Sum of the node's own effective hours plus all descendant hours. */
  getTotalHours(node: TaskModel): number {
    const subs = this.collectDescendants(node);
    const self = this.getHours(node);
    const subTotal = subs.reduce((s, t) => s + this.getHours(t), 0);
    return self + subTotal;
  }

  totalBudgetLabel(node: TaskModel): string {
    return `${this.getTotalHours(node)}h`;
  }

  subtaskCount(node: TaskModel): number {
    return node.children?.length ?? 0;
  }

  /** Weighted average completion of all descendant tasks by budget hours. */
  aggregateCompletion(node: TaskModel): number {
    const descendants = this.collectDescendants(node);
    if (!descendants.length) return node.completionPercent ?? 0;
    const totalHours = descendants.reduce((s, t) => s + this.getHours(t), 0);
    if (totalHours === 0) {
      return Math.round(
        descendants.reduce((s, t) => s + (t.completionPercent ?? 0), 0) / descendants.length,
      );
    }
    const weighted = descendants.reduce(
      (s, t) => s + (t.completionPercent ?? 0) * this.getHours(t),
      0,
    );
    return Math.round(weighted / totalHours);
  }

  /** True when the task is past its due date and not completed. */
  isOverdue(node: TaskModel): boolean {
    if (node.status === 'completed' || !node.dueDate) return false;
    const due = new Date(node.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return due < now;
  }

  /** Multi-line tooltip string for a task row. */
  rowTooltip(node: TaskModel): string {
    const lines: string[] = [`▸ ${node.title}`];
    if (node.description) lines.push(`  ${node.description}`);
    lines.push(`  Status: ${node.status}`);
    if (node.startDate || node.dueDate) lines.push(`  Dates: ${this.dateRange(node)}`);
    lines.push(`  Budget: ${this.getHours(node)}h`);
    if (node.actualHours != null) lines.push(`  Actual: ${node.actualHours}h`);
    const assignee = this.resolveMember(node);
    if (assignee) lines.push(`  Assignee: ${assignee.name}`);
    const blocked = this.blockedByLabel(node);
    if (blocked) lines.push(`  ${blocked}`);
    const blocks = this.blocksLabel(node);
    if (blocks) lines.push(`  ${blocks}`);
    lines.push(`  Completion: ${node.completionPercent ?? 0}%`);
    const children = this.subtaskCount(node);
    if (children > 0) lines.push(`  Subtasks: ${children}`);
    if (this.isOverdue(node)) lines.push(`  ⚠ Overdue`);
    return lines.join('\n');
  }

  /** Start inline editing of the hours pill. */
  startEditHours(node: TaskModel): void {
    this.editingHoursId.set(node.id);
  }

  /** Save the inline-edited hours value. */
  saveHours(node: TaskModel, value: string): void {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      const next = new Map(this.editedHours());
      next.set(node.id, parsed);
      this.editedHours.set(next);
    }
    this.editingHoursId.set(null);
  }

  /** Cancel inline editing (e.g. on Escape). */
  cancelEditHours(): void {
    this.editingHoursId.set(null);
  }

  /** Track-by for tree nodes — needed after drag-reorder. */
  wbsTrackBy(_index: number, node: TaskModel): string {
    return node.id;
  }

  /** Handle drag-drop reorder within a drop-list. */
  drop(event: CdkDragDrop<TaskModel[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    this.treeDataSource.data = [...this.treeDataSource.data];
  }

  /** Expand all parent nodes in the tree. */
  expandAllNodes(): void {
    const expandRecursive = (nodes: TaskModel[]) => {
      for (const node of nodes) {
        if (node.children?.length) {
          this.treeControl.expand(node);
          expandRecursive(node.children);
        }
      }
    };
    expandRecursive(this.treeDataSource.data);
  }

  toggleAssigneePicker(node: TaskModel, event: MouseEvent): void {
    event.stopPropagation();
    this.assigneePickerTaskId.set(
      this.assigneePickerTaskId() === node.id ? null : node.id,
    );
  }

  resolveMember(node: TaskModel): WbsTeamMember | null {
    if (!node.assignedToId) return null;
    const cached = this.userById().get(node.assignedToId);
    if (cached) return cached;
    const u = node.assignedTo;
    if (u?.id) {
      return this.memberFromUser(u.id, u.role?.name, u.email, u.avatarUrl);
    }
    return null;
  }

  assigneeInitials(node: TaskModel): string {
    return this.resolveMember(node)?.initials ?? '';
  }

  assigneeColor(node: TaskModel): string {
    return this.resolveMember(node)?.color ?? '';
  }

  assigneeAvatarUrl(node: TaskModel): string | null {
    const url = this.resolveMember(node)?.avatarUrl;
    return url?.trim() ? url : null;
  }

  assignTask(node: TaskModel, userId: string | null): void {
    this.assigneePickerTaskId.set(null);
    this.http
      .put(`${this.apiUrl}/tasks/${node.id}`, { assignedToId: userId })
      .subscribe({
        next: () => {
          this.patchTaskAssignee(node.id, userId);
          this.snackBar.open('Assignee updated', 'Close', { duration: 3000 });
        },
        error: () =>
          this.snackBar.open('Could not update assignee', 'Close', { duration: 3000 }),
      });
  }

  private patchTaskAssignee(taskId: string, userId: string | null): void {
    const member = userId ? this.userById().get(userId) : undefined;
    const patchNodes = (nodes: TaskModel[]): TaskModel[] =>
      nodes.map(n => {
        if (n.id === taskId) {
          return {
            ...n,
            assignedToId: userId ?? undefined,
            assignedTo: member
              ? {
                  id: member.id,
                  name: member.name,
                  email: member.email,
                  avatarUrl: member.avatarUrl,
                }
              : undefined,
          };
        }
        if (n.children?.length) {
          return { ...n, children: patchNodes(n.children) };
        }
        return n;
      });

    this.treeDataSource.data = patchNodes(this.treeDataSource.data);
    this.tasks.set(this.flattenTree(this.treeDataSource.data));
  }

  private loadTeamMembers(): void {
    const roster = new Map<string, WbsTeamMember>();
    const current = this.currentUser() ?? (this.authService.getCurrentUser() as UserWithRole);
    if (current?.id) {
      roster.set(
        current.id,
        this.memberFromUser(current.id, current.role?.name, current.email),
      );
    }

    this.http
      .get<{
        data: Array<{
          assignedTo?: {
            id: string;
            name?: string;
            email?: string;
            avatarUrl?: string;
            role?: { name?: string };
          };
        }>;
      }>(`${this.apiUrl}/tasks?limit=500`)
      .subscribe({
        next: ({ data }) => {
          for (const task of data) {
            const u = task.assignedTo;
            if (u?.id && !roster.has(u.id)) {
              roster.set(
                u.id,
                this.memberFromUser(u.id, u.role?.name, u.email, u.avatarUrl),
              );
            }
          }
          this.teamMembers.set([...roster.values()]);
          if (this.treeDataSource.data.length) {
            this.mergeAssigneesFromTree(this.treeDataSource.data);
          }
        },
        error: () => {
          if (roster.size) {
            this.teamMembers.set([...roster.values()]);
          }
        },
      });
  }

  private mergeAssigneesFromTree(nodes: TaskModel[]): void {
    const roster = new Map(this.teamMembers().map(m => [m.id, m]));
    const walk = (list: TaskModel[]) => {
      for (const n of list) {
        const u = n.assignedTo;
        if (n.assignedToId && u?.id && !roster.has(u.id)) {
          roster.set(
            u.id,
            this.memberFromUser(u.id, u.role?.name, u.email, u.avatarUrl),
          );
        }
        if (n.children?.length) walk(n.children);
      }
    };
    walk(nodes);
    if (roster.size !== this.teamMembers().length) {
      this.teamMembers.set([...roster.values()]);
    }
  }

  private memberFromUser(
    id: string,
    roleName?: string,
    email?: string,
    avatarUrl?: string,
  ): WbsTeamMember {
    const roleLabel = roleName?.trim() || 'member';
    const display =
      roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1).toLowerCase();
    return {
      id,
      name: display,
      email: email ?? '',
      initials: display.slice(0, 2).toUpperCase(),
      color: this.colorFromId(id),
      avatarUrl: avatarUrl?.trim() || undefined,
    };
  }

  private colorFromId(id: string): string {
    const colors = [
      '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab',
      '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047',
      '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00', '#f4511e',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /** True when the task's actual hours exceed its planned budget. */
  isOverBudget(node: TaskModel): boolean {
    return (node.actualHours ?? 0) > (node.budgetHours ?? 0);
  }

  /** Return a "Blocked by: …" label when this task depends on another. */
  blockedByLabel(node: TaskModel): string | null {
    if (!node.dependsOn?.length) return null;
    const names = node.dependsOn
      .map(d => this.tasks().find(t => t.id === d.id))
      .filter((t): t is TaskModel => !!t)
      .map(t => t.title);
    return names.length ? `Blocked by: ${names.join(', ')}` : null;
  }

  /** Return a "Blocks: …" label when another task depends on this one. */
  blocksLabel(node: TaskModel): string | null {
    const blocked = this.tasks().filter(
      t => t.dependsOn?.some(d => d.id === node.id) && t.id !== node.id,
    );
    return blocked.length ? `Blocks: ${blocked.map(t => t.title).join(', ')}` : null;
  }

  private collectDescendants(node: TaskModel): TaskModel[] {
    const out: TaskModel[] = [];
    const walk = (list: TaskModel[] | undefined) => {
      if (!list) return;
      for (const n of list) {
        out.push(n);
        walk(n.children);
      }
    };
    walk(node.children);
    return out;
  }

  visibleSuggestions() {
    const dismissed = this.dismissedSuggestionIds();
    return this.resourceSuggestions().filter(s => !dismissed.has(s.taskId));
  }

  dismissSuggestion(taskId: string): void {
    const next = new Set(this.dismissedSuggestionIds());
    next.add(taskId);
    this.dismissedSuggestionIds.set(next);
  }

  loadTasksAndProject(): void {
    this.loading.set(true);
    this.http.get<{ data: TaskModel[] }>(`${this.apiUrl}/tasks?tree=true&limit=500`).subscribe({
      next: ({ data }) => {
        this.mergeAssigneesFromTree(data);
        const flat = this.flattenTree(data);
        this.tasks.set(flat);
        this.treeDataSource.data = data;
        this.expandAllNodes();
        const firstProjectId = flat.find(t => t.projectId)?.projectId ?? null;
        this.projectId.set(firstProjectId);
        if (firstProjectId) this.loadProjectAnalytics(firstProjectId);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadProjectAnalytics(projectId: string): void {
    this.http.get<EvmResponse>(`${this.apiUrl}/projects/${projectId}/evm`).subscribe({
      next: r => {
        this.evmAccessLimited.set(false);
        this.evm.set(r);
      },
      error: err => {
        if (err?.status === 403) {
          this.evmAccessLimited.set(true);
          this.evm.set({ pv: 0, ev: 0, ac: 0, spi: 0, cpi: 0, eac: 0 });
        }
      },
    });
    this.cpmLoading.set(true);
    this.http
      .get<CriticalPathResponse>(`${this.apiUrl}/projects/${projectId}/critical-path`)
      .subscribe(r => {
        this.criticalPath.set(r);
        this.cpmLoading.set(false);
        const floats: Record<string, number> = {};
        for (const n of r.nodes) {
          floats[n.taskId] = n.float;
        }
        this.floatByTaskId.set(floats);
      });
    this.http
      .get<ResourceLevelingResponse>(`${this.apiUrl}/projects/${projectId}/resource-leveling`)
      .subscribe(r => this.resourceSuggestions.set(r.suggestions));
  }

  private flattenTree(nodes: TaskModel[]): TaskModel[] {
    const out: TaskModel[] = [];
    const walk = (list: TaskModel[]) => {
      for (const n of list) {
        const { children, ...rest } = n;
        out.push(rest as TaskModel);
        if (children?.length) walk(children);
      }
    };
    walk(nodes);
    return out;
  }

}
