import { NestedTreeControl } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTreeNestedDataSource, MatTreeModule } from '@angular/material/tree';
import cytoscape, { type Core } from 'cytoscape';
// @ts-expect-error cytoscape extension has no bundled types
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

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
import { TaskCreateDialogComponent } from '../shared/task-create-dialog.component';

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

interface ResourceLevelingResponse {
  suggestions: Array<{ taskId: string; taskTitle: string; suggestion: string }>;
}

interface EvmPill {
  class: string;
  label: string;
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

  @ViewChild('graphContainer') graphContainer?: ElementRef<HTMLDivElement>;
  private cy?: Core;

  currentUser = signal<UserWithRole | null>(null);
  tasks = signal<TaskModel[]>([]);
  loading = signal(false);
  evm = signal<EvmResponse | null>(null);
  criticalPath = signal<CriticalPathResponse | null>(null);
  cpmLoading = signal(false);
  cpmEmpty = signal(false);
  evmAccessLimited = signal(false);
  resourceSuggestions = signal<ResourceLevelingResponse['suggestions']>([]);
  dismissedSuggestionIds = signal<Set<string>>(new Set());
  projectId = signal<string | null>(null);
  floatByTaskId = signal<Record<string, number>>({});

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
    this.loadTasksAndProject();
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
        const flat = this.flattenTree(data);
        this.tasks.set(flat);
        this.treeDataSource.data = data;
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
        this.cpmEmpty.set((r.nodes?.length ?? 0) === 0);
        const floats: Record<string, number> = {};
        for (const n of r.nodes) {
          floats[n.taskId] = n.float;
        }
        this.floatByTaskId.set(floats);
        setTimeout(() => this.renderCpmGraph(), 0);
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

  private renderCpmGraph(): void {
    if (!this.graphContainer?.nativeElement || !this.criticalPath()) return;
    const cp = this.criticalPath()!;
    if (!cp.nodes?.length) {
      this.cy?.destroy();
      return;
    }
    const criticalNodeIds = new Set(cp.criticalTaskIds);
    const criticalEdgeKeys = new Set(cp.criticalEdges.map(e => `${e.from}-${e.to}`));
    const nodeIds = new Set(cp.nodes.map(n => n.taskId));
    const primaryColor =
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6750A4';

    const taskNodes = cp.nodes.map(node => ({
      data: { id: node.taskId, label: node.title },
      classes: criticalNodeIds.has(node.taskId) ? 'critical' : 'non-critical',
    }));

    const cpEdges = cp.criticalEdges.map(edge => ({
      data: { id: `${edge.from}-${edge.to}`, source: edge.from, target: edge.to },
      classes: 'critical',
    }));
    const fallbackEdges = this.tasks().flatMap(task =>
      (task.dependsOn ?? []).map(dep => ({
        data: { id: `${dep.id}-${task.id}`, source: dep.id, target: task.id },
        classes: criticalEdgeKeys.has(`${dep.id}-${task.id}`) ? 'critical' : 'non-critical',
      })),
    );
    const uniqueEdges = new Map<string, { data: { id: string; source: string; target: string }; classes: string }>();
    for (const edge of [...cpEdges, ...fallbackEdges]) {
      if (nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)) {
        uniqueEdges.set(edge.data.id, edge);
      }
    }
    const edges = [...uniqueEdges.values()];

    this.cy?.destroy();
    this.cy = cytoscape({
      container: this.graphContainer.nativeElement,
      elements: [...taskNodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'font-size': 11,
            'text-valign': 'center',
            'text-halign': 'center',
            color: '#ffffff',
            shape: 'round-rectangle',
            padding: '10px',
            width: 'label',
            height: 'label',
          },
        },
        {
          selector: 'node.non-critical',
          style: { 'background-color': primaryColor },
        },
        {
          selector: 'node.critical',
          style: { 'background-color': '#B3261E' },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge.non-critical',
          style: {
            'line-color': primaryColor,
            'target-arrow-color': primaryColor,
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge.critical',
          style: {
            'line-color': '#B3261E',
            'target-arrow-color': '#B3261E',
            width: 2.5,
          },
        },
      ],
      minZoom: 0.35,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
    });

    const layout = this.cy.layout({
      name: 'dagre',
      rankDir: 'LR',
      padding: 24,
      nodeSep: 40,
      rankSep: 60,
      fit: true,
    } as cytoscape.LayoutOptions);
    layout.run();

    const fitGraph = () => {
      this.cy?.resize();
      this.cy?.fit(undefined, 32);
    };
    layout.on('layoutstop', fitGraph);
    requestAnimationFrame(() => requestAnimationFrame(fitGraph));

    const container = this.graphContainer.nativeElement;
    this.cy.on('mouseover', 'node', () => {
      container.style.cursor = 'pointer';
    });
    this.cy.on('mouseout', 'node', () => {
      container.style.cursor = 'default';
    });
    this.cy.on('grab', 'node', () => {
      container.style.cursor = 'grabbing';
    });
    this.cy.on('free', 'node', () => {
      container.style.cursor = 'default';
    });
  }
}
