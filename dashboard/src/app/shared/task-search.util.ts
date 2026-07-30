export interface TaskSearchRecord {
  id: string;
  title: string;
  priority: string;
  status: string;
  description?: string;
}

export interface TaskSearchHit extends TaskSearchRecord {
  score: number;
}

export function fuzzyMatchTasks(
  query: string,
  tasks: TaskSearchRecord[],
  limit = 8,
): TaskSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return tasks
    .map(task => ({
      ...task,
      score: fuzzyScore(q, task.title, task.description),
    }))
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function fuzzyScore(query: string, title: string, description?: string): number {
  const titleScore = scoreField(query, title);
  const descScore = description ? scoreField(query, description) * 0.55 : 0;
  return Math.max(titleScore, descScore);
}

function scoreField(query: string, text: string): number {
  const t = text.toLowerCase();
  if (t === query) return 10_000;
  if (t.startsWith(query)) return 5_000 + (200 - t.length);
  const idx = t.indexOf(query);
  if (idx >= 0) return 3_000 - idx;

  for (const word of t.split(/\s+/)) {
    if (word.startsWith(query)) return 2_000;
    if (query.length >= 2 && subsequenceMatch(query, word)) return 1_200;
  }

  if (subsequenceMatch(query, t)) {
    return subsequenceScore(query, t);
  }
  return 0;
}

function subsequenceMatch(query: string, text: string): boolean {
  let ti = 0;
  for (const ch of query) {
    ti = text.indexOf(ch, ti);
    if (ti === -1) return false;
    ti += 1;
  }
  return true;
}

function subsequenceScore(query: string, text: string): number {
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of query) {
    const pos = text.indexOf(ch, ti);
    if (pos === -1) return 0;
    streak = pos === ti ? streak + 1 : 0;
    score += 12 + streak * 6 - pos * 0.4;
    ti = pos + 1;
  }
  return Math.min(score, 1_500);
}

export interface TitlePart {
  text: string;
  match: boolean;
}

/** Split title into matched / unmatched spans for contiguous query hits. */
export function titleMatchParts(title: string, query: string): TitlePart[] {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text: title, match: false }];

  const lower = title.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx >= 0) {
    const parts: TitlePart[] = [];
    if (idx > 0) parts.push({ text: title.slice(0, idx), match: false });
    parts.push({ text: title.slice(idx, idx + q.length), match: true });
    if (idx + q.length < title.length) {
      parts.push({ text: title.slice(idx + q.length), match: false });
    }
    return parts;
  }

  return fuzzyHighlightParts(title, q);
}

function fuzzyHighlightParts(title: string, query: string): TitlePart[] {
  const lower = title.toLowerCase();
  const matched = new Set<number>();
  let ti = 0;
  for (const ch of query) {
    const pos = lower.indexOf(ch, ti);
    if (pos === -1) break;
    matched.add(pos);
    ti = pos + 1;
  }
  if (matched.size === 0) return [{ text: title, match: false }];

  const parts: TitlePart[] = [];
  let buf = '';
  let bufMatch = matched.has(0);
  for (let i = 0; i < title.length; i++) {
    const isMatch = matched.has(i);
    if (i > 0 && isMatch !== bufMatch) {
      parts.push({ text: buf, match: bufMatch });
      buf = '';
      bufMatch = isMatch;
    }
    buf += title[i];
  }
  if (buf) parts.push({ text: buf, match: bufMatch });
  return parts;
}

export function taskStatusLabel(status: string): string {
  switch (status) {
    case 'in-progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    default:
      return 'Pending';
  }
}
