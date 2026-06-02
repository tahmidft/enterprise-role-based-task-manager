import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EnvironmentService } from '../../../services/environment';
import {
  formatAssignee,
  priorityPillClass,
  priorityToneClass,
} from '../shared/task-ui';
import { TaskCreateDialogComponent, TaskDialogData } from '../shared/task-create-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

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
    MatMenuModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './board.html',
  styleUrl: './board.css',
})
export class BoardComponent implements OnInit {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  loading = signal(false);
  pending = signal<BoardTask[]>([]);
  inProgress = signal<BoardTask[]>([]);
  done = signal<BoardTask[]>([]);

  readonly priorityPill = priorityPillClass;
  readonly priorityTone = priorityToneClass;
  readonly formatAssignee = formatAssignee;

  ngOnInit(): void {
    this.loadTasks();
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
        this.loadTasks();
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
        this.loadTasks();
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
        this.loadTasks();
      });
    });
  }

  private loadTasks(): void {
    this.loading.set(true);
    this.http.get<{ data: BoardTask[] }>(`${this.env.apiUrl}/tasks?limit=500`).subscribe({
      next: ({ data }) => {
        this.pending.set(data.filter(t => t.status === 'pending'));
        this.inProgress.set(data.filter(t => t.status === 'in-progress'));
        this.done.set(data.filter(t => t.status === 'completed'));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
