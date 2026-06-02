import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSliderModule } from '@angular/material/slider';
import { EnvironmentService } from '../../../services/environment';

export interface TaskDialogData {
  /** When set, dialog is editing an existing task */
  taskId?: string;
  /** Pre-filled fields for editing */
  prefill?: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
    startDate?: string | null;
    budgetHours?: number;
    actualHours?: number;
    completionPercent?: number;
    assignedToId?: string;
  };
  parentTaskId?: string;
  parentTitle?: string;
  projectId?: string;
}

export interface AssigneeOption {
  id: string;
  label: string;
  initials: string;
}

@Component({
  selector: 'app-task-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSliderModule,
  ],
  templateUrl: './task-create-dialog.component.html',
  styleUrl: './task-create-dialog.component.css',
})
export class TaskCreateDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  readonly data = inject<TaskDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<TaskCreateDialogComponent, boolean>);

  assignees = signal<AssigneeOption[]>([]);
  useAssigneeText = signal(true);
  submitting = signal(false);

  get isEdit(): boolean { return !!this.data.taskId; }

  form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    status: ['pending', Validators.required],
    priority: ['medium', Validators.required],
    assignedToId: [''],
    assignedToText: [''],
    startDate: [null as Date | null],
    dueDate: [null as Date | null],
    budgetHours: [8, [Validators.required, Validators.min(0)]],
    actualHours: [0, [Validators.min(0)]],
    completionPercent: [0],
  });

  readonly statuses = [
    { value: 'pending',     label: 'Pending',     icon: 'ti-clock' },
    { value: 'in-progress', label: 'In Progress',  icon: 'ti-player-play' },
    { value: 'completed',   label: 'Completed',    icon: 'ti-circle-check' },
  ];

  readonly priorities = [
    { value: 'high',   label: 'High',   dotClass: 'priority-dot priority-dot--high' },
    { value: 'medium', label: 'Medium', dotClass: 'priority-dot priority-dot--medium' },
    { value: 'low',    label: 'Low',    dotClass: 'priority-dot priority-dot--low' },
  ];

  ngOnInit(): void {
    const p = this.data.prefill;
    if (p) {
      this.form.patchValue({
        title: p.title ?? '',
        description: p.description ?? '',
        status: p.status ?? 'pending',
        priority: p.priority ?? 'medium',
        budgetHours: p.budgetHours ?? 8,
        actualHours: p.actualHours ?? 0,
        completionPercent: p.completionPercent ?? 0,
        startDate: p.startDate ? new Date(p.startDate) : null,
        dueDate: p.dueDate ? new Date(p.dueDate) : null,
        assignedToId: p.assignedToId ?? '',
      });
    } else if (this.data.parentTitle) {
      this.form.patchValue({ description: `Subtask of ${this.data.parentTitle}` });
    }
    this.loadAssignees();
  }

  private loadAssignees(): void {
    this.http
      .get<{ data: Array<{ assignedTo?: { id: string; name?: string; email?: string } }> }>(
        `${this.env.apiUrl}/tasks?limit=500`,
      )
      .subscribe({
        next: ({ data }) => {
          const map = new Map<string, string>();
          for (const t of data) {
            const u = t.assignedTo;
            if (u?.id) map.set(u.id, u.name ?? u.email ?? u.id);
          }
          const list = [...map.entries()].map(([id, label]) => ({
            id,
            label,
            initials: this.initials(label),
          }));
          this.assignees.set(list);
          this.useAssigneeText.set(list.length === 0);
          // If editing and assignedToId is set, ensure dropdown is shown
          if (list.length > 0 && this.data.prefill?.assignedToId) {
            this.useAssigneeText.set(false);
          }
        },
        error: () => this.useAssigneeText.set(true),
      });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const raw = this.form.getRawValue();
    const body: Record<string, unknown> = {
      title: raw.title?.trim(),
      description: raw.description?.trim() || '',
      status: raw.status,
      priority: raw.priority,
      budgetHours: Number(raw.budgetHours) || 0,
      actualHours: Number(raw.actualHours) || 0,
      completionPercent: Number(raw.completionPercent) || 0,
    };

    if (raw.startDate) body['startDate'] = (raw.startDate as Date).toISOString();
    if (raw.dueDate) body['dueDate'] = (raw.dueDate as Date).toISOString();
    if (this.data.parentTaskId) body['parentTaskId'] = this.data.parentTaskId;
    if (this.data.projectId) body['projectId'] = this.data.projectId;
    if (!this.useAssigneeText() && raw.assignedToId) body['assignedToId'] = raw.assignedToId;

    this.submitting.set(true);

    if (this.isEdit) {
      this.http.put(`${this.env.apiUrl}/tasks/${this.data.taskId}`, body).subscribe({
        next: () => this.ref.close(true),
        error: () => this.submitting.set(false),
      });
    } else {
      this.http.post(`${this.env.apiUrl}/tasks`, body).subscribe({
        next: () => this.ref.close(true),
        error: () => this.submitting.set(false),
      });
    }
  }

  private initials(label: string): string {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return label.slice(0, 2).toUpperCase();
  }
}
