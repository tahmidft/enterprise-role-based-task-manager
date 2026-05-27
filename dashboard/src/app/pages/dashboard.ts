import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { NestedTreeControl } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
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
import { AuthService } from '../../../services/auth';
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
  nodes: Array<{ taskId: string; title: string; float: number }>;
  criticalTaskIds: string[];
  criticalEdges: Array<{ from: string; to: string }>;
}

interface SecurityAlertsResponse {
  alerts: Array<{
    userId: string;
    userEmail?: string;
    riskScore: number;
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    reasons: string[];
  }>;
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
  private readonly API_URL = 'http://localhost:3333/api';

  @ViewChild('graphContainer') graphContainer?: ElementRef<HTMLDivElement>;
  private cy?: Core;

  currentUser = signal<UserWithRole | null>(null);
  tasks = signal<TaskModel[]>([]);
  loading = signal(false);
  evm = signal<EvmResponse | null>(null);
  criticalPath = signal<CriticalPathResponse | null>(null);
  securityAlerts = signal<SecurityAlertsResponse['alerts']>([]);
  resourceSuggestions = signal<ResourceLevelingResponse['suggestions']>([]);

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
    this.currentUser.set(this.authService.getCurrentUser() as UserWithRole);
    this.loadTasksAndProject();
  }

  loadTasksAndProject(): void {
    this.loading.set(true);
    this.http
      .get<{ data: TaskModel[] }>(`${this.API_URL}/tasks?page=1&limit=200`)
      .subscribe({
        next: ({ data }) => {
          this.tasks.set(data);
          this.deriveBoardColumns(data);
          this.treeDataSource.data = this.buildTree(data);
          const firstProjectId = data.find(t => t.projectId)?.projectId ?? null;
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
    this.http.get<EvmResponse>(`${this.API_URL}/projects/${projectId}/evm`).subscribe(r => this.evm.set(r));
    this.http.get<CriticalPathResponse>(`${this.API_URL}/projects/${projectId}/critical-path`).subscribe(r => {
      this.criticalPath.set(r);
      setTimeout(() => this.renderCpmGraph(), 0);
    });
    this.http
      .get<ResourceLevelingResponse>(`${this.API_URL}/projects/${projectId}/resource-leveling`)
      .subscribe(r => this.resourceSuggestions.set(r.suggestions));
    this.http.get<SecurityAlertsResponse>(`${this.API_URL}/security/alerts`).subscribe(r => {
      this.securityAlerts.set(r.alerts);
      this.securityBadge.set(r.alerts.filter(a => a.level === 'HIGH').length);
    });
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
    this.http.put(`${this.API_URL}/tasks/${task.id}`, { status }).subscribe();
  }

  private deriveBoardColumns(tasks: TaskModel[]) {
    this.pending.set(tasks.filter(t => t.status === 'pending'));
    this.inProgress.set(tasks.filter(t => t.status === 'in-progress'));
    this.done.set(tasks.filter(t => t.status === 'completed'));
  }

  private buildTree(tasks: TaskModel[]): TaskModel[] {
    const byId = new Map(tasks.map(t => [t.id, { ...t, children: [] as TaskModel[] }]));
    const roots: TaskModel[] = [];
    for (const task of byId.values()) {
      if (task.parentTaskId && byId.has(task.parentTaskId)) {
        byId.get(task.parentTaskId)!.children!.push(task);
      } else {
        roots.push(task);
      }
    }
    return roots;
  }

  private renderCpmGraph(): void {
    if (!this.graphContainer?.nativeElement || !this.criticalPath()) return;
    const cp = this.criticalPath()!;
    const allTasks = this.tasks();
    const taskNodes = allTasks.map(task => ({ data: { id: task.id, label: task.title } }));
    const edges = allTasks.flatMap(task =>
      (task.dependsOn ?? []).map(dep => ({
        data: { id: `${dep.id}-${task.id}`, source: dep.id, target: task.id },
      })),
    );

    this.cy?.destroy();
    this.cy = cytoscape({
      container: this.graphContainer.nativeElement,
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
      layout: { name: 'breadthfirst', directed: true, padding: 20 },
    });

    cp.criticalTaskIds.forEach(id => this.cy?.$id(id).addClass('critical'));
    cp.criticalEdges.forEach(e => this.cy?.$id(`${e.from}-${e.to}`).addClass('critical'));
  }

  logout(): void {
    this.authService.logout();
  }
}
