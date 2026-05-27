import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EnvironmentService } from './environment';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignedTo?: { id: string; name: string; email: string };
  createdBy?: { id: string; name: string };
  organizationId: string;
  createdAt: string;
}

export interface PaginatedTasks {
  data: Task[];
  total: number;
  page: number;
  limit: number;
}

export interface TaskFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  user: { id: string; name: string; email: string };
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class TasksApiService {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);

  getTasks(filters: TaskFilters = {}): Observable<PaginatedTasks> {
    let params = new HttpParams();
    if (filters.page !== undefined) params = params.set('page', String(filters.page));
    if (filters.limit !== undefined) params = params.set('limit', String(filters.limit));
    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.assignedTo) params = params.set('assignedTo', filters.assignedTo);
    if (filters.search) params = params.set('search', filters.search);
    return this.http.get<PaginatedTasks>(`${this.env.apiUrl}/tasks`, { params });
  }

  getTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.env.apiUrl}/tasks/${id}`);
  }

  createTask(dto: Partial<Task>): Observable<Task> {
    return this.http.post<Task>(`${this.env.apiUrl}/tasks`, dto);
  }

  updateTask(id: string, dto: Partial<Task>): Observable<Task> {
    return this.http.put<Task>(`${this.env.apiUrl}/tasks/${id}`, dto);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.env.apiUrl}/tasks/${id}`);
  }

  getComments(taskId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.env.apiUrl}/tasks/${taskId}/comments`);
  }

  addComment(taskId: string, content: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.env.apiUrl}/tasks/${taskId}/comments`, { content });
  }
}
