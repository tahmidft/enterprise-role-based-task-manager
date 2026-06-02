import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { EnvironmentService } from '../../../services/environment';

interface SecurityAlertItem {
  id: string;
  userId: string;
  userEmail?: string;
  userAvatar?: string;
  riskScore: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons?: string[];
  triggeredFactors?: string[];
  reviewed: boolean;
  createdAt: string;
}

interface SecurityAlertsResponse {
  alerts: SecurityAlertItem[];
  unreadCount: number;
}

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './security.html',
  styleUrl: './security.css',
})
export class SecurityComponent implements OnInit {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  loading = signal(true);
  alerts = signal<SecurityAlertItem[]>([]);
  isOwner = signal(false);

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    this.isOwner.set(user?.role?.name === 'owner');
    if (!this.isOwner()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadAlerts();
  }

  loadAlerts(): void {
    this.loading.set(true);
    this.http.get<SecurityAlertsResponse | SecurityAlertItem[]>(`${this.env.apiUrl}/security/alerts`).subscribe({
      next: r => {
        const list = Array.isArray(r) ? r : r.alerts ?? [];
        this.alerts.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markReviewed(alertId: string): void {
    this.http.patch(`${this.env.apiUrl}/security/alerts/${alertId}/reviewed`, {}).subscribe({
      next: () => {
        this.alerts.update(list => list.map(a => (a.id === alertId ? { ...a, reviewed: true } : a)));
      },
    });
  }

  simulateAlert(): void {
    const current = this.auth.getCurrentUser();
    const factors = ['off-hours', 'bulk-delete', 'ip-change', 'privilege-escalation'];
    const selected = [...factors].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
    const mock: SecurityAlertItem = {
      id: `mock-${Date.now()}`,
      userId: current?.id ?? 'demo-user',
      userEmail: current?.email ?? 'demo@nexuspm.com',
      userAvatar: '',
      riskScore: Math.floor(Math.random() * 21) + 75,
      level: 'HIGH',
      triggeredFactors: selected,
      reasons: selected,
      reviewed: false,
      createdAt: new Date().toISOString(),
    };
    this.alerts.update(list => [mock, ...list]);
    this.snackBar.open('Simulated security alert created (demo only)', 'Close', { duration: 2500 });
  }

  riskClass(score: number): string {
    return score >= 70 ? 'pill pill-red' : score >= 40 ? 'pill pill-amber' : 'pill pill-green';
  }

  reasonLabel(reason: string): string {
    return reason.replace(/[_-]/g, ' ');
  }
}
