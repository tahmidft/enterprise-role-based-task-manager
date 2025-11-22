import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { ThemeToggleComponent } from '../components/theme-toggle';
import { ITask, IUser } from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  currentUser = signal<IUser | null>(null);
  tasks = signal<ITask[]>([]);
  isLoading = signal(true);
  canCreateTasks = signal(false);
  canDeleteTasks = signal(false);

  private readonly API_URL = 'http://localhost:3333/api';

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.checkPermissions();
    this.loadTasks();
  }

  loadTasks(): void {
    this.isLoading.set(true);
    this.http.get<ITask[]>(`${this.API_URL}/tasks`).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  checkPermissions(): void {
    const user = this.currentUser();
    if (user?.role) {
      const permissions = (user.role as any).permissions || [];
      this.canCreateTasks.set(permissions.includes('tasks:create'));
      this.canDeleteTasks.set(permissions.includes('tasks:delete'));
    }
  }

  getUserRoleName(): string {
    const user = this.currentUser();
    return user?.role ? (user.role as any).name : '';
  }

  getTaskAssigneeName(task: ITask): string {
    return task.assignedTo ? (task.assignedTo as any).name : 'Unassigned';
  }

  deleteTask(taskId: string): void {
    if (!confirm('Are you sure you want to delete this task?')) return;

    this.http.delete(`${this.API_URL}/tasks/${taskId}`).subscribe({
      next: () => {
        this.tasks.set(this.tasks().filter(t => t.id !== taskId));
      },
      error: (err) => {
        alert('Failed to delete task: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return classes[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }

  getPriorityBadgeClass(priority: string): string {
    const classes: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'medium': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'high': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return classes[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}
