import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { TasksApiService, Task, Comment, TaskFilters } from '../../../services/tasks.service';
import { WebsocketService } from '../../../services/websocket.service';
import { CommentReadService } from '../../../services/comment-read.service';
import { ThemeToggleComponent } from '../components/theme-toggle';
import { IUser, IRole } from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';
import { Subscription } from 'rxjs';

interface UserWithRole extends IUser {
  role?: IRole & { permissions?: { name: string }[] };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private tasksApi = inject(TasksApiService);
  private wsService = inject(WebsocketService);
  private commentReadService = inject(CommentReadService);

  currentUser = signal<UserWithRole | null>(null);
  tasks = signal<Task[]>([]);
  totalTasks = signal(0);
  isLoading = signal(true);
  canCreateTasks = signal(false);
  canDeleteTasks = signal(false);
  canComment = signal(false);

  // Filters
  filterStatus = signal('');
  filterPriority = signal('');
  filterSearch = signal('');
  currentPage = signal(1);
  readonly pageSize = 20;

  totalPages = computed(() => Math.ceil(this.totalTasks() / this.pageSize));
  pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  // Comments panel
  selectedTask = signal<Task | null>(null);
  comments = signal<Comment[]>([]);
  newComment = signal('');
  commentsLoading = signal(false);

  // Notification bell
  showNotificationPanel = signal(false);
  unreadTasks = computed(() =>
    this.tasks().filter(t => this.commentReadService.hasUnread(t.id, t.latestCommentAt)),
  );
  totalUnread = computed(() => this.unreadTasks().length);

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser() as UserWithRole);
    this.checkPermissions();
    this.loadTasks();

    this.wsService.connect();

    this.subscriptions.push(
      this.wsService.taskEvents$.subscribe(({ type, task }) => {
        if (type === 'task:deleted') {
          this.tasks.update(ts => ts.filter(t => t.id !== task.id));
        } else if (type === 'task:created') {
          this.tasks.update(ts => [task, ...ts]);
          this.totalTasks.update(n => n + 1);
        } else {
          this.tasks.update(ts => ts.map(t => (t.id === task.id ? task : t)));
        }
      }),
    );

    // When a comment arrives via WS, update latestCommentAt on the affected task
    this.subscriptions.push(
      this.wsService.commentEvents$.subscribe(({ taskId }) => {
        const now = new Date().toISOString();
        this.tasks.update(ts =>
          ts.map(t =>
            t.id === taskId
              ? { ...t, latestCommentAt: now, commentCount: (t.commentCount ?? 0) + 1 }
              : t,
          ),
        );
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.wsService.disconnect();
  }

  loadTasks(): void {
    this.isLoading.set(true);
    const filters: TaskFilters = {
      page: this.currentPage(),
      limit: this.pageSize,
      status: this.filterStatus() || undefined,
      priority: this.filterPriority() || undefined,
      search: this.filterSearch() || undefined,
    };
    this.tasksApi.getTasks(filters).subscribe({
      next: result => {
        this.tasks.set(result.data);
        this.totalTasks.set(result.total);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadTasks();
  }

  clearFilters(): void {
    this.filterStatus.set('');
    this.filterPriority.set('');
    this.filterSearch.set('');
    this.currentPage.set(1);
    this.loadTasks();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadTasks();
  }

  checkPermissions(): void {
    const user = this.currentUser();
    if (user?.role?.permissions) {
      const names = user.role.permissions.map((p: { name: string }) => p.name);
      this.canCreateTasks.set(names.includes('tasks:create'));
      this.canDeleteTasks.set(names.includes('tasks:delete'));
      this.canComment.set(names.includes('tasks:update'));
    }
  }

  getUserRoleName(): string {
    return this.currentUser()?.role?.name || '';
  }

  getTaskAssigneeName(task: Task): string {
    return task.assignedTo?.name || 'Unassigned';
  }

  isUnread(task: Task): boolean {
    return this.commentReadService.hasUnread(task.id, task.latestCommentAt);
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return map[status] ?? 'bg-gray-100 text-gray-800';
  }

  getPriorityBadgeClass(priority: string): string {
    const map: Record<string, string> = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      medium: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return map[priority] ?? 'bg-gray-100 text-gray-800';
  }

  deleteTask(taskId: string): void {
    if (!confirm('Delete this task?')) return;
    this.tasksApi.deleteTask(taskId).subscribe({
      next: () => {
        this.tasks.update(ts => ts.filter(t => t.id !== taskId));
        this.totalTasks.update(n => n - 1);
      },
    });
  }

  openComments(task: Task): void {
    this.selectedTask.set(task);
    this.commentsLoading.set(true);
    this.showNotificationPanel.set(false);
    this.tasksApi.getComments(task.id).subscribe({
      next: c => {
        this.comments.set(c);
        this.commentsLoading.set(false);
        // Mark as read as soon as the panel is open and data is loaded
        this.commentReadService.markRead(task.id);
        // Also patch the task in the list so the badge disappears immediately
        this.tasks.update(ts =>
          ts.map(t => (t.id === task.id ? { ...t, _justRead: true } : t)),
        );
      },
      error: () => this.commentsLoading.set(false),
    });
  }

  closeComments(): void {
    this.selectedTask.set(null);
    this.comments.set([]);
    this.newComment.set('');
  }

  submitComment(): void {
    const task = this.selectedTask();
    const content = this.newComment().trim();
    if (!task || !content || !this.canComment()) return;
    this.tasksApi.addComment(task.id, content).subscribe({
      next: c => {
        this.comments.update(cs => [...cs, c]);
        this.newComment.set('');
        // We just posted so stay "read"
        this.commentReadService.markRead(task.id);
      },
    });
  }

  toggleNotificationPanel(): void {
    this.showNotificationPanel.update(v => !v);
  }

  closeNotificationPanel(): void {
    this.showNotificationPanel.set(false);
  }

  isOwnerOrAdmin(): boolean {
    const role = this.getUserRoleName();
    return role === 'owner' || role === 'admin';
  }

  logout(): void {
    this.authService.logout();
  }
}
