import type { NumericLike } from './types';

const ONE_DAY_MS = 86_400_000;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'been',
  'were',
  'is',
  'are',
  'you',
  'your',
  'our',
  'about',
  'into',
  'their',
  'they',
  'them',
  'there',
  'will',
  'would',
  'could',
  'should',
  'not',
  'but',
  'can',
  'cant',
  'did',
  'has',
  'had',
  'was',
  'its',
  'via',
  'per',
  'get',
  'got',
  'too',
  'very',
  'just',
  'than',
  'when',
  'what',
  'where',
  'how',
  'why',
  'then',
  'due',
  'after',
  'before',
  'some',
  'more',
  'less',
  'over',
  'under',
  'late',
  'issue',
  'issues',
  'worker',
  'platform',
]);

export function toNumber(value: NumericLike): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  if (typeof value.toNumber === 'function') {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

export function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

export function shiftMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function resolveWindow(
  input: {
    from?: Date;
    to?: Date;
    weeks?: number;
    months?: number;
  },
  fallbackWeeks: number,
): { from: Date; to: Date } {
  const to = input.to ?? new Date();

  if (input.from) {
    return { from: input.from, to };
  }

  if (input.months) {
    return { from: shiftMonths(to, -input.months), to };
  }

  return { from: shiftDays(to, -(input.weeks ?? fallbackWeeks) * 7), to };
}

export function normalize(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return values.map(() => 0);
  }

  if (max === min) {
    return values.map(() => 1);
  }

  return values.map((value) => (value - min) / (max - min));
}

export function extractKeywords(
  texts: string[],
  topN: number,
): Array<{ keyword: string; count: number }> {
  const bucket = new Map<string, number>();

  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));

    for (const word of words) {
      bucket.set(word, (bucket.get(word) ?? 0) + 1);
    }
  }

  return [...bucket.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, topN);
}
