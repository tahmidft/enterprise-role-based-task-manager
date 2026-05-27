import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EnvironmentService } from './environment';

export interface AssigneeStats {
  assigneeId: string;
  assigneeName: string;
  count: number;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface AnalyticsData {
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  completionRate: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  tasksByAssignee: AssigneeStats[];
  activeUsers: number;
  auditActivityLast30Days: ActivityDay[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);

  getAnalytics(): Observable<AnalyticsData> {
    return this.http.get<AnalyticsData>(`${this.env.apiUrl}/analytics`);
  }
}
