import { Injectable } from '@angular/core';

const STORAGE_KEY = 'comment_reads';

@Injectable({ providedIn: 'root' })
export class CommentReadService {
  /** Returns ISO string timestamp of when the user last opened this task's comments, or null. */
  getLastRead(taskId: string): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const map: Record<string, string> = JSON.parse(stored);
      return map[taskId] ?? null;
    } catch {
      return null;
    }
  }

  /** Mark the comment thread for this task as read right now. */
  markRead(taskId: string): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, string> = stored ? JSON.parse(stored) : {};
      map[taskId] = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // localStorage unavailable — ignore
    }
  }

  /** Returns true when the task has a comment newer than the last-read timestamp. */
  hasUnread(taskId: string, latestCommentAt: string | null | undefined): boolean {
    if (!latestCommentAt) return false;
    const lastRead = this.getLastRead(taskId);
    if (!lastRead) return true; // never opened — treat as unread
    return new Date(latestCommentAt) > new Date(lastRead);
  }
}
