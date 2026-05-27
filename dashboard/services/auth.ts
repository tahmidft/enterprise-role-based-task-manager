import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { IUser, LoginDto, RegisterDto } from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';
import { EnvironmentService } from './environment';

interface AuthResponse {
  access_token: string;
  user: IUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private env = inject(EnvironmentService);

  private readonly TOKEN_KEY = 'auth_token';

  private currentUserSubject = new BehaviorSubject<IUser | null>(this.getUserFromToken());
  currentUser$ = this.currentUserSubject.asObservable();

  isAuthenticated = signal<boolean>(this.hasToken());

  constructor() {
    if (this.hasToken() && !this.getUserFromToken()) {
      this.logout();
    }
  }

  login(credentials: LoginDto): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.env.apiUrl}/auth/login`, credentials, { withCredentials: true })
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  register(userData: RegisterDto): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.env.apiUrl}/auth/register`, userData, { withCredentials: true })
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  refreshToken(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.env.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  logout(): void {
    this.http
      .post(`${this.env.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSubject.next(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): IUser | null {
    return this.currentUserSubject.value;
  }

  private handleAuthSuccess(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.access_token);
    this.currentUserSubject.next(response.user);
    this.isAuthenticated.set(true);
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }

  private getUserFromToken(): IUser | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() >= payload.exp * 1000) return null;
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as IUser;
    } catch {
      return null;
    }
  }
}
