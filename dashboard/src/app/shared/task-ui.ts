export type EvmTraffic = 'green' | 'amber' | 'red';
export type TaskPriority = 'high' | 'medium' | 'low' | string;

export function statusPillClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'pill pill-green';
    case 'in-progress':
      return 'pill pill-amber';
    default:
      return 'pill pill-amber';
  }
}

export function statusChipClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'chip-status-pending';
    case 'in-progress':
      return 'chip-status-in-progress';
    case 'completed':
      return 'chip-status-completed';
    default:
      return 'chip-status-pending';
  }
}

export function priorityPillClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'pill pill-red';
    case 'medium':
      return 'pill pill-amber';
    case 'low':
      return 'pill pill-green';
    default:
      return 'pill pill-amber';
  }
}

export function priorityChipClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'chip-priority-high';
    case 'medium':
      return 'chip-priority-medium';
    case 'low':
      return 'chip-priority-low';
    default:
      return 'chip-priority-medium';
  }
}

/** Kanban card / table row tonal surface by priority */
export function priorityToneClass(priority: string, completed = false): string {
  if (completed) return 'tone-completed';
  switch (priority) {
    case 'high':
      return 'tone-high';
    case 'medium':
      return 'tone-medium';
    case 'low':
      return 'tone-low';
    default:
      return 'tone-medium';
  }
}

export function varianceClass(variance: number): string {
  return variance >= 0 ? 'variance-positive' : 'variance-negative';
}

export function floatClass(float: number | null | undefined): string {
  if (float === null || float === undefined) return '';
  return float <= 0 ? 'float-critical' : 'float-normal';
}

export function evmTrafficClass(level: EvmTraffic): string {
  return `chip-evm-${level === 'amber' ? 'yellow' : level}`;
}

export function evmTrafficFromValue(value: number): EvmTraffic {
  if (value > 1) return 'green';
  if (value >= 0.9) return 'amber';
  return 'red';
}

export function evmPillClass(level: EvmTraffic): string {
  switch (level) {
    case 'green':
      return 'pill pill-green';
    case 'amber':
      return 'pill pill-amber';
    case 'red':
      return 'pill pill-red';
  }
}

export function formatAssignee(task: {
  assignedTo?: { name?: string; email?: string };
  assignedToId?: string;
}): string {
  if (task.assignedTo?.name) return task.assignedTo.name;
  if (task.assignedTo?.email) return task.assignedTo.email;
  if (task.assignedToId) return `User ${task.assignedToId.slice(0, 8)}…`;
  return 'Unassigned';
}

export function initialsFromUser(user?: { name?: string; email?: string }): string {
  const name = user?.name ?? user?.email ?? '';
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function auditActionIconClass(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('create')) return 'audit-icon audit-icon--create';
  if (a.includes('update')) return 'audit-icon audit-icon--update';
  if (a.includes('delete')) return 'audit-icon audit-icon--delete';
  if (a.includes('login')) return 'audit-icon audit-icon--login';
  if (a.includes('auth')) return 'audit-icon audit-icon--auth';
  return 'audit-icon audit-icon--default';
}
