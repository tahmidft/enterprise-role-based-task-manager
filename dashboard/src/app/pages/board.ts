import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { EnvironmentService } from '../../../services/environment';
import {
  formatAssignee,
  priorityPillClass,
  priorityToneClass,
} from '../shared/task-ui';
import { TaskCreateDialogComponent, TaskDialogData } from '../shared/task-create-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MenuService } from '../shared/menu.service';
import { BoardFilterResult } from '../shared/board-filter-dialog.component';

interface BoardTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate?: string;
  dueDate?: string;
  assignedToId?: string;
  assignedTo?: { name?: string; email?: string };
  description?: string;
  budgetHours?: number;
  actualHours?: number;
  completionPercent?: number;
}

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatMenuModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './board.html',
  styleUrl: './board.css',
})
export class BoardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private menuService = inject(MenuService);
  private subs = new Subscription();

  loading = signal(false);
  pending = signal<BoardTask[]>([]);
  inProgress = signal<BoardTask[]>([]);
  done = signal<BoardTask[]>([]);
  private allPending = signal<BoardTask[]>([]);
  private allInProgress = signal<BoardTask[]>([]);
  private allDone = signal<BoardTask[]>([]);
  private filterPriority = signal('');
  private filterStatus = signal('');
  private filterAssigneeId = signal('');
  private filterSearch = signal('');
  searchQuery = signal('');
  spotlightTaskId = signal<string | null>(null);

  private pendingSpotlightTaskId: string | null = null;
  private spotlightTimer?: ReturnType<typeof setTimeout>;
  private tasksLoaded = false;
  private lastLoadedSearch = '';

  readonly priorityPill = priorityPillClass;
  readonly priorityTone = priorityToneClass;
  readonly formatAssignee = formatAssignee;

  ngOnInit(): void {
    this.applyStoredFilter();
    this.subs.add(this.route.queryParamMap.subscribe(params => this.onQueryParams(params)));
    this.subs.add(
      this.menuService.boardFilterApplied$.subscribe(result => this.applyFilterResult(result)),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.spotlightTimer);
  }

  trackByTaskId(_index: number, task: BoardTask): string {
    return task.id;
  }

  isSpotlight(taskId: string): boolean {
    return this.spotlightTaskId() === taskId;
  }

  private onQueryParams(params: ParamMap): void {
    const q = params.get('search')?.trim() ?? '';
    const taskId = params.get('task')?.trim() ?? '';

    this.filterSearch.set(q);
    this.searchQuery.set(q);

    const searchChanged = q !== this.lastLoadedSearch;
    if (!this.tasksLoaded || searchChanged) {
      this.lastLoadedSearch = q;
      this.pendingSpotlightTaskId = taskId || null;
      this.loadTasks(!this.tasksLoaded);
      return;
    }

    if (taskId) {
      this.runSpotlight(taskId);
    }
  }

  private applyFilterResult(result: BoardFilterResult): void {
    this.filterPriority.set(result.priority ?? '');
    this.filterStatus.set(result.status ?? '');
    this.filterAssigneeId.set(result.assigneeId ?? '');
    this.applyFilters();
  }

  private applyStoredFilter(): void {
    try {
      const raw = sessionStorage.getItem('boardFilter');
      if (!raw) return;
      const parsed = JSON.parse(raw) as BoardFilterResult;
      this.applyFilterResult(parsed);
    } catch {
      // ignore invalid filter payload
    }
  }

  private matchesFilter(task: BoardTask): boolean {
    const q = this.filterSearch().toLowerCase();
    if (q) {
      const hay = `${task.title} ${task.description ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (this.filterPriority() && task.priority !== this.filterPriority()) return false;
    if (this.filterStatus() && task.status !== this.filterStatus()) return false;
    if (this.filterAssigneeId() && task.assignedToId !== this.filterAssigneeId()) return false;
    return true;
  }

  private applyFilters(): void {
    const focusId = this.spotlightTaskId() ?? this.pendingSpotlightTaskId;
    const match = (t: BoardTask) => {
      if (focusId && t.id === focusId) return true;
      return this.matchesFilter(t);
    };
    this.pending.set(this.allPending().filter(match));
    this.inProgress.set(this.allInProgress().filter(match));
    this.done.set(this.allDone().filter(match));
  }

  cardTone(task: BoardTask): string {
    return priorityToneClass(task.priority, task.status === 'completed');
  }

  getInitials(task: BoardTask): string {
    const name = task.assignedTo?.name ?? task.assignedTo?.email ?? '';
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  drop(event: CdkDragDrop<BoardTask[]>, status: 'pending' | 'in-progress' | 'completed'): void {
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
    this.http.put(`${this.env.apiUrl}/tasks/${task.id}`, { status }).subscribe();
  }

  openNewTaskDialog(): void {
    const ref = this.dialog.open(TaskCreateDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '520px',
      data: {} satisfies TaskDialogData,
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        this.snackBar.open('Task created', 'Close', { duration: 3000 });
        this.loadTasks(false);
      }
    });
  }

  editTask(task: BoardTask): void {
    const ref = this.dialog.open(TaskCreateDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '520px',
      data: {
        taskId: task.id,
        prefill: {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          startDate: task.startDate,
          dueDate: task.dueDate,
          budgetHours: task.budgetHours,
          actualHours: task.actualHours,
          completionPercent: task.completionPercent,
          assignedToId: task.assignedToId,
        },
      } satisfies TaskDialogData,
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        this.snackBar.open('Task updated', 'Close', { duration: 3000 });
        this.loadTasks(false);
      }
    });
  }

  changePriority(task: BoardTask, priority: string): void {
    this.http.put(`${this.env.apiUrl}/tasks/${task.id}`, { priority }).subscribe(() => {
      task.priority = priority;
      // Force signal refresh
      this.pending.set([...this.pending()]);
      this.inProgress.set([...this.inProgress()]);
      this.done.set([...this.done()]);
    });
  }

  deleteTask(task: BoardTask): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      panelClass: 'm3-dialog-panel',
      data: {
        title: 'Delete task',
        message: `Delete "${task.title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        warn: true,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${this.env.apiUrl}/tasks/${task.id}`).subscribe(() => {
        this.snackBar.open('Task deleted', 'Close', { duration: 3000 });
        this.loadTasks(false);
      });
    });
  }

  private loadTasks(showSpinner: boolean): void {
    if (showSpinner) this.loading.set(true);
    const search = this.filterSearch().trim();
    const params = new URLSearchParams({ limit: '500' });
    if (search) params.set('search', search);
    this.http.get<{ data: BoardTask[] }>(`${this.env.apiUrl}/tasks?${params}`).subscribe({
      next: ({ data }) => {
        this.allPending.set(data.filter(t => t.status === 'pending'));
        this.allInProgress.set(data.filter(t => t.status === 'in-progress'));
        this.allDone.set(data.filter(t => t.status === 'completed'));
        this.tasksLoaded = true;
        this.applyFilters();
        this.loading.set(false);
        if (this.pendingSpotlightTaskId) {
          this.runSpotlight(this.pendingSpotlightTaskId);
          this.pendingSpotlightTaskId = null;
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private findTaskById(taskId: string): BoardTask | undefined {
    return [...this.allPending(), ...this.allInProgress(), ...this.allDone()].find(
      t => t.id === taskId,
    );
  }

  private clearTaskParamSilently(): void {
    const url = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { task: null },
      queryParamsHandling: 'merge',
    });
    this.location.replaceState(this.router.serializeUrl(url));
  }

  private runSpotlight(taskId: string): void {
    clearTimeout(this.spotlightTimer);
    this.spotlightTaskId.set(taskId);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`task-${taskId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    });

    this.spotlightTimer = setTimeout(() => {
      const task = this.findTaskById(taskId);
      this.spotlightTaskId.set(null);
      if (task && !this.matchesFilter(task)) {
        this.applyFilters();
      }
      this.clearTaskParamSilently();
    }, 1000);
  }
}
