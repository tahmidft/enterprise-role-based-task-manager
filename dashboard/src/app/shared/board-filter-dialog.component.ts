import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

export interface BoardFilterResult {
  priority: string;
  status: string;
  assigneeId: string;
}

export interface BoardFilterDialogData {
  assignees: Array<{ id: string; label: string }>;
}

@Component({
  selector: 'app-board-filter-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule],
  template: `
    <div class="filter-dialog">
      <h2>Filter tasks</h2>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Priority</mat-label>
        <mat-select [(ngModel)]="priority">
          <mat-option value="">Any</mat-option>
          <mat-option value="high">High</mat-option>
          <mat-option value="medium">Medium</mat-option>
          <mat-option value="low">Low</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="status">
          <mat-option value="">Any</mat-option>
          <mat-option value="pending">Pending</mat-option>
          <mat-option value="in-progress">In progress</mat-option>
          <mat-option value="completed">Completed</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Assignee</mat-label>
        <mat-select [(ngModel)]="assigneeId">
          <mat-option value="">Any</mat-option>
          <mat-option *ngFor="let a of data.assignees" [value]="a.id">{{ a.label }}</mat-option>
        </mat-select>
      </mat-form-field>
      <footer class="filter-footer">
        <button mat-stroked-button type="button" (click)="clear()">Clear</button>
        <button mat-stroked-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="button" (click)="apply()">Apply</button>
      </footer>
    </div>
  `,
  styles: [`
    .filter-dialog { padding: 24px; min-width: 360px; }
    h2 { margin: 0 0 16px; font-size: 1.1rem; font-weight: 500; }
    .full-width { width: 100%; display: block; margin-bottom: 12px; }
    .filter-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `],
})
export class BoardFilterDialogComponent {
  readonly data = inject<BoardFilterDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<BoardFilterDialogComponent, BoardFilterResult | null>);

  priority = '';
  status = '';
  assigneeId = '';

  clear(): void {
    this.priority = '';
    this.status = '';
    this.assigneeId = '';
    this.ref.close({ priority: '', status: '', assigneeId: '' });
  }

  apply(): void {
    this.ref.close({
      priority: this.priority,
      status: this.status,
      assigneeId: this.assigneeId,
    });
  }
}
