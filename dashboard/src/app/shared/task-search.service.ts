import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { EnvironmentService } from '../../../services/environment';
import { fuzzyMatchTasks, TaskSearchHit, TaskSearchRecord } from './task-search.util';

@Injectable({ providedIn: 'root' })
export class TaskSearchService {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);

  private tasks: TaskSearchRecord[] = [];
  private loaded = false;

  ensureLoaded(): Observable<void> {
    if (this.loaded) return of(undefined);

    return this.http
      .get<{
        data: Array<{
          id: string;
          title: string;
          priority: string;
          status: string;
          description?: string;
        }>;
      }>(`${this.env.apiUrl}/tasks?limit=500`)
      .pipe(
        tap(({ data }) => {
          this.tasks = data.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            status: t.status,
            description: t.description,
          }));
          this.loaded = true;
        }),
        map(() => undefined),
        catchError(() => {
          // Keep unloaded so the next ensureLoaded() retries after auth/API recover.
          return of(undefined);
        }),
      );
  }

  refresh(): void {
    this.loaded = false;
    this.tasks = [];
  }

  search(query: string, limit = 8): TaskSearchHit[] {
    return fuzzyMatchTasks(query, this.tasks, limit);
  }
}
