import {
  Component,
  inject,
  OnInit,
  signal,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AnalyticsService, AnalyticsData } from '../../../services/analytics.service';
import { AuthService } from '../../../services/auth';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class AnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  data = signal<AnalyticsData | null>(null);
  isLoading = signal(true);
  error = signal('');

  // We defer chart rendering via setTimeout so Angular has time to
  // render the *ngIf-guarded canvas elements before we try to access them.
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('statusChart') statusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('priorityChart') priorityChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('activityChart') activityChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  ngOnInit(): void {
    this.analyticsService.getAnalytics().subscribe({
      next: d => {
        this.data.set(d);
        this.isLoading.set(false);
        // Force a change detection pass so the *ngIf block renders the canvas
        // elements, then draw charts on the next macro-task.
        this.cdr.detectChanges();
        this.renderTimer = setTimeout(() => this.renderCharts(), 0);
      },
      error: err => {
        this.error.set(err.error?.message || 'Failed to load analytics');
        this.isLoading.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    // Nothing to do here — charts are drawn after data arrives.
  }

  ngOnDestroy(): void {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.charts.forEach(c => c.destroy());
  }

  private renderCharts(): void {
    const d = this.data();
    if (!d) return;

    this.charts.forEach(c => c.destroy());
    this.charts = [];

    const STATUS_COLORS: Record<string, string> = {
      pending:      '#F59E0B',
      'in-progress':'#3B82F6',
      completed:    '#10B981',
      cancelled:    '#6B7280',
    };

    // Status doughnut
    const statusCtx = this.statusChartRef?.nativeElement;
    if (statusCtx && Object.keys(d.tasksByStatus).length > 0) {
      this.charts.push(
        new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(d.tasksByStatus),
            datasets: [{
              data: Object.values(d.tasksByStatus),
              backgroundColor: Object.keys(d.tasksByStatus).map(
                k => STATUS_COLORS[k] ?? '#94A3B8',
              ),
              borderWidth: 2,
            }],
          },
          options: {
            plugins: { legend: { position: 'bottom' } },
            cutout: '60%',
          },
        }),
      );
    }

    // Priority bar
    const priorityCtx = this.priorityChartRef?.nativeElement;
    if (priorityCtx && Object.keys(d.tasksByPriority).length > 0) {
      const PRIORITY_COLORS: Record<string, string> = {
        high:   '#EF4444',
        medium: '#F97316',
        low:    '#6B7280',
      };
      this.charts.push(
        new Chart(priorityCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(d.tasksByPriority),
            datasets: [{
              label: 'Tasks',
              data: Object.values(d.tasksByPriority),
              backgroundColor: Object.keys(d.tasksByPriority).map(
                k => PRIORITY_COLORS[k] ?? '#94A3B8',
              ),
              borderRadius: 4,
            }],
          },
          options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          },
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
            datasets: [{
              label: 'Audit events',
              data: d.auditActivityLast30Days.map(r => r.count),
              borderColor: '#6366F1',
              backgroundColor: 'rgba(99,102,241,0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
            }],
          },
          options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          },
        }),
      );
    }
  }

  readonly Object = Object;

  completionPct(): string {
    const d = this.data();
    if (!d) return '0';
    return (d.completionRate * 100).toFixed(1);
  }

  logout(): void {
    this.authService.logout();
  }
}
