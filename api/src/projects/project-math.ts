import { BadRequestException } from '@nestjs/common';

export type EvmTask = {
  id: string;
  budgetHours?: number;
  actualHours?: number;
  completionPercent?: number;
  parentTaskId?: string;
};

export type CpmTask = {
  id: string;
  title: string;
  budgetHours?: number;
  dependsOn?: Array<{ id: string }>;
};

type Rollup = { budget: number; actual: number; ev: number };

export function computeEvmFromTasks(tasks: EvmTask[]) {
  const childrenByParent = new Map<string, EvmTask[]>();
  const rootTasks: EvmTask[] = [];

  for (const task of tasks) {
    if (task.parentTaskId) {
      const arr = childrenByParent.get(task.parentTaskId) ?? [];
      arr.push(task);
      childrenByParent.set(task.parentTaskId, arr);
    } else {
      rootTasks.push(task);
    }
  }

  const visit = (task: EvmTask): Rollup => {
    const children = childrenByParent.get(task.id) ?? [];
    if (children.length === 0) {
      const budget = task.budgetHours ?? 0;
      const actual = task.actualHours ?? 0;
      const ev = budget * ((task.completionPercent ?? 0) / 100);
      return { budget, actual, ev };
    }
    return children.reduce<Rollup>(
      (acc, child) => {
        const c = visit(child);
        return { budget: acc.budget + c.budget, actual: acc.actual + c.actual, ev: acc.ev + c.ev };
      },
      { budget: 0, actual: 0, ev: 0 },
    );
  };

  const totals = rootTasks.reduce<Rollup>(
    (acc, task) => {
      const r = visit(task);
      return { budget: acc.budget + r.budget, actual: acc.actual + r.actual, ev: acc.ev + r.ev };
    },
    { budget: 0, actual: 0, ev: 0 },
  );

  return { pv: totals.budget, ev: totals.ev, ac: totals.actual };
}

export function computeCriticalPath(tasks: CpmTask[]) {
  const ids = new Set(tasks.map(t => t.id));
  const duration = (task: CpmTask) => (task.budgetHours && task.budgetHours > 0 ? task.budgetHours : 1);
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const taskById = new Map(tasks.map(t => [t.id, t]));

  for (const task of tasks) {
    indegree.set(task.id, 0);
    outgoing.set(task.id, []);
    incoming.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dep of task.dependsOn ?? []) {
      if (!ids.has(dep.id)) continue;
      outgoing.get(dep.id)!.push(task.id);
      incoming.get(task.id)!.push(dep.id);
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
    }
  }

  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const topo: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    topo.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const nextDeg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDeg);
      if (nextDeg === 0) queue.push(next);
    }
  }

  if (topo.length !== tasks.length) {
    throw new BadRequestException(
      'Dependency cycle detected in project tasks. Please remove circular dependencies.',
    );
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of topo) {
    const preds = incoming.get(id) ?? [];
    const earliest = preds.length ? Math.max(...preds.map(p => ef.get(p) ?? 0)) : 0;
    es.set(id, earliest);
    ef.set(id, earliest + duration(taskById.get(id)!));
  }
  const projectFinish = Math.max(...Array.from(ef.values()), 0);

  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of [...topo].reverse()) {
    const succs = outgoing.get(id) ?? [];
    const latestFinish = succs.length ? Math.min(...succs.map(s => ls.get(s) ?? projectFinish)) : projectFinish;
    lf.set(id, latestFinish);
    ls.set(id, latestFinish - duration(taskById.get(id)!));
  }

  const nodes = topo.map(id => {
    const float = (ls.get(id) ?? 0) - (es.get(id) ?? 0);
    return {
      taskId: id,
      title: taskById.get(id)?.title ?? 'Unknown',
      es: es.get(id) ?? 0,
      ef: ef.get(id) ?? 0,
      ls: ls.get(id) ?? 0,
      lf: lf.get(id) ?? 0,
      float,
    };
  });

  const criticalTaskIds = nodes.filter(n => n.float <= 0.000001).map(n => n.taskId);
  const criticalEdges: Array<{ from: string; to: string }> = [];
  for (const from of criticalTaskIds) {
    for (const to of outgoing.get(from) ?? []) {
      if (criticalTaskIds.includes(to)) criticalEdges.push({ from, to });
    }
  }

  return { projectDuration: projectFinish, nodes, criticalTaskIds, criticalEdges };
}

