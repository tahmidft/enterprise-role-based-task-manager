import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { NestedTreeControl } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTreeNestedDataSource, MatTreeModule } from '@angular/material/tree';
import cytoscape, { type Core } from 'cytoscape';
// @ts-expect-error cytoscape extension has no bundled types
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);
import { AuthService } from '../../../services/auth';
import { EnvironmentService } from '../../../services/environment';
import { IUser, IRole } from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';

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
  assignedToId?: string;
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

interface SecurityAlertItem {
  id: string;
  userId: string;
  userEmail?: string;
  riskScore: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
  reviewed: boolean;
  createdAt: string;
}

interface SecurityAlertsResponse {
  alerts: SecurityAlertItem[];
  unreadCount: number;
}

interface ResourceLevelingResponse {
  suggestions: Array<{ taskId: string; taskTitle: string; suggestion: string }>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatTableModule,
    MatTreeModule,
    MatBadgeModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private env = inject(EnvironmentService);
  private route = inject(ActivatedRoute);
  private apiUrl = this.env.apiUrl;

  @ViewChild('graphContainer') graphContainer?: ElementRef<HTMLDivElement>;
  private cy?: Core;

  currentUser = signal<UserWithRole | null>(null);
  tasks = signal<TaskModel[]>([]);
  loading = signal(false);
  evm = signal<EvmResponse | null>(null);
  criticalPath = signal<CriticalPathResponse | null>(null);
  securityAlerts = signal<SecurityAlertsResponse['alerts']>([]);
  resourceSuggestions = signal<ResourceLevelingResponse['suggestions']>([]);
  dismissedSuggestionIds = signal<Set<string>>(new Set());
  isOwner = signal(false);

  projectId = signal<string | null>(null);
  securityBadge = signal(0);

  treeControl = new NestedTreeControl<TaskModel>(node => node.children ?? []);
  treeDataSource = new MatTreeNestedDataSource<TaskModel>();
  hasChild = (_: number, node: TaskModel) => !!node.children && node.children.length > 0;

  pending = signal<TaskModel[]>([]);
  inProgress = signal<TaskModel[]>([]);
  done = signal<TaskModel[]>([]);
  readonly displayedColumns = ['title', 'status', 'priority', 'completionPercent', 'budgetHours', 'actualHours'];

  ngOnInit(): void {
    const user = this.authService.getCurrentUser() as UserWithRole;
    this.currentUser.set(user);
    this.isOwner.set(user?.role?.name === 'owner');
    this.loadTasksAndProject();
    this.route.fragment.subscribe(fragment => {
      if (fragment === 'security') {
        setTimeout(() => document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' }), 300);
      }
    });
  }

  createSubtask(parent: TaskModel): void {
    const title = window.prompt('Subtask title');
    if (!title?.trim()) return;
    this.http
      .post(`${this.apiUrl}/tasks`, {
        title: title.trim(),
        description: `Subtask of ${parent.title}`,
        status: 'pending',
        priority: 'medium',
        parentTaskId: parent.id,
        projectId: parent.projectId,
        budgetHours: 8,
        actualHours: 0,
        completionPercent: 0,
      })
      .subscribe(() => this.loadTasksAndProject());
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

  markAlertReviewed(alertId: string): void {
    this.http.patch(`${this.apiUrl}/security/alerts/${alertId}/reviewed`, {}).subscribe(() => {
      this.securityAlerts.update(alerts =>
        alerts.map(a => (a.id === alertId ? { ...a, reviewed: true } : a)),
      );
      this.securityBadge.update(
        () => this.securityAlerts().filter(a => !a.reviewed && a.level === 'HIGH').length,
      );
    });
  }

  loadTasksAndProject(): void {
    this.loading.set(true);
    this.http
      .get<{ data: TaskModel[] }>(`${this.apiUrl}/tasks?tree=true&limit=500`)
      .subscribe({
        next: ({ data }) => {
          const flat = this.flattenTree(data);
          this.tasks.set(flat);
          this.deriveBoardColumns(flat);
          this.treeDataSource.data = data;
          const firstProjectId = flat.find(t => t.projectId)?.projectId ?? null;
          this.projectId.set(firstProjectId);
          if (firstProjectId) this.loadProjectAnalytics(firstProjectId);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  loadProjectAnalytics(projectId: string): void {
    this.http.get<EvmResponse>(`${this.apiUrl}/projects/${projectId}/evm`).subscribe(r => this.evm.set(r));
    this.http.get<CriticalPathResponse>(`${this.apiUrl}/projects/${projectId}/critical-path`).subscribe(r => {
      this.criticalPath.set(r);
      setTimeout(() => this.renderCpmGraph(), 0);
    });
    this.http
      .get<ResourceLevelingResponse>(`${this.apiUrl}/projects/${projectId}/resource-leveling`)
      .subscribe(r => this.resourceSuggestions.set(r.suggestions));
    if (this.isOwner()) {
      this.http.get<SecurityAlertsResponse>(`${this.apiUrl}/security/alerts`).subscribe(r => {
        this.securityAlerts.set(r.alerts);
        this.securityBadge.set(r.unreadCount ?? r.alerts.filter(a => !a.reviewed && a.level === 'HIGH').length);
      });
    }
  }

  evmStatus(value: number): 'green' | 'yellow' | 'red' {
    if (value > 1) return 'green';
    if (value >= 0.9) return 'yellow';
    return 'red';
  }

  drop(event: CdkDragDrop<TaskModel[]>, status: 'pending' | 'in-progress' | 'completed') {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    const task = event.container.data[event.currentIndex];
    task.status = status;
    this.http.put(`${this.apiUrl}/tasks/${task.id}`, { status }).subscribe();
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

  private deriveBoardColumns(tasks: TaskModel[]) {
    this.pending.set(tasks.filter(t => t.status === 'pending'));
    this.inProgress.set(tasks.filter(t => t.status === 'in-progress'));
    this.done.set(tasks.filter(t => t.status === 'completed'));
  }

  private renderCpmGraph(): void {
    if (!this.graphContainer?.nativeElement || !this.criticalPath()) return;
    const cp = this.criticalPath()!;
    const floatById = new Map(cp.nodes.map(n => [n.taskId, n.float]));
    const durationById = new Map(cp.nodes.map(n => [n.taskId, n.duration ?? 1]));
    const allTasks = this.tasks();
    const taskNodes = allTasks.map(task => {
      const float = floatById.get(task.id) ?? 0;
      const duration = durationById.get(task.id) ?? task.budgetHours ?? 1;
      return {
        data: {
          id: task.id,
          label: `${task.title}\n${duration}d · float ${float.toFixed(1)}`,
        },
      };
    });
    const edges = allTasks.flatMap(task =>
      (task.dependsOn ?? []).map(dep => ({
        data: { id: `${dep.id}-${task.id}`, source: dep.id, target: task.id },
      })),
    );

    this.cy?.destroy();
    const container = this.graphContainer.nativeElement;
    this.cy = cytoscape({
      container,
      elements: [...taskNodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': '#1976D2',
            color: '#fff',
            'font-size': 10,
            width: 28,
            height: 28,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#90A4AE',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#90A4AE',
            'curve-style': 'bezier',
          },
        },
        {
          selector: '.critical',
          style: {
            'background-color': '#d32f2f',
            'line-color': '#d32f2f',
            'target-arrow-color': '#d32f2f',
          },
        },
      ],
      minZoom: 0.4,
      maxZoom: 2,
      wheelSensitivity: 0.2,
    });

    cp.criticalTaskIds.forEach(id => this.cy?.$id(id).addClass('critical'));
    cp.criticalEdges.forEach(e => this.cy?.$id(`${e.from}-${e.to}`).addClass('critical'));

    const layout = this.cy.layout({
      name: 'dagre',
      rankDir: 'LR',
      padding: 20,
      fit: true,
    } as cytoscape.LayoutOptions);
    layout.run();
    const fitGraph = () => {
      this.cy?.resize();
      this.cy?.fit(undefined, 24);
    };
    layout.on('layoutstop', fitGraph);
    requestAnimationFrame(() => requestAnimationFrame(fitGraph));
  }

}
