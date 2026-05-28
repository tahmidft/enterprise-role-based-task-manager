import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { EnvironmentService } from '../../../services/environment';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatBadgeModule,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShellComponent implements OnInit {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);

  isOwner = signal(false);
  securityBadge = signal(0);
  userEmail = signal('');

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    this.userEmail.set(user?.email ?? '');
    this.isOwner.set(user?.role?.name === 'owner');
    if (this.isOwner()) {
      this.http
        .get<{ unreadCount: number }>(`${this.env.apiUrl}/security/alerts`)
        .subscribe(r => this.securityBadge.set(r.unreadCount ?? 0));
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
