import db from '@/lib/db';

import {
  type ShiftOcrValidationResult,
  validateShiftAgainstScreenshots,
} from './ai-shift-validator';

const queuedShiftIds: string[] = [];
const queuedLookup = new Set<string>();
let isDrainingQueue = false;

type PersistedShiftAiReview = {
  version: 'shift-ai-review-v1';
  verdict: ShiftOcrValidationResult['verdict'];
  trustScore: number;
  confidence: number;
  model: string;
  summary: string;
  reasons: string[];
  mismatches: Array<{
    field: string;
    claimed: number;
    extracted: number;
    deltaPct: number;
    tolerancePct: number;
  }>;
  generatedAt: string;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildVerifierNote(result: ShiftOcrValidationResult): string {
  const mismatches = result.discrepancies
    .filter((item) => !item.withinTolerance)
    .map((item) => ({
      field: item.field,
      claimed: Number(item.claimed),
      extracted: Number(item.extracted),
      deltaPct: Number(item.deltaPct),
      tolerancePct: Number(item.field === 'hoursWorked' ? 0.15 : 0.08),
    }));

  const payload: PersistedShiftAiReview = {
    version: 'shift-ai-review-v1',
    verdict: result.verdict,
    trustScore: result.trustScore,
    confidence: result.confidence,
    model: result.model,
    summary: result.summary,
    reasons: result.reasons,
    mismatches,
    generatedAt: new Date().toISOString(),
  };

  return JSON.stringify(payload);
}

async function processShiftValidation(shiftId: string): Promise<void> {
  const shift = await db.shiftLog.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      shiftDate: true,
      notes: true,
      verificationStatus: true,
      hoursWorked: true,
      grossEarned: true,
      platformDeductions: true,
      netReceived: true,
      platform: {
        select: {
          name: true,
          slug: true,
        },
      },
      screenshots: {
        select: {
          id: true,
          fileUrl: true,
          status: true,
        },
        orderBy: {
          uploadedAt: 'asc',
        },
        take: 6,
      },
    },
  });

  if (!shift) {
    return;
  }

  if (shift.verificationStatus !== 'PENDING') {
    return;
  }

  const result = await validateShiftAgainstScreenshots({
    shiftId: shift.id,
    platformName: shift.platform.name,
    shiftDate: shift.shiftDate.toISOString().slice(0, 10),
    claimed: {
      hoursWorked: toNumber(shift.hoursWorked),
      grossEarned: toNumber(shift.grossEarned),
      platformDeductions: toNumber(shift.platformDeductions),
      netReceived: toNumber(shift.netReceived),
    },
    screenshotUrls: shift.screenshots.map((item) => item.fileUrl),
    notes: shift.notes ?? null,
  });

  const nextStatus = result.verdict;
  const verifierNotes = buildVerifierNote(result);

  await db.$transaction(async (tx) => {
    await tx.shiftLog.update({
      where: { id: shift.id },
      data: {
        verificationStatus: nextStatus,
      },
    });

    if (shift.screenshots.length > 0) {
      await tx.screenshot.updateMany({
        where: { shiftLogId: shift.id },
        data: {
          status: nextStatus,
          verifierNotes,
          reviewedAt: new Date(),
          verifierId: null,
        },
      });
    }
  });
}

async function drainShiftValidationQueue(): Promise<void> {
  if (isDrainingQueue) {
    return;
  }

  isDrainingQueue = true;

  try {
    while (queuedShiftIds.length > 0) {
      const nextShiftId = queuedShiftIds.shift();
      if (!nextShiftId) {
        continue;
      }

      queuedLookup.delete(nextShiftId);

      try {
        await processShiftValidation(nextShiftId);
      } catch (error) {
        console.error('Shift AI validation failed', {
          shiftId: nextShiftId,
          error,
        });
      }
    }
  } finally {
    isDrainingQueue = false;
  }
}

export function enqueueShiftValidation(shiftId: string): void {
  if (!shiftId || queuedLookup.has(shiftId)) {
    return;
  }

  queuedLookup.add(shiftId);
  queuedShiftIds.push(shiftId);

  void drainShiftValidationQueue();
}
