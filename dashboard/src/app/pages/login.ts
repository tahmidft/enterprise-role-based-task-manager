import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../services/auth';

interface QuickRole {
  label: string;
  email: string;
  dotClass: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  isLoading = signal(false);
  errorMessage = signal('');
  darkMode = signal(false);

  readonly quickRoles: QuickRole[] = [
    { label: 'Owner', email: 'owner@techcorp.com', dotClass: 'role-dot role-dot--owner' },
    { label: 'Admin', email: 'admin@techcorp.com', dotClass: 'role-dot role-dot--admin' },
    { label: 'Manager', email: 'manager@techcorp.com', dotClass: 'role-dot role-dot--manager' },
    { label: 'Member', email: 'member@techcorp.com', dotClass: 'role-dot role-dot--member' },
    { label: 'Viewer', email: 'viewer@techcorp.com', dotClass: 'role-dot role-dot--viewer' },
  ];

  private readonly demoPassword = 'password123';

  ngOnInit(): void {
    this.resetAccentToDefault();
    let dark = false;
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') {
        dark = true;
      } else if (stored === 'light') {
        dark = false;
      } else {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch {
      dark = false;
    }
    this.setTheme(dark);
  }

  toggleTheme(): void {
    this.setTheme(!this.darkMode());
  }

  onSubmit(): void {
    this.loginForm.markAllAsTouched();
    if (!this.loginForm.valid) return;
    this.performLogin(this.loginForm.value.email, this.loginForm.value.password);
  }

  quickLogin(role: QuickRole): void {
    this.loginForm.patchValue({ email: role.email, password: this.demoPassword });
    this.loginForm.markAllAsTouched();
    this.performLogin(role.email, this.demoPassword);
  }

  private performLogin(email: string, password: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        const msg =
          (error as { error?: { message?: string } })?.error?.message ??
          'Login failed. Please check your credentials.';
        this.errorMessage.set(msg);
      },
    });
  }

  private setTheme(dark: boolean): void {
    this.darkMode.set(dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
    document.documentElement.classList.toggle('dark-theme', dark);
    document.body.classList.toggle('dark-theme', dark);
  }

  private resetAccentToDefault(): void {
    const primary = '#6750A4';
    const container = '#EADDFF';
    const onContainer = '#21005D';
    const root = document.documentElement;
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-container', container);
    root.style.setProperty('--on-primary-container', onContainer);
    root.style.setProperty('--md-primary', primary);
    root.style.setProperty('--md-primary-container', container);
    root.style.setProperty('--md-on-primary-container', onContainer);
    root.style.setProperty('--color-primary', primary);

    const styleTag = document.getElementById('dynamic-theme');
    if (styleTag) {
      styleTag.remove();
    }
  }
}
