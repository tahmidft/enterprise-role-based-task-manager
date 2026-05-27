import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth';
import { EnvironmentService } from './environment';
import { Task, Comment } from './tasks.service';

export type TaskEvent = 'task:created' | 'task:updated' | 'task:deleted' | 'task:assigned';

export interface TaskSocketEvent {
  type: TaskEvent;
  task: Task;
}

export interface CommentSocketEvent {
  comment: Comment;
  taskId: string;
}

@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {
  private socket: Socket | null = null;
  private auth = inject(AuthService);
  private env = inject(EnvironmentService);

  private taskEventSubject = new Subject<TaskSocketEvent>();
  taskEvents$ = this.taskEventSubject.asObservable();

  private commentEventSubject = new Subject<CommentSocketEvent>();
  commentEvents$ = this.commentEventSubject.asObservable();

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.auth.getToken();
    const wsUrl = this.env.apiUrl.replace('/api', '');

    this.socket = io(`${wsUrl}/tasks`, {
      auth: { token },
      transports: ['websocket'],
    });

    const taskEvents: TaskEvent[] = ['task:created', 'task:updated', 'task:deleted', 'task:assigned'];
    for (const event of taskEvents) {
      this.socket.on(event, (task: Task) => {
        this.taskEventSubject.next({ type: event, task });
      });
    }

    this.socket.on('comment:created', (payload: CommentSocketEvent) => {
      this.commentEventSubject.next(payload);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
