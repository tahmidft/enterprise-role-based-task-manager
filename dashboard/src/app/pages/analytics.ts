import {
  Component,
  inject,
  OnInit,
  signal,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AnalyticsService, AnalyticsData } from '../../../services/analytics.service';
import { ThemeToggleComponent } from '../components/theme-toggle';
import { AuthService } from '../../../services/auth';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class AnalyticsComponent implements OnInit, AfterViewInit {
  private analyticsService = inject(AnalyticsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  data = signal<AnalyticsData | null>(null);
  isLoading = signal(true);
  error = signal('');

  private chartsReady = false;
  private dataReady = false;

  @ViewChild('statusChart') statusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('priorityChart') priorityChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('activityChart') activityChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  ngOnInit(): void {
    this.analyticsService.getAnalytics().subscribe({
      next: d => {
        this.data.set(d);
        this.isLoading.set(false);
        this.dataReady = true;
        if (this.chartsReady) this.renderCharts();
      },
      error: err => {
        this.error.set(err.error?.message || 'Failed to load analytics');
        this.isLoading.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    if (this.dataReady) this.renderCharts();
  }

  private renderCharts(): void {
    const d = this.data();
    if (!d) return;

    this.charts.forEach(c => c.destroy());
    this.charts = [];

    // Status pie
    const statusCtx = this.statusChartRef?.nativeElement;
    if (statusCtx) {
      this.charts.push(
        new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(d.tasksByStatus),
            datasets: [
              {
                data: Object.values(d.tasksByStatus),
                backgroundColor: ['#F59E0B', '#3B82F6', '#10B981', '#6B7280'],
              },
            ],
          },
          options: { plugins: { legend: { position: 'bottom' } } },
        }),
      );
    }

    // Priority bar
    const priorityCtx = this.priorityChartRef?.nativeElement;
    if (priorityCtx) {
      this.charts.push(
        new Chart(priorityCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(d.tasksByPriority),
            datasets: [
              {
                label: 'Tasks',
                data: Object.values(d.tasksByPriority),
                backgroundColor: ['#EF4444', '#F97316', '#6B7280'],
              },
            ],
          },
          options: { plugins: { legend: { display: false } } },
        }),
      );
    }

    // Activity line
    const activityCtx = this.activityChartRef?.nativeElement;
    if (activityCtx && d.auditActivityLast30Days.length > 0) {
      this.charts.push(
        new Chart(activityCtx, {
          type: 'line',
          data: {
            labels: d.auditActivityLast30Days.map(r => r.date),
            datasets: [
              {
                label: 'Audit events',
                data: d.auditActivityLast30Days.map(r => r.count),
                borderColor: '#6366F1',
                backgroundColor: 'rgba(99,102,241,0.15)',
                fill: true,
                tension: 0.3,
              },
            ],
          },
        }),
      );
    }
  }

  completionPct(): string {
    const d = this.data();
    if (!d) return '0';
    return (d.completionRate * 100).toFixed(1);
  }

  back(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}
