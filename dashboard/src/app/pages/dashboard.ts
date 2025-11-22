import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { ThemeToggleComponent } from '../components/theme-toggle';
import { ITask, IUser, IRole, IPermission } from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';

interface UserWithRole extends IUser {
  role?: IRole & { permissions?: IPermission[] };
}

interface TaskWithAssignee extends ITask {
  assignedTo?: { name?: string };
}

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

  currentUser = signal<UserWithRole | null>(null);
  tasks = signal<TaskWithAssignee[]>([]);
  isLoading = signal(true);
  canCreateTasks = signal(false);
  canDeleteTasks = signal(false);

  private readonly API_URL = 'http://localhost:3333/api';

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser() as UserWithRole);
    this.checkPermissions();
    this.loadTasks();
  }

  loadTasks(): void {
    this.isLoading.set(true);
    this.http.get<TaskWithAssignee[]>(`${this.API_URL}/tasks`).subscribe({
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
    if (user?.role?.permissions) {
      const permissionNames = user.role.permissions.map(p => p.name || '');
      this.canCreateTasks.set(permissionNames.includes('tasks:create'));
      this.canDeleteTasks.set(permissionNames.includes('tasks:delete'));
    }
  }

  getUserRoleName(): string {
    const user = this.currentUser();
    return user?.role?.name || '';
  }

  getTaskAssigneeName(task: TaskWithAssignee): string {
    return task.assignedTo?.name || 'Unassigned';
  }

  deleteTask(taskId: string): void {
    if (!confirm('Are you sure you want to delete this task?')) return;

    this.http.delete(`${this.API_URL}/tasks/${taskId}`).subscribe({
      next: () => {
        this.tasks.set(this.tasks().filter(t => t.id !== taskId));
      },
      error: (err) => {
        console.error('Failed to delete task:', err);
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
