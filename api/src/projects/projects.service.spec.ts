import { computeCriticalPath, computeEvmFromTasks } from './project-math';

describe('Project math algorithms', () => {
  const makeTask = (
    id: string,
    budget: number,
    completion: number,
    actual: number,
    startDate?: Date,
    dueDate?: Date,
  ) => ({
    id,
    title: id,
    budgetHours: budget,
    completionPercent: completion,
    actualHours: actual,
    dependsOn: [] as Array<{ id: string }>,
    parentTaskId: undefined as string | undefined,
    startDate,
    dueDate,
  });

  it('computes EVM totals with schedule-based PV', () => {
    const ref = new Date('2026-07-01');
    const t1 = makeTask(
      't1',
      10,
      50,
      6,
      new Date('2026-01-01'),
      new Date('2026-12-31'),
    );
    const t2 = makeTask(
      't2',
      20,
      25,
      5,
      new Date('2026-01-01'),
      new Date('2026-12-31'),
    );
    const res = computeEvmFromTasks([t1, t2], ref);
    expect(res.ev).toBeCloseTo(10);
    expect(res.ac).toBe(11);
    expect(res.totalBudgetHours).toBe(30);
    expect(res.pv).toBeGreaterThan(0);
    expect(res.pv).toBeLessThan(30);
  });

  it('detects dependency cycle for CPM', () => {
    const a = makeTask('a', 4, 0, 0);
    const b = makeTask('b', 3, 0, 0);
    a.dependsOn = [{ id: b.id }];
    b.dependsOn = [{ id: a.id }];
    expect(() => computeCriticalPath([a, b])).toThrow(/Circular dependency detected/);
  });

  it('computes critical path and float', () => {
    const a = makeTask('a', 2, 0, 0);
    const b = makeTask('b', 5, 0, 0);
    const c = makeTask('c', 1, 0, 0);
    b.dependsOn = [{ id: a.id }];
    c.dependsOn = [{ id: a.id }];
    const result = computeCriticalPath([a, b, c]);
    expect(result.projectDuration).toBe(7);
    expect(result.criticalTaskIds).toEqual(expect.arrayContaining(['a', 'b']));
    expect(result.nodes.find(n => n.taskId === 'c')?.criticalPath).toBe(false);
    expect(result.nodes.find(n => n.taskId === 'c')?.float).toBeGreaterThan(0);
  });
});
