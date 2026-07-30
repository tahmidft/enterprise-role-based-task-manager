import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface CpmGanttNode {
  taskId: string;
  title: string;
  float: number;
  duration?: number;
}

export interface CpmGanttEdge {
  from: string;
  to: string;
}

export interface CpmGanttTaskMeta {
  id: string;
  title: string;
  status: string;
  priority: string;
  completionPercent: number;
  budgetHours: number;
  dependsOn?: Array<{ id: string }>;
  startDate?: string;
  dueDate?: string;
}

export interface CpmGanttScheduleTask {
  id: string;
  name: string;
  duration: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  float: number;
  isCritical: boolean;
  dependencies: string[];
  status: string;
  completionPercent: number;
  startDate: Date;
  endDate: Date;
}

interface BarLayout {
  task: CpmGanttScheduleTask;
  rowIndex: number;
  startX: number;
  barWidth: number;
  /** Float mode: width of the solid duration segment (label lives here). */
  durationWidth: number;
  /** Float mode: width of the slack extension (no labels). */
  floatWidth: number;
}

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 32;
const BAR_HEIGHT = 28;
const MIN_BAR_WIDTH = 40;
const MIN_FLOAT_BAR_WIDTH = 4;
const PX_PER_DAY_BASE = 12;
const NAME_COLUMN_WIDTH = 220;
const MIN_TIMELINE_WIDTH = 120;
const TIMELINE_END_BUFFER_DAYS = 3;
const TIMELINE_RIGHT_PADDING_PX = 48;
/** Inset timeline bars/arrows from the name column so dependency lines stay visible. */
const TIMELINE_LEFT_PADDING_PX = 16;

/** Demo schedule aligned with api seed — used only when API dates are missing on a known task. */
const DEMO_SCHEDULE_BY_TITLE: Record<string, { start: string; end: string }> = {
  'Build dashboard epic': { start: '2026-05-01', end: '2026-06-15' },
  'Implement API contracts': { start: '2026-05-01', end: '2026-05-20' },
  'Implement Angular dashboard': { start: '2026-05-15', end: '2026-06-20' },
  'UAT signoff': { start: '2026-06-20', end: '2026-06-30' },
};

@Component({
  selector: 'app-cpm-gantt-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="cpm-shell" [class.cpm-shell--fullscreen]="fullscreen()">
    <div class="cpm-container" [class.cpm-container--fullscreen]="fullscreen()">
      <div class="cpm-toolbar">
        <div class="cpm-toolbar-group cpm-toolbar-group--left">
          <button type="button" class="icon-btn" (click)="zoomOut()" aria-label="Zoom out">
            <i class="ti ti-zoom-out"></i>
          </button>
          <span class="zoom-pill">{{ zoomLevel() }}%</span>
          <button type="button" class="icon-btn" (click)="zoomIn()" aria-label="Zoom in">
            <i class="ti ti-zoom-in"></i>
          </button>
          <button type="button" class="text-btn" (click)="resetZoom()">Reset</button>
          <div class="mode-toggle">
            <button type="button" [class.active]="displayMode() === 'duration'" (click)="setDisplayMode('duration')">Duration</button>
            <button type="button" [class.active]="displayMode() === 'float'" (click)="setDisplayMode('float')">Float</button>
          </div>
        </div>
        <div class="cpm-toolbar-group cpm-toolbar-group--right">
          <mat-slide-toggle
            class="cpm-critical-toggle"
            color="primary"
            [checked]="showOnlyCritical()"
            (change)="setCriticalOnly($event.checked)"
          >
            Critical
          </mat-slide-toggle>
          <button type="button" class="icon-btn" (click)="toggleFullscreen()" aria-label="Fullscreen">
            <i class="ti" [class.ti-arrows-maximize]="!fullscreen()" [class.ti-arrows-minimize]="fullscreen()"></i>
          </button>
          <button type="button" class="icon-btn" [matMenuTriggerFor]="exportMenu" aria-label="Export">
            <i class="ti ti-download"></i>
          </button>
          <mat-menu #exportMenu="matMenu">
            <button mat-menu-item (click)="exportPng()">Export as PNG</button>
            <button mat-menu-item (click)="exportCsv()">Export as CSV</button>
          </mat-menu>
        </div>
      </div>

      <div class="cpm-legend">
        <span><i class="swatch swatch-critical"></i> Critical path</span>
        <span><i class="swatch swatch-normal"></i> Non-critical</span>
        <span><i class="swatch swatch-completed"></i> Completed</span>
        <span><i class="ti ti-arrow-right legend-arrow"></i> Dependency</span>
        <span><i class="today-line-sample"></i> Today</span>
        <span class="legend-meta" *ngIf="showOnlyCritical()">Showing {{ visibleBarLayouts().length }} critical tasks</span>
      </div>

      <div *ngIf="missingDatesWarning()" class="cpm-warn-banner">
        <i class="ti ti-info-circle"></i>
        Some tasks are missing dates — bars show estimated positions
      </div>

      <div *ngIf="loading" class="cpm-state">
        <p>Loading schedule…</p>
      </div>

      <div *ngIf="!loading && scheduleError()" class="cpm-state cpm-state--error">
        <i class="ti ti-alert-triangle"></i>
        <p>{{ scheduleError() }}</p>
      </div>

      <div *ngIf="!loading && !scheduleError() && nodes.length === 0" class="cpm-state">
        <i class="ti ti-git-branch empty-icon"></i>
        <p>No tasks in this project yet</p>
        <p class="muted">Add tasks with dependencies to visualize the critical path.</p>
      </div>

      <div
        *ngIf="!loading && !scheduleError() && nodes.length > 0"
        class="cpm-chart-root"
        #chartRoot
      >
        <p *ngIf="scheduleTasks().length === 1" class="cpm-single-note">
          Add dependencies to see the critical path
        </p>

        <div
          class="cpm-chart-area"
          #chartArea
          (scroll)="onChartAreaScroll()"
          (wheel)="onWheel($event)"
          (mousedown)="onPanStart($event)"
          (mousemove)="onPanMove($event)"
          (mouseup)="onPanEnd()"
          (mouseleave)="onPanEnd()"
        >
          <div
            class="gantt-scroll-inner"
            [style.width.px]="nameColumnWidth + timelinePixelWidth()"
          >
            <div
              class="gantt-grid"
              [style.grid-template-columns]="nameColumnWidth + 'px ' + timelinePixelWidth() + 'px'"
            >
              <div class="gantt-header-name" aria-hidden="true"></div>
              <div class="gantt-header-chart">
                <span
                  *ngFor="let m of monthLabels()"
                  class="cpm-month-label"
                  [style.left.px]="m.x"
                >{{ m.label }}</span>
              </div>

              <ng-container *ngFor="let bar of visibleBarLayouts(); let i = index">
                <div
                  class="gantt-name-cell"
                  [class.gantt-row-alt]="i % 2 === 1"
                  [title]="bar.task.name"
                >
                  {{ bar.task.name }}
                </div>
                <div class="gantt-bar-cell" [class.gantt-row-alt]="i % 2 === 1">
                  <ng-container *ngIf="displayMode() === 'float'; else durationBarBlock">
                    <div
                      class="gantt-bar-float-row"
                      [style.left.px]="bar.startX"
                      [style.width.px]="bar.barWidth"
                    >
                      <div
                        class="gantt-bar gantt-bar--duration-part"
                        [ngClass]="durationBarTone(bar.task)"
                        [style.width.px]="bar.durationWidth"
                        [matTooltip]="barWidthTooSmall(bar) ? bar.task.name : null"
                        matTooltipPosition="above"
                        (click)="onBarClick(bar.task, $event)"
                      >
                        <div
                          class="gantt-bar-progress"
                          [style.width.%]="bar.task.completionPercent"
                        ></div>
                        <span
                          *ngIf="!barWidthTooSmall(bar)"
                          class="gantt-bar-label"
                          [style.padding-left.px]="barLabelInset(bar)"
                        >{{ truncate(bar.task.name, 24) }}</span>
                      </div>
                      <div
                        *ngIf="bar.floatWidth > 0"
                        class="gantt-bar gantt-bar--float gantt-bar--float-part"
                        [style.width.px]="bar.floatWidth"
                        (click)="onBarClick(bar.task, $event)"
                      ></div>
                    </div>
                    <span
                      *ngIf="barWidthTooSmall(bar)"
                      class="gantt-bar-label-external"
                      [style.left.px]="bar.startX + bar.durationWidth + 6"
                    >{{ bar.task.name }}</span>
                  </ng-container>
                  <ng-template #durationBarBlock>
                    <div
                      class="gantt-bar"
                      [ngClass]="barTone(bar.task)"
                      [style.left.px]="bar.startX"
                      [style.width.px]="bar.barWidth"
                      [matTooltip]="barWidthTooSmall(bar) ? bar.task.name : null"
                      matTooltipPosition="above"
                      (click)="onBarClick(bar.task, $event)"
                    >
                      <div
                        class="gantt-bar-progress"
                        [style.width.%]="bar.task.completionPercent"
                      ></div>
                      <span
                        *ngIf="!barWidthTooSmall(bar)"
                        class="gantt-bar-label"
                        [style.padding-left.px]="barLabelInset(bar)"
                      >{{ truncate(bar.task.name, 24) }}</span>
                    </div>
                    <span
                      *ngIf="barWidthTooSmall(bar)"
                      class="gantt-bar-label-external"
                      [style.left.px]="bar.startX + bar.barWidth + 6"
                    >{{ bar.task.name }}</span>
                  </ng-template>
                </div>
              </ng-container>
            </div>

            <div
              *ngIf="todayLineX() !== null"
              class="today-marker"
              [style.left.px]="nameColumnWidth + todayLineX()!"
            >
              <span class="today-pill">Today</span>
            </div>

            <svg
              class="gantt-lines-svg"
              [attr.width]="timelineContentWidth()"
              [attr.height]="chartBodyHeight()"
              [attr.viewBox]="'0 0 ' + timelineContentWidth() + ' ' + chartBodyHeight()"
              [style.left.px]="nameColumnWidth"
              [style.top.px]="HEADER_HEIGHT"
            >
              <line
                *ngFor="let g of monthGridLines()"
                [attr.x1]="g.x"
                y1="0"
                [attr.x2]="g.x"
                [attr.y2]="chartBodyHeight()"
                class="grid-line"
              />
              <line
                *ngIf="todayLineX() !== null"
                [attr.x1]="todayLineX()"
                y1="0"
                [attr.x2]="todayLineX()"
                [attr.y2]="chartBodyHeight()"
                class="today-line"
              />
            </svg>

            <svg
              #arrowLayer
              class="gantt-arrows-svg"
              [attr.width]="timelineContentWidth()"
              [attr.height]="chartBodyHeight()"
              [attr.viewBox]="'0 0 ' + timelineContentWidth() + ' ' + chartBodyHeight()"
              [style.left.px]="nameColumnWidth"
              [style.top.px]="HEADER_HEIGHT"
            ></svg>
          </div>
        </div>

        <div
          *ngIf="tooltip()"
          class="gantt-tooltip"
          [style.left.px]="tooltip()!.x"
          [style.top.px]="tooltip()!.y"
        >
          <strong>{{ tooltip()!.task.name }}</strong>
          <div>Duration: {{ tooltip()!.durationDays }} days</div>
          <div>
            Float:
            {{ tooltip()!.task.isCritical ? 'Critical — no float' : tooltip()!.task.float + ' days' }}
          </div>
          <div>Start: {{ tooltip()!.task.startDate | date: 'mediumDate' }}</div>
          <div>End: {{ tooltip()!.task.endDate | date: 'mediumDate' }}</div>
          <div>Completion: {{ tooltip()!.task.completionPercent }}%</div>
          <span class="status-pill">{{ tooltip()!.task.status }}</span>
        </div>
      </div>

      <input
        *ngIf="!loading && nodes.length > 0 && zoomLevel() > 100 && maxScroll() > 0"
        type="range"
        class="timeline-scroll"
        [min]="0"
        [max]="maxScroll()"
        [(ngModel)]="scrollPos"
        (input)="syncScrollFromSlider()"
      />
    </div>
    </div>
  `,
  styles: [`
    :host {
      --name-column-width: 180px;
      --surface: var(--md-surface);
      --surface-variant: var(--md-surface-variant);
      --primary-container: var(--md-primary-container);
      --on-primary-container: var(--md-on-primary-container);
      --border: var(--md-outline);
      --gantt-row-bg: var(--surface-variant);
      --gantt-chart-bg: var(--gantt-row-bg);
      --gantt-name-bg: var(--gantt-row-bg);
      --gantt-header-bg: var(--gantt-row-bg);
      --gantt-name-text: var(--md-on-surface);
      --gantt-bar-text: #fff;
      --gantt-critical: #b3261e;
      --gantt-critical-light: #e57373;
      --gantt-primary: var(--primary, #6750a4);
      --gantt-primary-light: #9c8dc4;
      --gantt-completed: #43a047;
      --gantt-completed-dark: #2e7d32;
      --gantt-float: #d4a017;
      --gantt-float-light: #e8c547;
      --gantt-today: #cf6679;
      --gantt-grid: rgba(0, 0, 0, 0.1);
      --gantt-row-alt-bg: #ebe6f2;
      --gantt-bar-shadow: 0 2px 6px rgba(103, 80, 164, 0.25);
      --gantt-arrow-critical: #b3261e;
      --gantt-arrow-normal: #6750a4;
      --gantt-arrow-highlight: #c77c00;
      display: block;
      min-width: 0;
      max-width: 100%;
      width: 100%;
      box-sizing: border-box;
    }
    .cpm-shell {
      border-radius: 24px;
      background: var(--surface);
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.06),
        0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      min-width: 0;
      max-width: 100%;
    }
    :host-context(.dark-theme) .cpm-shell {
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.35),
        0 4px 14px rgba(0, 0, 0, 0.45);
    }
    .cpm-shell--fullscreen {
      position: fixed;
      inset: 0;
      z-index: 1000;
      border-radius: 0;
    }
    .cpm-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 360px;
      min-width: 0;
      max-width: 100%;
      padding: 12px 12px 0;
    }
    .cpm-container--fullscreen {
      min-height: 100%;
      padding: 16px;
    }
    .cpm-toolbar {
      display: flex;
      flex-wrap: nowrap;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .cpm-toolbar-group {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 6px;
    }
    .cpm-toolbar-group--right {
      margin-left: auto;
    }
    .cpm-critical-toggle {
      font-size: 12px;
      flex-shrink: 0;
    }
    .zoom-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      background: var(--primary-container);
      color: var(--on-primary-container);
      flex-shrink: 0;
    }
    .icon-btn, .text-btn {
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--md-on-surface);
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .mode-toggle {
      display: inline-flex;
      align-items: stretch;
      border-radius: 999px;
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .mode-toggle button {
      border: none;
      background: transparent;
      color: var(--md-on-surface-secondary);
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      line-height: 1.2;
    }
    .mode-toggle button.active {
      background: var(--primary-container);
      color: var(--on-primary-container);
      border-radius: 999px;
    }
    .cpm-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      color: var(--md-on-surface-secondary);
      align-items: center;
    }
    .swatch {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 3px;
      margin-right: 4px;
      vertical-align: middle;
    }
    .swatch-critical { background: var(--gantt-critical); }
    .swatch-normal { background: var(--gantt-primary); }
    .swatch-completed { background: var(--gantt-completed); }
    .legend-arrow { font-size: 14px; vertical-align: middle; margin-right: 4px; }
    .today-line-sample {
      display: inline-block;
      width: 14px;
      border-top: 2px dashed var(--gantt-today);
      margin-right: 4px;
      vertical-align: middle;
    }
    .legend-meta { margin-left: auto; font-style: italic; }
    .cpm-warn-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--md-primary-tonal, var(--md-surface-variant));
      color: var(--md-on-surface-secondary);
      font-size: 12px;
    }
    .cpm-chart-root {
      position: relative;
      flex: 1;
      min-height: 280px;
      min-width: 0;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      margin: 0 0 12px;
    }
    .cpm-single-note {
      margin: 0 0 8px calc(var(--name-column-width) + 8px);
      font-size: 12px;
      color: var(--gantt-name-text);
      opacity: 0.7;
    }
    .cpm-chart-area {
      flex: 1;
      overflow: auto;
      cursor: grab;
      position: relative;
      border-radius: 16px;
      background: var(--surface-variant);
      min-height: 300px;
      min-width: 0;
      max-width: 100%;
      width: 100%;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    :host-context(.dark-theme) .cpm-chart-area {
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    .cpm-chart-area:active { cursor: grabbing; }
    .gantt-scroll-inner { position: relative; }
    .gantt-grid {
      display: grid;
      position: relative;
    }
    .gantt-header-name {
      height: 32px;
      background-color: var(--gantt-header-bg);
      border-bottom: 0.5px solid var(--md-outline);
      border-right: 1px solid var(--md-outline);
      position: sticky;
      left: 0;
      z-index: 30;
      isolation: isolate;
    }
    .gantt-header-chart {
      height: 32px;
      position: relative;
      background-color: var(--gantt-header-bg);
      border-bottom: 0.5px solid var(--border);
      overflow: visible;
    }
    .cpm-month-label {
      position: absolute;
      top: 8px;
      font-size: 11px;
      color: var(--md-on-surface-secondary);
      white-space: nowrap;
      transform: translateX(4px);
    }
    .today-marker {
      position: absolute;
      top: 38px;
      width: 0;
      height: 0;
      z-index: 5;
      pointer-events: none;
    }
    .today-pill {
      position: absolute;
      top: 0;
      left: 0;
      transform: translateX(-50%);
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      background: var(--gantt-today);
      color: #fff;
      white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    }
    .gantt-name-cell {
      height: 48px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 13px;
      color: var(--gantt-name-text);
      background-color: var(--gantt-name-bg);
      white-space: nowrap;
      overflow: hidden;
      border-bottom: 0.5px solid var(--md-outline);
      position: sticky;
      left: 0;
      z-index: 30;
      isolation: isolate;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08);
    }
    .gantt-bar-cell {
      height: 48px;
      position: relative;
      overflow: visible;
      padding-right: 48px;
      box-sizing: border-box;
      background: var(--gantt-chart-bg);
      border-bottom: 0.5px solid var(--md-outline);
    }
    .gantt-name-cell.gantt-row-alt {
      background-color: var(--gantt-row-alt-bg);
    }
    .gantt-bar-cell.gantt-row-alt {
      background-color: var(--gantt-row-alt-bg);
    }
    .gantt-bar {
      position: absolute;
      top: 10px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      overflow: hidden;
      min-width: 4px;
      box-shadow: var(--gantt-bar-shadow);
    }
    .gantt-bar--critical {
      background: linear-gradient(180deg, var(--gantt-critical-light), var(--gantt-critical));
    }
    .gantt-bar--normal {
      background: linear-gradient(180deg, var(--gantt-primary-light), var(--gantt-primary));
    }
    .gantt-bar--float {
      background: linear-gradient(180deg, var(--gantt-float-light), var(--gantt-float));
    }
    .gantt-bar-float-row {
      position: absolute;
      top: 10px;
      height: 28px;
      display: flex;
      flex-direction: row;
      align-items: stretch;
      min-width: 0;
    }
    .gantt-bar--duration-part {
      position: relative;
      flex: 0 0 auto;
      border-radius: 6px 0 0 6px;
    }
    .gantt-bar--float-part {
      position: relative;
      flex: 0 0 auto;
      border-radius: 0 6px 6px 0;
      min-width: 4px;
    }
    .gantt-bar-float-row .gantt-bar--duration-part:only-child {
      border-radius: 6px;
    }
    .gantt-bar--completed {
      background: linear-gradient(90deg, #2e7d32, #43a047);
      box-shadow: 0 2px 8px rgba(46, 125, 50, 0.25);
    }
    .gantt-bar-progress {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      border-radius: 6px 0 0 6px;
      background: rgba(0, 0, 0, 0.28);
      pointer-events: none;
      max-width: 100%;
    }
    :host-context(.dark-theme) .gantt-bar-progress {
      background: rgba(0, 0, 0, 0.38);
    }
    .gantt-bar-label {
      position: relative;
      z-index: 1;
      font-size: 11px;
      color: var(--gantt-bar-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }
    .gantt-bar-label-external {
      position: absolute;
      top: 10px;
      height: 28px;
      display: flex;
      align-items: center;
      font-size: 11px;
      color: var(--md-on-surface-secondary);
      max-width: 120px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      z-index: 1;
    }
    .gantt-lines-svg,
    .gantt-arrows-svg {
      position: absolute;
      display: block;
      pointer-events: none;
      overflow: hidden;
    }
    .gantt-lines-svg { z-index: 3; }
    .gantt-arrows-svg { z-index: 4; }
    .grid-line {
      stroke: var(--gantt-grid);
      stroke-width: 0.5;
      stroke-dasharray: 4 4;
    }
    .today-line {
      stroke: var(--gantt-today);
      stroke-width: 2;
      stroke-dasharray: 6 4;
    }
    .gantt-tooltip {
      position: absolute;
      z-index: 5;
      min-width: 200px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--md-surface);
      border: 1px solid var(--md-outline);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      font-size: 12px;
      color: var(--md-on-surface);
      pointer-events: none;
    }
    .gantt-tooltip .status-pill {
      display: inline-block;
      margin-top: 6px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      text-transform: capitalize;
    }
    .timeline-scroll {
      width: calc(100% - 32px);
      margin: 0 16px 16px;
    }
    .cpm-state {
      min-height: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--md-on-surface-hint);
      text-align: center;
      padding: 24px;
    }
    .cpm-state .empty-icon { font-size: 48px; }
    .cpm-state .muted { font-size: 13px; }
    .cpm-state--error { color: var(--md-error); }
    :host-context(.dark-theme) {
      --gantt-critical: #cf6679;
      --gantt-critical-light: #e895a8;
      --gantt-primary-light: #8b7cb8;
      --gantt-today: #cf6679;
      --gantt-grid: rgba(255, 255, 255, 0.1);
      --gantt-row-alt-bg: #323038;
      --gantt-bar-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
      --gantt-arrow-critical: #f2b8c6;
      --gantt-arrow-normal: #d0bcff;
      --gantt-arrow-highlight: #ffcc80;
    }
    :host-context(.dark-theme) .gantt-name-cell {
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 2px 0 6px rgba(0, 0, 0, 0.35);
    }
    :host-context(.dark-theme) .gantt-header-name,
    :host-context(.dark-theme) .gantt-name-cell,
    :host-context(.dark-theme) .gantt-bar-cell,
    :host-context(.dark-theme) .gantt-header-chart {
      border-bottom-color: rgba(255, 255, 255, 0.08);
    }
    :host-context(.dark-theme) .gantt-header-name {
      border-right-color: rgba(255, 255, 255, 0.08);
    }
  `],
})
export class CpmGanttChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) nodes: CpmGanttNode[] = [];
  @Input({ required: true }) criticalTaskIds: string[] = [];
  @Input({ required: true }) criticalEdges: CpmGanttEdge[] = [];
  @Input({ required: true }) taskMeta: CpmGanttTaskMeta[] = [];
  @Input() loading = false;

  taskClick = output<CpmGanttScheduleTask>();

  @ViewChild('chartArea') chartArea?: ElementRef<HTMLDivElement>;
  @ViewChild('arrowLayer') arrowLayer?: ElementRef<SVGSVGElement>;
  @ViewChild('chartRoot') chartRoot?: ElementRef<HTMLDivElement>;

  readonly BAR_HEIGHT = BAR_HEIGHT;
  readonly HEADER_HEIGHT = HEADER_HEIGHT;
  readonly nameColumnWidth = NAME_COLUMN_WIDTH;

  private snackBar = inject(MatSnackBar);
  private resizeObserver?: ResizeObserver;

  zoomLevel = signal(100);
  scrollPos = 0;
  showOnlyCritical = signal(false);
  displayMode = signal<'duration' | 'float'>('duration');
  fullscreen = signal(false);
  scheduleTasks = signal<CpmGanttScheduleTask[]>([]);
  scheduleError = signal('');
  missingDatesWarning = signal(false);
  tasksUsingFallback = signal<string[]>([]);
  barLayouts = signal<BarLayout[]>([]);
  chartAreaWidth = signal(600);

  projectStart = signal<Date>(new Date());
  projectEnd = signal<Date>(new Date());

  tooltip = signal<{
    task: CpmGanttScheduleTask;
    x: number;
    y: number;
    durationDays: number;
  } | null>(null);

  private panning = false;
  private panStartX = 0;
  private panStartScroll = 0;
  private syncingScroll = false;

  visibleBarLayouts = computed(() => {
    const source = this.showOnlyCritical()
      ? this.barLayouts().filter(b => b.task.isCritical)
      : this.barLayouts();
    return source.map((bar, i) => ({
      ...bar,
      rowIndex: i,
    }));
  });

  timelineContentWidth = computed(() => {
    const days = this.totalProjectDays();
    const zoom = this.zoomLevel() / 100;
    const natural = Math.max(MIN_TIMELINE_WIDTH, Math.ceil(days * PX_PER_DAY_BASE * zoom));
    const area = Math.max(this.chartAreaWidth(), 240);
    const fitted = Math.max(MIN_TIMELINE_WIDTH, area - NAME_COLUMN_WIDTH);
    let base: number;
    if (this.fullscreen()) {
      base = Math.max(natural, fitted);
    } else if (this.zoomLevel() <= 100) {
      base = Math.min(natural, fitted);
    } else {
      base = Math.max(natural, fitted);
    }
    return base + 120;
  });

  timelinePixelWidth = computed(() => this.timelineContentWidth() + TIMELINE_RIGHT_PADDING_PX);

  chartBodyHeight = computed(() => {
    const rows = Math.max(1, this.visibleBarLayouts().length);
    return rows * ROW_HEIGHT;
  });

  monthLabels = computed(() => {
    const projectStart = this.parseDate(this.projectStart()) ?? this.projectStart();
    const projectEnd = this.parseDate(this.projectEnd()) ?? this.projectEnd();
    const chartWidth = this.timelineContentWidth();
    const totalDays = Math.max(1, this.daysBetween(projectStart, projectEnd));
    const labels: Array<{ label: string; x: number }> = [];
    const cursor = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    let lastX = -999;
    const minGap = 72;
    while (cursor <= projectEnd) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const x =
        (this.daysBetween(projectStart, monthStart) / totalDays) * chartWidth +
        TIMELINE_LEFT_PADDING_PX;
      const label = monthStart.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      if (x >= TIMELINE_LEFT_PADDING_PX && (labels.length === 0 || x - lastX >= minGap)) {
        labels.push({ label, x });
        lastX = x;
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return labels;
  });

  monthGridLines = computed(() => {
    const projectStart = this.parseDate(this.projectStart()) ?? this.projectStart();
    const projectEnd = this.parseDate(this.projectEnd()) ?? this.projectEnd();
    const chartWidth = this.timelineContentWidth();
    const totalDays = Math.max(1, this.daysBetween(projectStart, projectEnd));
    const lines: Array<{ x: number }> = [];
    const cursor = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    while (cursor <= projectEnd) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      lines.push({
        x:
          (this.daysBetween(projectStart, monthStart) / totalDays) * chartWidth +
          TIMELINE_LEFT_PADDING_PX,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return lines;
  });

  todayLineX = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = this.projectStart();
    const end = this.projectEnd();
    if (today < start || today > end) return null;
    return this.dateToPixel(today);
  });

  ngAfterViewInit(): void {
    this.setupResizeObserver();
    this.rebuildSchedule();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes'] || changes['criticalEdges'] || changes['taskMeta'] || changes['criticalTaskIds']) {
      this.rebuildSchedule();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  maxScroll(): number {
    const area = this.chartArea?.nativeElement;
    if (!area) return 0;
    const contentWidth = NAME_COLUMN_WIDTH + this.timelinePixelWidth();
    return Math.max(0, contentWidth - area.clientWidth);
  }

  zoomIn(): void {
    this.zoomLevel.update(z => Math.min(300, z + 25));
    this.recomputeBarLayouts();
  }

  zoomOut(): void {
    this.zoomLevel.update(z => Math.max(100, z - 25));
    this.recomputeBarLayouts();
  }

  resetZoom(): void {
    this.zoomLevel.set(100);
    this.scrollPos = 0;
    this.syncScrollToChart();
    this.recomputeBarLayouts();
  }

  setDisplayMode(mode: 'duration' | 'float'): void {
    this.displayMode.set(mode);
    this.recomputeBarLayouts();
  }

  setCriticalOnly(value: boolean): void {
    this.showOnlyCritical.set(value);
    setTimeout(() => this.drawDependencyArrows(), 0);
  }

  toggleFullscreen(): void {
    this.fullscreen.update(v => !v);
    setTimeout(() => {
      this.measureChartArea();
      this.recomputeBarLayouts();
    }, 80);
  }

  syncScrollFromSlider(): void {
    this.syncScrollToChart();
  }

  onChartAreaScroll(): void {
    if (this.syncingScroll) return;
    const el = this.chartArea?.nativeElement;
    if (!el) return;
    this.scrollPos = el.scrollLeft;
  }

  onWheel(event: WheelEvent): void {
    const el = this.chartArea?.nativeElement;
    if (!el) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) this.zoomIn();
      else this.zoomOut();
      return;
    }
    event.preventDefault();
    this.scrollPos = Math.max(0, Math.min(this.maxScroll(), this.scrollPos + event.deltaY));
    this.syncScrollToChart();
  }

  onPanStart(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('gantt-bar') || target.closest('.gantt-bar')) return;
    this.panning = true;
    this.panStartX = event.clientX;
    this.panStartScroll = this.scrollPos;
  }

  onPanMove(event: MouseEvent): void {
    const root = this.chartRoot?.nativeElement;
    if (!root) return;
    if (this.panning) {
      const delta = this.panStartX - event.clientX;
      this.scrollPos = Math.max(0, Math.min(this.maxScroll(), this.panStartScroll + delta));
      this.syncScrollToChart();
      return;
    }
    const bar = this.hitTestBar(event);
    if (bar) {
      const rect = root.getBoundingClientRect();
      this.tooltip.set({
        task: bar.task,
        x: event.clientX - rect.left + 12,
        y: event.clientY - rect.top + 12,
        durationDays: this.diffDays(bar.task.endDate, bar.task.startDate),
      });
    } else {
      this.tooltip.set(null);
    }
  }

  onPanEnd(): void {
    this.panning = false;
    this.tooltip.set(null);
  }

  onBarClick(task: CpmGanttScheduleTask, event: MouseEvent): void {
    event.stopPropagation();
    this.taskClick.emit(task);
  }

  truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  barTone(task: CpmGanttScheduleTask): string {
    if (this.displayMode() === 'float') {
      return 'gantt-bar--float';
    }
    return this.durationBarTone(task);
  }

  durationBarTone(task: CpmGanttScheduleTask): string {
    if (task.status === 'completed' || task.completionPercent === 100) {
      return 'gantt-bar--completed';
    }
    if (task.isCritical) {
      return 'gantt-bar--critical';
    }
    return 'gantt-bar--normal';
  }

  barWidthTooSmall(bar: BarLayout): boolean {
    const labelWidth = this.displayMode() === 'float' ? bar.durationWidth : bar.barWidth;
    return labelWidth < 80;
  }

  hasIncomingDeps(bar: BarLayout): boolean {
    return bar.task.dependencies.length > 0;
  }

  barLabelInset(bar: BarLayout): number {
    return this.hasIncomingDeps(bar) ? 14 : 8;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.fullscreen()) {
      this.fullscreen.set(false);
      setTimeout(() => this.measureChartArea(), 80);
    }
  }

  exportCsv(): void {
    const rows = this.scheduleTasks();
    const header = [
      'task',
      'duration',
      'float',
      'criticalPath',
      'earlyStart',
      'earlyFinish',
      'lateStart',
      'lateFinish',
    ];
    const lines = rows.map(t =>
      [
        t.name,
        this.diffDays(t.endDate, t.startDate),
        t.float,
        t.isCritical,
        t.earlyStart,
        t.earlyFinish,
        t.lateStart,
        t.lateFinish,
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    this.downloadFile('cpm-schedule.csv', [header.join(','), ...lines].join('\n'), 'text/csv');
    this.snackBar.open('CPM CSV exported', 'Close', { duration: 2000 });
  }

  exportPng(): void {
    const area = this.chartArea?.nativeElement;
    if (!area) return;
    const html2canvasFn = (window as unknown as { html2canvas?: (el: HTMLElement) => Promise<HTMLCanvasElement> })
      .html2canvas;
    if (html2canvasFn) {
      html2canvasFn(area)
        .then(canvas => {
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = `cpm-gantt-${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          this.snackBar.open('CPM PNG exported', 'Close', { duration: 2000 });
        })
        .catch(() => this.exportPngFromSvg());
      return;
    }
    this.exportPngFromSvg();
  }

  private exportPngFromSvg(): void {
    const area = this.chartArea?.nativeElement;
    if (!area) return;
    const svg = area.querySelector('.gantt-lines-svg') as SVGSVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth || 800;
      canvas.height = svg.clientHeight || 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--md-surface-variant').trim();
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `cpm-gantt-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.snackBar.open('CPM PNG exported', 'Close', { duration: 2000 });
    };
    img.src = url;
  }

  private setupResizeObserver(): void {
    const el = this.chartArea?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') {
      this.measureChartArea();
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.measureChartArea();
      this.recomputeBarLayouts();
    });
    this.resizeObserver.observe(el);
  }

  private measureChartArea(): void {
    const w = this.chartArea?.nativeElement?.clientWidth ?? 600;
    if (w > 0) this.chartAreaWidth.set(w);
  }

  private syncScrollToChart(): void {
    const el = this.chartArea?.nativeElement;
    if (!el) return;
    this.syncingScroll = true;
    el.scrollLeft = this.scrollPos;
    this.syncingScroll = false;
  }

  private rebuildSchedule(): void {
    this.scheduleError.set('');
    if (!this.nodes.length) {
      this.scheduleTasks.set([]);
      this.barLayouts.set([]);
      return;
    }

    const metaById = this.buildMetaById();
    const edges = this.buildEdges();
    const cycle = this.detectCycle(edges);
    if (cycle) {
      const fromName = this.nodes.find(n => n.taskId === cycle.from)?.title ?? cycle.from;
      const toName = this.nodes.find(n => n.taskId === cycle.to)?.title ?? cycle.to;
      this.scheduleError.set(
        `Circular dependency detected — CPM cannot be calculated between "${fromName}" and "${toName}"`,
      );
      this.scheduleTasks.set([]);
      this.barLayouts.set([]);
      return;
    }

    const durationById = new Map<string, number>();
    for (const n of this.nodes) {
      const meta = metaById.get(n.taskId);
      const duration = Math.max(1, Math.round(n.duration ?? meta?.budgetHours ?? 1));
      durationById.set(n.taskId, duration);
    }

    const topo = this.topologicalSort(this.nodes.map(n => n.taskId), edges);
    const earlyStart = new Map<string, number>();
    const earlyFinish = new Map<string, number>();

    for (const id of topo) {
      const preds = edges.filter(e => e.to === id).map(e => e.from);
      const es = preds.length ? Math.max(...preds.map(p => earlyFinish.get(p) ?? 0)) : 0;
      const dur = durationById.get(id) ?? 1;
      earlyStart.set(id, es);
      earlyFinish.set(id, es + dur);
    }

    const projectEndDay = Math.max(...[...earlyFinish.values()], 1);
    const lateFinish = new Map<string, number>();
    const lateStart = new Map<string, number>();

    for (const id of [...topo].reverse()) {
      const succs = edges.filter(e => e.from === id).map(e => e.to);
      const lf = succs.length ? Math.min(...succs.map(s => lateStart.get(s) ?? projectEndDay)) : projectEndDay;
      const dur = durationById.get(id) ?? 1;
      lateFinish.set(id, lf);
      lateStart.set(id, lf - dur);
    }

    const criticalSet = new Set(this.criticalTaskIds);
    const scheduled: CpmGanttScheduleTask[] = this.nodes.map(n => {
      const meta = metaById.get(n.taskId);
      const duration = durationById.get(n.taskId) ?? 1;
      const es = earlyStart.get(n.taskId) ?? 0;
      const ef = earlyFinish.get(n.taskId) ?? duration;
      const ls = lateStart.get(n.taskId) ?? es;
      const lf = lateFinish.get(n.taskId) ?? ef;
      const floatVal = n.float ?? Math.max(0, ls - es);
      const placeholderStart = new Date();
      const placeholderEnd = new Date();
      return {
        id: n.taskId,
        name: n.title,
        duration,
        earlyStart: es,
        earlyFinish: ef,
        lateStart: ls,
        lateFinish: lf,
        float: floatVal,
        isCritical: criticalSet.has(n.taskId) || floatVal <= 0,
        dependencies: edges.filter(e => e.to === n.taskId).map(e => e.from),
        status: meta?.status ?? 'pending',
        completionPercent: meta?.completionPercent ?? 0,
        startDate: placeholderStart,
        endDate: placeholderEnd,
      };
    });

    this.assignCalendarDates(scheduled, metaById);
    this.scheduleTasks.set(scheduled);
    this.measureChartArea();
    this.recomputeBarLayouts();
  }

  private buildMetaById(): Map<string, CpmGanttTaskMeta> {
    const metaById = new Map<string, CpmGanttTaskMeta>();
    for (const m of this.taskMeta) {
      metaById.set(m.id, m);
    }
    for (const node of this.nodes) {
      if (metaById.has(node.taskId)) continue;
      const byTitle = this.taskMeta.find(m => m.title === node.title);
      if (byTitle) {
        metaById.set(node.taskId, { ...byTitle, id: node.taskId, title: node.title });
      }
    }
    return metaById;
  }

  private demoScheduleForTitle(title: string): { start: Date; end: Date } | null {
    const demo = DEMO_SCHEDULE_BY_TITLE[title];
    if (!demo) return null;
    const start = this.parseDate(demo.start);
    const end = this.parseDate(demo.end);
    if (!start || !end) return null;
    return { start, end };
  }

  private resolveTaskDates(
    task: CpmGanttScheduleTask,
    meta: CpmGanttTaskMeta | undefined,
    preferDemoSchedule: boolean,
  ): { start: Date; end: Date; usedFallback: boolean } {
    const budgetDays = Math.max(1, Math.ceil((meta?.budgetHours ?? task.duration ?? 5) / 8));
    let metaStart = this.parseDate(meta?.startDate);
    let metaEnd = this.parseDate(meta?.dueDate);

    if (preferDemoSchedule || (!metaStart && !metaEnd)) {
      const demo = this.demoScheduleForTitle(task.name);
      if (demo) {
        return { start: demo.start, end: demo.end, usedFallback: false };
      }
    }

    if (metaStart && metaEnd) {
      return { start: metaStart, end: metaEnd, usedFallback: false };
    }
    if (metaStart && !metaEnd) {
      return {
        start: metaStart,
        end: this.addDays(metaStart, budgetDays),
        usedFallback: false,
      };
    }
    if (!metaStart && metaEnd) {
      return {
        start: this.addDays(metaEnd, -budgetDays),
        end: metaEnd,
        usedFallback: false,
      };
    }
    return {
      start: new Date(),
      end: this.addDays(new Date(), budgetDays),
      usedFallback: true,
    };
  }

  private assignCalendarDates(
    tasks: CpmGanttScheduleTask[],
    metaById: Map<string, CpmGanttTaskMeta>,
  ): void {
    this.tasksUsingFallback.set([]);
    this.missingDatesWarning.set(false);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fallbackStart = this.addDays(today, -30);
    const fallbackEnd = this.addDays(today, 30);

    const undatedIndices: number[] = [];
    const fallbackTaskNames: string[] = [];
    const preferDemoSchedule = this.shouldPreferDemoSchedule(tasks, metaById);

    tasks.forEach((task, index) => {
      const meta = metaById.get(task.id);
      const resolved = this.resolveTaskDates(task, meta, preferDemoSchedule);
      if (resolved.usedFallback) {
        undatedIndices.push(index);
        return;
      }
      task.startDate = resolved.start;
      task.endDate = resolved.end;
    });

    let projectStart = fallbackStart;
    let projectEnd = fallbackEnd;

    if (undatedIndices.length > 0) {
      const slotDays = 60 / Math.max(1, undatedIndices.length);
      undatedIndices.forEach((taskIndex, i) => {
        const task = tasks[taskIndex];
        const meta = metaById.get(task.id);
        const budgetDays = Math.max(1, Math.ceil((meta?.budgetHours ?? task.duration ?? 5) / 8));
        const offsetDays = Math.floor(i * slotDays);
        task.startDate = this.addDays(fallbackStart, offsetDays);
        task.endDate = this.addDays(task.startDate, Math.max(budgetDays, Math.floor(slotDays * 0.85)));
        fallbackTaskNames.push(task.name);
      });
    }

    const validStarts = tasks
      .map(t => this.parseDate(t.startDate))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()));
    const validEnds = tasks
      .map(t => this.parseDate(t.endDate))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()));

    if (validStarts.length > 0) {
      projectStart = new Date(Math.min(...validStarts.map(d => d.getTime())));
    }
    if (validEnds.length > 0) {
      projectEnd = new Date(Math.max(...validEnds.map(d => d.getTime())));
    }
    if (projectEnd.getTime() <= projectStart.getTime()) {
      projectEnd = this.addDays(projectStart, 60);
    }
    projectEnd = this.addDays(projectEnd, TIMELINE_END_BUFFER_DAYS);

    this.projectStart.set(projectStart);
    this.projectEnd.set(projectEnd);
    this.tasksUsingFallback.set(fallbackTaskNames);
    this.missingDatesWarning.set(fallbackTaskNames.length > 0);
  }

  /** Stale seed often gives every task the same range — use per-title demo dates instead. */
  private shouldPreferDemoSchedule(
    tasks: CpmGanttScheduleTask[],
    metaById: Map<string, CpmGanttTaskMeta>,
  ): boolean {
    if (tasks.length < 2) return false;
    const signatures = new Set<string>();
    let datedCount = 0;
    for (const task of tasks) {
      const meta = metaById.get(task.id);
      const start = this.parseDate(meta?.startDate);
      const end = this.parseDate(meta?.dueDate);
      if (!start || !end) continue;
      datedCount++;
      signatures.add(`${start.getTime()}-${end.getTime()}`);
    }
    if (datedCount < 2) return false;
    if (signatures.size === 1) return true;
    const demoTitles = tasks.filter(t => DEMO_SCHEDULE_BY_TITLE[t.name]).length;
    return demoTitles >= 2 && signatures.size <= Math.max(1, Math.floor(datedCount / 2));
  }

  private recomputeBarLayouts(): void {
    const tasks = this.scheduleTasks();
    if (!tasks.length) {
      this.barLayouts.set([]);
      return;
    }

    const projectStart = this.parseDate(this.projectStart()) ?? this.projectStart();
    const projectEnd = this.parseDate(this.projectEnd()) ?? this.projectEnd();
    const totalDays = Math.max(1, this.daysBetween(projectStart, projectEnd));
    const chartWidth = this.timelineContentWidth();
    const layouts: BarLayout[] = [];

    tasks.forEach((task, rowIndex) => {
      const taskStart = this.parseDate(task.startDate);
      const taskEnd = this.parseDate(task.endDate);
      if (!taskStart || !taskEnd) {
        return;
      }

      let startX: number;
      let barWidth: number;
      let durationWidth = 0;
      let floatWidth = 0;

      if (this.displayMode() === 'float') {
        const pixelsPerDay = PX_PER_DAY_BASE * (this.zoomLevel() / 100);
        const floatDays = Math.max(0, task.float / 8);
        startX = (this.daysBetween(projectStart, taskStart) / totalDays) * chartWidth;
        const duration = Math.max(1, this.daysBetween(taskStart, taskEnd));
        durationWidth = Math.max(duration * pixelsPerDay, MIN_FLOAT_BAR_WIDTH);
        floatWidth =
          floatDays === 0
            ? 0
            : Math.max(MIN_FLOAT_BAR_WIDTH, floatDays * pixelsPerDay);
        barWidth = durationWidth + floatWidth;
      } else {
        startX = (this.daysBetween(projectStart, taskStart) / totalDays) * chartWidth;
        const duration = Math.max(1, this.daysBetween(taskStart, taskEnd));
        barWidth = Math.max((duration / totalDays) * chartWidth, MIN_BAR_WIDTH);
        durationWidth = barWidth;
      }

      if (!Number.isFinite(startX) || Number.isNaN(startX)) startX = rowIndex * (MIN_BAR_WIDTH + 8);
      if (!Number.isFinite(barWidth) || Number.isNaN(barWidth)) barWidth = MIN_BAR_WIDTH;

      startX += TIMELINE_LEFT_PADDING_PX;
      // Use the full grid column width minus right padding as the drawable boundary
      const drawableRight = this.timelinePixelWidth() - TIMELINE_RIGHT_PADDING_PX;
      startX = Math.max(
        TIMELINE_LEFT_PADDING_PX,
        Math.min(startX, drawableRight - MIN_FLOAT_BAR_WIDTH),
      );

      if (this.displayMode() === 'float') {
        // In float mode, cap only the float extension so the duration bar is unaffected
        const barEnd = startX + durationWidth + floatWidth;
        if (barEnd > drawableRight && floatWidth > 0) {
          floatWidth = Math.max(0, floatWidth - (barEnd - drawableRight));
        }
        barWidth = Math.max(MIN_FLOAT_BAR_WIDTH, durationWidth + floatWidth);
      } else {
        // In duration mode, cap the full bar width
        const maxBarWidth = Math.max(0, drawableRight - startX);
        barWidth = Math.max(MIN_BAR_WIDTH, Math.min(barWidth, maxBarWidth));
        durationWidth = barWidth;
      }

      layouts.push({
        task,
        rowIndex,
        startX,
        barWidth,
        durationWidth,
        floatWidth,
      });
    });

    this.barLayouts.set(layouts);
    setTimeout(() => this.drawDependencyArrows(), 0);
  }

  private dateToPixel(date: Date): number {
    const projectStart = this.parseDate(this.projectStart()) ?? this.projectStart();
    const totalDays = this.totalProjectDays();
    const chartWidth = this.timelineContentWidth();
    const parsed = this.parseDate(date) ?? date;
    return (
      (this.daysBetween(projectStart, parsed) / totalDays) * chartWidth +
      TIMELINE_LEFT_PADDING_PX
    );
  }

  private totalProjectDays(): number {
    const projectStart = this.parseDate(this.projectStart()) ?? this.projectStart();
    const projectEnd = this.parseDate(this.projectEnd()) ?? this.projectEnd();
    return Math.max(1, this.daysBetween(projectStart, projectEnd));
  }

  private hitTestBar(event: MouseEvent): BarLayout | null {
    const target = event.target as HTMLElement;
    const barEl = target.closest('.gantt-bar');
    if (barEl) {
      const row = barEl.closest('.gantt-bar-cell');
      const grid = barEl.closest('.gantt-grid');
      if (!row || !grid) return null;
      const rowCells = Array.from(grid.querySelectorAll('.gantt-bar-cell'));
      const rowIndex = rowCells.indexOf(row as Element);
      const layouts = this.visibleBarLayouts();
      return layouts[rowIndex] ?? null;
    }
    return null;
  }

  private rowCenterY(rowIndex: number): number {
    return rowIndex * ROW_HEIGHT + 10 + BAR_HEIGHT / 2;
  }

  /** Route dependency arrows in the bar-area coordinate system (0 = left edge of timeline). */
  private dependencyArrowPath(
    fromBar: BarLayout,
    toBar: BarLayout,
    elbow: number,
  ): string {
    const pad = TIMELINE_LEFT_PADDING_PX;
    const x1 = Math.max(pad, fromBar.startX + fromBar.barWidth);
    const y1 = this.rowCenterY(fromBar.rowIndex);
    const barStart = Math.max(pad, toBar.startX);
    const y2 = this.rowCenterY(toBar.rowIndex);
    const arrowTipGap = 6;
    const x2 = Math.max(pad, barStart - arrowTipGap);

    if (x2 >= x1 + elbow) {
      return `M ${x1} ${y1} H ${x1 + elbow} V ${y2} H ${x2}`;
    }

    const bridgeY =
      fromBar.rowIndex < toBar.rowIndex
        ? (fromBar.rowIndex + 1) * ROW_HEIGHT - 6
        : fromBar.rowIndex * ROW_HEIGHT - 4;
    return `M ${x1} ${y1} H ${x1 + elbow} V ${bridgeY} H ${x2} V ${y2} H ${x2}`;
  }

  private dependencyArrowColor(from: CpmGanttScheduleTask, to: CpmGanttScheduleTask): string {
    if (from.isCritical && to.isCritical) {
      return this.cssVar('--gantt-arrow-critical');
    }
    if (!from.isCritical && !to.isCritical) {
      return this.cssVar('--gantt-arrow-normal');
    }
    if (!from.isCritical && to.isCritical) {
      return this.cssVar('--gantt-arrow-highlight');
    }
    return this.cssVar('--gantt-arrow-normal');
  }

  private drawDependencyArrows(): void {
    const svg = this.arrowLayer?.nativeElement;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const chartW = this.timelineContentWidth();
    const chartH = this.chartBodyHeight();

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clip.setAttribute('id', 'cpm-chart-clip');
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', String(TIMELINE_LEFT_PADDING_PX - 2));
    clipRect.setAttribute('y', '0');
    clipRect.setAttribute('width', String(chartW - TIMELINE_LEFT_PADDING_PX + 2));
    clipRect.setAttribute('height', String(chartH));
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    defs.insertAdjacentHTML(
      'beforeend',
      `
      <marker id="cpm-arrowhead-critical" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L0,8 L8,4 z" fill="${this.cssVar('--gantt-arrow-critical')}"/>
      </marker>
      <marker id="cpm-arrowhead-normal" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L0,8 L8,4 z" fill="${this.cssVar('--gantt-arrow-normal')}"/>
      </marker>
      <marker id="cpm-arrowhead-highlight" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L0,8 L8,4 z" fill="${this.cssVar('--gantt-arrow-highlight')}"/>
      </marker>
    `,
    );
    svg.appendChild(defs);
    svg.setAttribute('clip-path', 'url(#cpm-chart-clip)');

    const byId = new Map(this.visibleBarLayouts().map(b => [b.task.id, b]));
    const visibleIds = new Set(byId.keys());
    const elbow = 12;

    for (const edge of this.buildEdges()) {
      if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue;
      const fromBar = byId.get(edge.from);
      const toBar = byId.get(edge.to);
      if (!fromBar || !toBar) continue;

      const fromTask = fromBar.task;
      const toTask = toBar.task;
      const stroke = this.dependencyArrowColor(fromTask, toTask);
      const markerId =
        fromTask.isCritical && toTask.isCritical
          ? 'cpm-arrowhead-critical'
          : !fromTask.isCritical && toTask.isCritical
            ? 'cpm-arrowhead-highlight'
            : 'cpm-arrowhead-normal';

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', this.dependencyArrowPath(fromBar, toBar, elbow));
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', stroke);
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-opacity', '1');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');
      line.setAttribute('marker-end', `url(#${markerId})`);
      svg.appendChild(line);
    }
  }

  private buildEdges(): CpmGanttEdge[] {
    const nodeIds = new Set(this.nodes.map(n => n.taskId));
    const edgeMap = new Map<string, CpmGanttEdge>();
    for (const e of this.criticalEdges) {
      if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
        edgeMap.set(`${e.from}-${e.to}`, e);
      }
    }
    for (const t of this.taskMeta) {
      for (const dep of t.dependsOn ?? []) {
        if (nodeIds.has(dep.id) && nodeIds.has(t.id)) {
          edgeMap.set(`${dep.id}-${t.id}`, { from: dep.id, to: t.id });
        }
      }
    }
    let edges = [...edgeMap.values()];
    // Only invent a linear chain when there are no real edges at all (empty demo).
    if (edges.length === 0 && this.nodes.length > 1) {
      const order = [
        ...this.criticalTaskIds.filter(id => nodeIds.has(id)),
        ...this.nodes.map(n => n.taskId).filter(id => !this.criticalTaskIds.includes(id)),
      ];
      const deduped = [...new Set(order)];
      edges = deduped.slice(0, -1).map((id, idx) => ({ from: id, to: deduped[idx + 1] }));
    }
    return edges;
  }

  private topologicalSort(ids: string[], edges: CpmGanttEdge[]): string[] {
    const incoming = new Map(ids.map(id => [id, 0]));
    for (const e of edges) {
      if (incoming.has(e.to)) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
    }
    const queue = ids.filter(id => (incoming.get(id) ?? 0) === 0);
    const out: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      out.push(id);
      for (const e of edges.filter(edge => edge.from === id)) {
        incoming.set(e.to, (incoming.get(e.to) ?? 1) - 1);
        if ((incoming.get(e.to) ?? 0) === 0) queue.push(e.to);
      }
    }
    return out.length === ids.length ? out : ids;
  }

  private detectCycle(edges: CpmGanttEdge[]): CpmGanttEdge | null {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from)!.push(e.to);
    }
    const dfs = (node: string): string | null => {
      if (visiting.has(node)) return node;
      if (visited.has(node)) return null;
      visiting.add(node);
      for (const next of adj.get(node) ?? []) {
        const hit = dfs(next);
        if (hit) return hit;
      }
      visiting.delete(node);
      visited.add(node);
      return null;
    };
    for (const n of this.nodes) {
      const hit = dfs(n.taskId);
      if (hit) {
        const from = edges.find(e => e.to === hit)?.from ?? hit;
        return { from, to: hit };
      }
    }
    return null;
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const raw = String(value);
    const datePart = raw.length >= 10 ? raw.slice(0, 10) : raw;
    const parts = datePart.split('-').map(Number);
    if (parts.length < 3 || parts.some(n => Number.isNaN(n))) return null;
    const [year, month, day] = parts;
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private addDays(date: Date, days: number): Date {
    const next = this.parseDate(date) ?? new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private daysBetween(a: Date, b: Date): number {
    const start = this.parseDate(a) ?? a;
    const end = this.parseDate(b) ?? b;
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private diffDays(end: Date, start: Date): number {
    return this.daysBetween(start, end);
  }

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#6750a4';
  }

  private downloadFile(name: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
