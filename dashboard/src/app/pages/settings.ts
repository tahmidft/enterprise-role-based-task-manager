import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth';
import {
  ACCENT_OPTIONS,
  AppearanceService,
  Density,
} from '../shared/appearance.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

type SettingsSection =
  | 'account'
  | 'appearance'
  | 'notifications'
  | 'project'
  | 'about';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private appearance = inject(AppearanceService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  activeSection = signal<SettingsSection>('account');
  displayName = signal('');
  userEmail = signal('');
  roleLabel = signal('member');
  userInitials = signal('??');

  readonly sections: { id: SettingsSection; label: string; icon: string }[] = [
    { id: 'account', label: 'Account', icon: 'ti-user' },
    { id: 'appearance', label: 'Appearance', icon: 'ti-palette' },
    { id: 'notifications', label: 'Notifications', icon: 'ti-bell' },
    { id: 'project', label: 'Project defaults', icon: 'ti-adjustments' },
    { id: 'about', label: 'About', icon: 'ti-info-circle' },
  ];

  readonly accentOptions = ACCENT_OPTIONS;
  readonly density = this.appearance.density;
  readonly accentIndex = this.appearance.accentIndex;
  readonly accentId = computed(() => this.accentOptions[this.accentIndex()]?.id ?? 'purple');

  passwordForm = this.fb.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', Validators.required],
  });

  notifyTaskAssigned = signal(true);
  notifyOverdue = signal(true);
  notifyEscalation = signal(true);
  notifySecurity = signal(true);
  notifyAudit = signal(false);

  defaultStatus = signal('pending');
  defaultPriority = signal('medium');
  lowToMediumDays = signal(5);
  mediumToHighDays = signal(3);
  language = signal('en');

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (user) {
      this.displayName.set(user.name ?? user.email);
      this.userEmail.set(user.email);
      this.roleLabel.set(user.role?.name ?? 'member');
      const name = user.name ?? user.email;
      const parts = name.trim().split(/\s+/);
      this.userInitials.set(
        parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase(),
      );
    }
    this.loadNotificationPrefs();
    this.loadProjectDefaults();
  }

  selectSection(id: SettingsSection): void {
    this.activeSection.set(id);
  }

  isDarkMode(): boolean {
    return this.appearance.isDarkMode();
  }

  setTheme(dark: boolean): void {
    this.appearance.setDarkMode(dark);
  }

  pickAccent(id: string): void {
    const index = this.accentOptions.findIndex(a => a.id === id);
    this.appearance.setAccent(index >= 0 ? index : 0);
  }

  setDensityValue(value: Density): void {
    this.appearance.setDensity(value);
  }

  savePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;
    const { next, confirm } = this.passwordForm.value;
    if (next !== confirm) {
      this.snackBar.open('Passwords do not match', 'Close', { duration: 3000 });
      return;
    }
    this.snackBar.open('Password change is not available in this demo', 'Close', {
      duration: 4000,
    });
  }

  deleteAccount(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      panelClass: 'm3-dialog-panel',
      width: '400px',
      data: {
        title: 'Delete account',
        message: 'This will permanently remove your account. This action cannot be undone.',
        confirmLabel: 'Delete',
        warn: true,
      },
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        this.snackBar.open('Account deletion is not available in this demo', 'Close', {
          duration: 4000,
        });
      }
    });
  }

  saveNotifications(): void {
    const prefs = {
      taskAssigned: this.notifyTaskAssigned(),
      overdue: this.notifyOverdue(),
      escalation: this.notifyEscalation(),
      security: this.notifySecurity(),
      audit: this.notifyAudit(),
    };
    localStorage.setItem('notificationPrefs', JSON.stringify(prefs));
    this.snackBar.open('Notification preferences saved', 'Close', { duration: 3000 });
  }

  saveProjectDefaults(): void {
    const defaults = {
      defaultStatus: this.defaultStatus(),
      defaultPriority: this.defaultPriority(),
      lowToMediumDays: this.lowToMediumDays(),
      mediumToHighDays: this.mediumToHighDays(),
    };
    localStorage.setItem('projectDefaults', JSON.stringify(defaults));
    this.snackBar.open('Project defaults saved', 'Close', { duration: 3000 });
  }

  private loadNotificationPrefs(): void {
    try {
      const raw = localStorage.getItem('notificationPrefs');
      if (!raw) return;
      const p = JSON.parse(raw);
      this.notifyTaskAssigned.set(!!p.taskAssigned);
      this.notifyOverdue.set(!!p.overdue);
      this.notifyEscalation.set(!!p.escalation);
      this.notifySecurity.set(!!p.security);
      this.notifyAudit.set(!!p.audit);
    } catch {
      /* ignore */
    }
  }

  private loadProjectDefaults(): void {
    try {
      const raw = localStorage.getItem('projectDefaults');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.defaultStatus) this.defaultStatus.set(p.defaultStatus);
      if (p.defaultPriority) this.defaultPriority.set(p.defaultPriority);
      if (p.lowToMediumDays != null) this.lowToMediumDays.set(p.lowToMediumDays);
      if (p.mediumToHighDays != null) this.mediumToHighDays.set(p.mediumToHighDays);
    } catch {
      /* ignore */
    }
  }
}
