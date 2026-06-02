import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../services/auth';
import { EnvironmentService } from '../../../services/environment';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

/* ─── Edit User Dialog ────────────────────────────────────────────── */
export interface EditUserDialogData {
  userId: string;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;  // whether the *current* logged-in user is owner
}

@Component({
  selector: 'app-edit-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="eu-shell">
      <header class="eu-header">
        <h2 class="eu-title">Edit user</h2>
        <button type="button" class="eu-close" mat-dialog-close aria-label="Close">
          <i class="ti ti-x"></i>
        </button>
      </header>
      <form [formGroup]="form" class="eu-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Display name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width" *ngIf="data.isOwner">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width" *ngIf="data.isOwner">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="admin">Admin</mat-option>
            <mat-option value="manager">Manager</mat-option>
            <mat-option value="member">Member</mat-option>
            <mat-option value="viewer">Viewer</mat-option>
          </mat-select>
        </mat-form-field>
        <footer class="eu-footer">
          <button mat-stroked-button type="button" mat-dialog-close>Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </footer>
      </form>
    </div>
  `,
  styles: [`
    .eu-shell { min-width: 380px; max-width: 440px; }
    .eu-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 12px; }
    .eu-title { margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--md-on-surface); }
    .eu-close { width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; cursor: pointer; color: var(--md-on-surface-secondary); display: flex; align-items: center; justify-content: center; }
    .eu-form { display: flex; flex-direction: column; gap: 4px; }
    .full-width { width: 100%; }
    .eu-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; }
  `],
})
export class EditUserDialogComponent {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  readonly data = inject<EditUserDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<EditUserDialogComponent, boolean>);
  private fb = inject(FormBuilder);

  saving = signal(false);

  form = this.fb.group({
    name: [this.data.name, Validators.required],
    email: [this.data.email, [Validators.email]],
    role: [this.data.role],
  });

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const body: Record<string, string> = { name: this.form.value.name! };
    if (this.data.isOwner) {
      if (this.form.value.email) body['email'] = this.form.value.email;
      if (this.form.value.role) body['role'] = this.form.value.role;
    }
    this.http.put(`${this.env.apiUrl}/users/${this.data.userId}`, body).subscribe({
      next: () => this.ref.close(true),
      error: () => this.saving.set(false),
    });
  }
}

/* ─── Invite User Dialog ─────────────────────────────────────────── */
@Component({
  selector: 'app-invite-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="eu-shell">
      <header class="eu-header">
        <h2 class="eu-title">Invite member</h2>
        <button type="button" class="eu-close" mat-dialog-close aria-label="Close">
          <i class="ti ti-x"></i>
        </button>
      </header>
      <form [formGroup]="form" class="eu-form" (ngSubmit)="send()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" />
          <mat-error *ngIf="form.get('email')?.hasError('required')">Required</mat-error>
          <mat-error *ngIf="form.get('email')?.hasError('email')">Invalid email</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="admin">Admin</mat-option>
            <mat-option value="manager">Manager</mat-option>
            <mat-option value="member">Member</mat-option>
            <mat-option value="viewer">Viewer</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Password</mat-label>
          <input matInput formControlName="password" type="password" />
          <mat-error *ngIf="form.get('password')?.hasError('minlength')">Min 6 characters</mat-error>
        </mat-form-field>
        <footer class="eu-footer">
          <button mat-stroked-button type="button" mat-dialog-close>Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || sending()">
            {{ sending() ? 'Adding…' : 'Add to organization' }}
          </button>
        </footer>
      </form>
    </div>
  `,
  styles: [`
    .eu-shell { min-width: 380px; max-width: 440px; padding: 24px; }
    .eu-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .eu-title { margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--md-on-surface); }
    .eu-close { width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; cursor: pointer; color: var(--md-on-surface-secondary); display: flex; align-items: center; justify-content: center; }
    .eu-form { display: flex; flex-direction: column; gap: 1.25rem; }
    .full-width { width: 100%; }
    .eu-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
  `],
})
export class InviteUserDialogComponent {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  readonly ref = inject(MatDialogRef<InviteUserDialogComponent, { created: boolean; usedTempPassword: boolean }>);
  private fb = inject(FormBuilder);

  sending = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    name: ['', Validators.required],
    role: ['member'],
    password: ['', [Validators.minLength(6)]],
  });

  send(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    const { email, name, role, password } = this.form.getRawValue();
    const finalPassword = password && password.trim().length > 0 ? password : this.generateTempPassword();
    const usedTempPassword = !password || password.trim().length === 0;
    this.http.post(`${this.env.apiUrl}/auth/register`, { email, name, role, password: finalPassword }).subscribe({
      next: () => this.ref.close({ created: true, usedTempPassword }),
      error: () => this.sending.set(false),
    });
  }

  private generateTempPassword(): string {
    const seed = Math.random().toString(36).slice(-8);
    return `Temp-${seed}A1`;
  }
}

/* ─── TeamMember interface ─────────────────────────────────────────── */
interface TeamMember {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
}

/* ─── Team Page Component ──────────────────────────────────────────── */
@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './team.html',
  styleUrl: './team.css',
})
export class TeamComponent implements OnInit {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  loading = signal(true);
  members = signal<TeamMember[]>([]);
  searchText = signal('');
  roleFilter = signal('all');

  currentRole = signal('');
  isOwner = computed(() => this.currentRole() === 'owner');
  isAdmin = computed(() => this.currentRole() === 'admin');
  canEdit = computed(() => this.isOwner() || this.isAdmin());
  isRestricted = computed(() => {
    const role = this.currentRole();
    return role === 'viewer' || role === 'member';
  });

  readonly roleFilters = ['all', 'owner', 'admin', 'manager', 'member', 'viewer'];

  filteredMembers = computed(() => {
    const q = this.searchText().toLowerCase();
    const r = this.roleFilter();
    return this.members().filter(m => {
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
      const matchR = r === 'all' || m.roleLabel === r;
      return matchQ && matchR;
    });
  });

  ngOnInit(): void {
    if (this.isRestricted()) {
      this.loading.set(false);
      return;
    }
    const current = this.auth.getCurrentUser();
    this.currentRole.set(current?.role?.name ?? '');
    const roster = new Map<string, TeamMember>();

    if (current) {
      roster.set(current.id, {
        id: current.id,
        name: current.name ?? current.email,
        email: current.email,
        roleLabel: current.role?.name ?? 'member',
      });
    }

    this.http.get<{ data: Array<{ assignedTo?: { id: string; name?: string; email?: string } }> }>(
      `${this.env.apiUrl}/tasks?limit=500`
    ).subscribe({
      next: ({ data }) => {
        for (const task of data) {
          const u = task.assignedTo;
          if (u?.id && !roster.has(u.id)) {
            roster.set(u.id, {
              id: u.id,
              name: u.name ?? u.email ?? 'Team member',
              email: u.email ?? '—',
              roleLabel: 'member',
            });
          }
        }
        this.members.set([...roster.values()]);
        this.loading.set(false);
      },
      error: () => {
        if (current) {
          this.members.set([{ id: current.id, name: current.name ?? current.email, email: current.email, roleLabel: current.role?.name ?? 'member' }]);
        }
        this.loading.set(false);
      },
    });
  }

  roleChipClass(role: string): string {
    switch (role) {
      case 'owner':   return 'pill pill-red';
      case 'admin':   return 'pill pill-blue';
      case 'manager': return 'pill pill-amber';
      default:        return 'pill pill-green';
    }
  }

  initials(m: TeamMember): string {
    const parts = (m.name ?? '').trim().split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : (m.name ?? '??').slice(0, 2).toUpperCase();
  }

  canEditUser(member: TeamMember): boolean {
    if (this.isOwner()) return member.roleLabel !== 'owner';
    if (this.isAdmin()) return !['owner', 'admin'].includes(member.roleLabel);
    return false;
  }

  openEdit(member: TeamMember): void {
    const ref = this.dialog.open(EditUserDialogComponent, {
      panelClass: 'm3-dialog-panel',
      data: {
        userId: member.id,
        name: member.name,
        email: member.email,
        role: member.roleLabel,
        isOwner: this.isOwner(),
      } satisfies EditUserDialogData,
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        this.snackBar.open('User updated', 'Close', { duration: 3000 });
        // Refresh by re-triggering ngOnInit
        this.loading.set(true);
        this.ngOnInit();
      }
    });
  }

  openInvite(): void {
    const ref = this.dialog.open(InviteUserDialogComponent, {
      panelClass: 'm3-dialog-panel',
    });
    ref.afterClosed().subscribe(result => {
      if (result?.created) {
        this.snackBar.open(
          result.usedTempPassword
            ? 'Invitation sent with temporary password (demo)'
            : 'User added to organization',
          'Close',
          { duration: 3000 },
        );
        this.loading.set(true);
        this.ngOnInit();
      }
    });
  }

  removeUser(member: TeamMember): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      panelClass: 'm3-dialog-panel',
      data: {
        title: 'Remove user',
        message: `Remove "${member.name}" from the organization?`,
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
        warn: true,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${this.env.apiUrl}/users/${member.id}`).subscribe({
        next: () => {
          this.snackBar.open('User removed', 'Close', { duration: 3000 });
          this.members.set(this.members().filter(m => m.id !== member.id));
        },
        error: () => this.snackBar.open('Could not remove user', 'Close', { duration: 3000 }),
      });
    });
  }
}
