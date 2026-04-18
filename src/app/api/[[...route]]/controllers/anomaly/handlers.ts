import { zValidator } from '@hono/zod-validator';
import * as fs from 'fs';
import * as path from 'path';
import db from '@/lib/db';
import { Context } from 'hono';
import { WorkerCategory } from '@/generated/prisma/client';

const OPENROUTER_DEFAULT_MODEL = 'google/gemma-2-9b-it:free';

const ANOMALY_ENRICHMENT_SYSTEM_PROMPT = `You are a friendly helper for gig delivery riders.
We checked their recent pay and found some issues. Explain these issues using very, very simple and easy-to-understand words.

Rules:
- Speak as if you are talking to a friend who doesn't know tech or math.
- Never use complex words. Do NOT say "algorithm", "statistical", "Z-score", "anomaly", or "variance".
- Use simple phrases like "We noticed your pay dropped" or "The app took more money than usual".
- Always include the real PKR money amounts from the data so they know exactly how much is missing.
- Tone: very friendly, kind, and supportive.
- Maximum 2 very short sentences per explanation. Be direct and clear.
- Provide both an English and a matching Urdu translation in the JSON response.
- Return JSON only.`;

const URDU_TRANSLATION_SYSTEM_PROMPT = `Translate the provided rider-pay explanations into natural, simple Urdu.

Rules:
- Keep money values, numbers, and platform names exactly as-is.
- Do not remove any important detail.
- Use clear conversational Urdu.
- Return JSON only using the requested schema.`;

type AnalyzeRequestPayload = {
  worker_id: string;
  earnings: Array<{
    shift_id: string;
    date: string;
    platform: string;
    hours_worked: number;
    gross_earned: number;
    platform_deduction: number;
    net_received: number;
  }>;
};

type AnalyzeServiceAnomaly = {
  type: string;
  severity: string;
  explanation: string;
  explanation_urdu?: string;
  affected_shifts?: string[];
  data?: Record<string, unknown>;
};

type AnalyzeServiceResponse = {
  anomalies?: AnalyzeServiceAnomaly[];
  analyzed_shifts?: number;
  summary?: string;
  summary_urdu?: string;
  openrouter_response?: unknown;
  openrouterResponse?: unknown;
};

type BatchAnalyzeRequestPayload = {
  workers: AnalyzeRequestPayload[];
};

type EnrichedNarrative = {
  anomalies: AnalyzeServiceAnomaly[];
  summary: string | null;
  summary_urdu: string | null;
  openrouter_response: unknown;
};

const urduLabelPattern = /\n\nاردو:\s*\n?/;

const splitBilingualText = (
  content: string,
): { english: string; urdu: string | null } => {
  const text = content.trim();
  if (!text) {
    return { english: '', urdu: null };
  }

  const match = text.match(urduLabelPattern);
  if (!match || typeof match.index !== 'number') {
    return { english: text, urdu: null };
  }

  const english = text.slice(0, match.index).trim();
  const urdu = text.slice(match.index + match[0].length).trim();
  return { english, urdu: urdu || null };
};

const combineBilingualText = (english: string, urdu?: string | null): string => {
  const cleanEnglish = english.trim();
  const cleanUrdu = (urdu ?? '').trim();
  if (!cleanUrdu) {
    return cleanEnglish;
  }
  return `${cleanEnglish}\n\nاردو:\n${cleanUrdu}`;
};

const fallbackSummaryToUrdu = (summary: string): string | null => {
  const normalized = summary.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const knownTranslations: Record<string, string> = {
    'no shift data provided for analysis.': 'تجزیے کے لیے شفٹ ڈیٹا دستیاب نہیں۔',
    'no anomalies detected in the provided shifts.': 'فراہم کردہ شفٹس میں کوئی غیر معمولی مسئلہ نہیں ملا۔',
  };

  return knownTranslations[normalized] ?? null;
};

const normalizeAnomalyEntry = (input: unknown): AnalyzeServiceAnomaly | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const entry = input as Record<string, unknown>;
  const type = typeof entry.type === 'string' ? entry.type.trim() : '';
  const severity = typeof entry.severity === 'string' ? entry.severity.trim().toLowerCase() : 'low';
  const explanationRaw = typeof entry.explanation === 'string' ? entry.explanation : '';
  const explanationUrduRaw =
    typeof entry.explanation_urdu === 'string' && entry.explanation_urdu.trim()
      ? entry.explanation_urdu.trim()
      : null;

  if (!type) {
    return null;
  }

  const parsed = splitBilingualText(explanationRaw);
  const english = parsed.english || explanationRaw || 'We found a pay issue. Please review this shift.';
  const urdu = explanationUrduRaw ?? parsed.urdu;

  const affectedShifts = Array.isArray(entry.affected_shifts)
    ? entry.affected_shifts.filter((shiftId): shiftId is string => typeof shiftId === 'string')
    : undefined;

  const data = entry.data && typeof entry.data === 'object' ? (entry.data as Record<string, unknown>) : undefined;

  return {
    type,
    severity,
    explanation: combineBilingualText(english, urdu),
    explanation_urdu: urdu ?? undefined,
    affected_shifts: affectedShifts,
    data,
  };
};

const normalizeAnomalies = (items: unknown): AnalyzeServiceAnomaly[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => normalizeAnomalyEntry(item))
    .filter((item): item is AnalyzeServiceAnomaly => item !== null);
};

const ensureUrduTranslations = async (
  anomalies: AnalyzeServiceAnomaly[],
  summaryEnglish: string | null,
  currentSummaryUrdu: string | null,
  apiKey: string,
  model: string,
): Promise<{ anomalies: AnalyzeServiceAnomaly[]; summaryUrdu: string | null }> => {
  const needsSummaryUrdu = Boolean(summaryEnglish && !currentSummaryUrdu?.trim());
  const needsAnomalyUrdu = anomalies.some((anomaly) => {
    const parsed = splitBilingualText(anomaly.explanation);
    return !anomaly.explanation_urdu && !parsed.urdu;
  });

  if (!needsSummaryUrdu && !needsAnomalyUrdu) {
    return {
      anomalies,
      summaryUrdu: currentSummaryUrdu,
    };
  }

  const requestPayload = {
    summary: summaryEnglish,
    anomalies: anomalies.map((anomaly) => {
      const parsed = splitBilingualText(anomaly.explanation);
      return {
        type: anomaly.type,
        english_explanation: parsed.english || anomaly.explanation,
      };
    }),
    output_schema: {
      summary_urdu: 'string|null',
      anomalies: [
        {
          type: 'string',
          urdu_explanation: 'string',
        },
      ],
    },
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: URDU_TRANSLATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify(requestPayload),
          },
        ],
      }),
    });

    if (!response.ok) {
      return { anomalies, summaryUrdu: currentSummaryUrdu };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return { anomalies, summaryUrdu: currentSummaryUrdu };
    }

    const firstChoice = choices[0] as { message?: { content?: unknown } };
    const parsed = parseOpenRouterJsonContent(firstChoice?.message?.content);
    if (!parsed) {
      return { anomalies, summaryUrdu: currentSummaryUrdu };
    }

    const urduByType = new Map<string, string>();
    if (Array.isArray(parsed.anomalies)) {
      for (const item of parsed.anomalies) {
        if (!item || typeof item !== 'object') continue;
        const entry = item as Record<string, unknown>;
        if (
          typeof entry.type === 'string' &&
          typeof entry.urdu_explanation === 'string' &&
          entry.urdu_explanation.trim()
        ) {
          urduByType.set(entry.type, entry.urdu_explanation.trim());
        }
      }
    }

    const translated = anomalies.map((anomaly) => {
      const parsedExplanation = splitBilingualText(anomaly.explanation);
      const english = parsedExplanation.english || anomaly.explanation;
      const urdu = anomaly.explanation_urdu ?? parsedExplanation.urdu ?? urduByType.get(anomaly.type) ?? null;

      return {
        ...anomaly,
        explanation: combineBilingualText(english, urdu),
        explanation_urdu: urdu ?? undefined,
      };
    });

    const summaryUrdu =
      typeof parsed.summary_urdu === 'string' && parsed.summary_urdu.trim()
        ? parsed.summary_urdu.trim()
        : currentSummaryUrdu;

    return {
      anomalies: translated,
      summaryUrdu,
    };
  } catch {
    return { anomalies, summaryUrdu: currentSummaryUrdu };
  }
};

const parseOpenRouterJsonContent = (content: unknown): Record<string, unknown> | null => {
  if (typeof content !== 'string') {
    return null;
  }

  let raw = content.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch (err) {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsedMatch = JSON.parse(match[0]);
        return parsedMatch && typeof parsedMatch === 'object' ? parsedMatch : null;
      }
    } catch (innerErr) {
      console.error('[API] Failed to parse OpenRouter JSON payload:', raw);
    }
    return null;
  }
};

const getOpenRouterKey = (): string | null => {
  let key = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  if (key) return key;

  try {
    const envFiles = ['.env.local', '.env'];
    for (const filename of envFiles) {
      const envPath = path.resolve(process.cwd(), filename);
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/OPEN_?ROUTER_API_KEY=["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          console.log(`[API] Extracted OpenRouter key successfully from ${filename}`);
          return match[1];
        }
      }
    }
  } catch (e) {
    console.error('[API] Error reading env manually:', e);
  }
  return null;
};

const enrichWithOpenRouter = async (
  anomalies: AnalyzeServiceAnomaly[],
  shiftsAnalyzed: number,
): Promise<EnrichedNarrative | null> => {
  const apiKey = getOpenRouterKey();
  if (!apiKey || anomalies.length === 0) {
    console.warn('[API] Missing OPENROUTER_API_KEY or empty anomalies. Skipping local enrichment.');
    return null;
  }

  const model =
    process.env.OPENROUTER_MODEL ?? process.env.OPEN_ROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL;

  const userPrompt = {
    shifts_analyzed: shiftsAnalyzed,
    anomalies,
    output_schema: {
      summary: 'string',
      summary_urdu: 'string',
      anomalies: [
        {
          type: 'string',
          plain_explanation: 'string',
          urdu_explanation: 'string',
        },
      ],
    },
  };

  const tryEnrichment = async (targetModel: string): Promise<EnrichedNarrative | null> => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: ANOMALY_ENRICHMENT_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify(userPrompt),
          },
        ],
      }),
    });

    const providerPayload = (await response.json()) as Record<string, unknown>;
    console.log('[API] OpenRouter local response status:', response.status);
    
    if (!response.ok) {
      console.error('[API] OpenRouter local enrichment failed:', providerPayload);
      return null;
    }

    const choices = providerPayload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return {
        anomalies,
        summary: null,
        summary_urdu: null,
        openrouter_response: providerPayload,
      };
    }

    const firstChoice = choices[0] as { message?: { content?: unknown } };
    const parsed = parseOpenRouterJsonContent(firstChoice?.message?.content);
    if (!parsed) {
      console.error('[API] OpenRouter local enrichment parse failed:', firstChoice?.message?.content);
      return null;
    }

    const parsedAnomalies = parsed.anomalies;
    const explanationMap = new Map<string, { explanation: string; explanation_urdu: string | null }>();
    if (Array.isArray(parsedAnomalies)) {
      for (const item of parsedAnomalies) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const entry = item as Record<string, unknown>;
        if (typeof entry.type === 'string' && typeof entry.plain_explanation === 'string') {
          const urdu =
            typeof entry.urdu_explanation === 'string' && entry.urdu_explanation.trim()
              ? entry.urdu_explanation.trim()
              : null;
          explanationMap.set(entry.type, {
            explanation: combineBilingualText(entry.plain_explanation, urdu),
            explanation_urdu: urdu,
          });
        }
      }
    }

    const enrichedAnomalies = anomalies.map((anomaly) => {
      const replacement = explanationMap.get(anomaly.type);
      if (!replacement) {
        return anomaly;
      }

      const existingUrdu = splitBilingualText(anomaly.explanation).urdu;
      const resolvedUrdu = replacement.explanation_urdu ?? existingUrdu ?? undefined;

      return {
        ...anomaly,
        explanation: replacement.explanation,
        explanation_urdu: resolvedUrdu,
      };
    });

    const summaryEnglish = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const urduSummary =
      typeof parsed.summary_urdu === 'string' && parsed.summary_urdu.trim()
        ? parsed.summary_urdu.trim()
        : null;
    const translated = await ensureUrduTranslations(
      enrichedAnomalies,
      summaryEnglish || null,
      urduSummary,
      apiKey,
      targetModel,
    );

    const finalSummary = summaryEnglish
      ? combineBilingualText(summaryEnglish, translated.summaryUrdu)
      : null;

    return {
      anomalies: translated.anomalies,
      summary: finalSummary,
      summary_urdu: translated.summaryUrdu,
      openrouter_response: providerPayload,
    };
  };

  try {
    const primary = await tryEnrichment(model);
    if (primary) {
      return primary;
    }

    if (model !== OPENROUTER_DEFAULT_MODEL) {
      console.warn('[API] Retrying enrichment with fallback model');
      return await tryEnrichment(OPENROUTER_DEFAULT_MODEL);
    }

    return null;
  } catch (error) {
    console.error('[API] OpenRouter local request exception:', error);
    return null;
  }
};

export const analyzeWorkerAnomalyHandler = async (c: Context) => {
  const { workerId } = await c.req.json<{ workerId: string }>();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const shifts = await db.shiftLog.findMany({
    where: {
      workerId,
      shiftDate: {
        gte: ninetyDaysAgo,
      },
    },
    include: {
      platform: true,
    },
    orderBy: {
      shiftDate: 'asc',
    },
  });

  const payload: AnalyzeRequestPayload = {
    worker_id: workerId,
    earnings: shifts.map((shift) => ({
      shift_id: shift.id,
      date: shift.shiftDate.toISOString().split('T')[0],
      platform: shift.platform.name,
      hours_worked: Number(shift.hoursWorked),
      gross_earned: Number(shift.grossEarned),
      platform_deduction: Number(shift.platformDeductions),
      net_received: Number(shift.netReceived),
    })),
  };

  const serviceUrl =
    process.env.ANOMALY_SERVICE_URL ?? 'http://localhost:8001/analyze';
  const normalizeServiceBase = (url: string) =>
    url
      .replace(/\/analyze\/?$/, '')
      .replace(/\/detect\/?$/, '')
      .replace(/\/$/, '');

  const analyzeEndpoint = `${normalizeServiceBase(serviceUrl)}/analyze?enrich=false`;

  try {
    const response = await fetch(analyzeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return c.json({ anomalies: [], error: 'anomaly_service_unavailable' });
    }

    const data = (await response.json()) as AnalyzeServiceResponse;

    const serviceOpenrouterResponse =
      data.openrouter_response ?? data.openrouterResponse ?? null;

    let anomaliesArray = normalizeAnomalies(data.anomalies);
    let summary = typeof data.summary === 'string' ? data.summary : null;
    let summaryUrdu = typeof data.summary_urdu === 'string' ? data.summary_urdu : null;
    let openrouterResponse: unknown = serviceOpenrouterResponse;

    try {
      const cachedFlags = await db.anomalyFlag.findMany({
        where: { workerId },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      });
      const translationCache = new Map<string, string>();
      for (const flag of cachedFlags) {
        if (!translationCache.has(flag.flagType) && flag.explanation.includes('اردو:')) {
          translationCache.set(flag.flagType, flag.explanation);
        }
      }

      let needsEnrichment = false;
      for (const anomaly of anomaliesArray) {
        const cachedExplanation = translationCache.get(anomaly.type);
        if (cachedExplanation) {
          anomaly.explanation = cachedExplanation;
        } else {
          needsEnrichment = true;
        }
      }

      if (needsEnrichment && !serviceOpenrouterResponse && anomaliesArray.length > 0) {
        console.log('[API] Falling back to local OpenRouter enrichment...');
        const fallback = await enrichWithOpenRouter(
          anomaliesArray,
          data.analyzed_shifts ?? shifts.length,
        );
        if (fallback) {
          console.log('[API] Local enrichment successful');
          anomaliesArray = fallback.anomalies;
          if (fallback.summary) {
            summary = fallback.summary;
          }
          summaryUrdu = fallback.summary_urdu;
          openrouterResponse = fallback.openrouter_response;
        } else {
          console.warn('[API] Local enrichment returned null. Using original strings or DB cache.');
        }
      }
    } catch (e) {
      console.error('[API] Error during anomaly DB fetch or enrichment fallback', e);
    }

    anomaliesArray = anomaliesArray.map((anomaly) => {
      const existing = splitBilingualText(anomaly.explanation);
      if (anomaly.explanation_urdu) {
        return {
          ...anomaly,
          explanation: combineBilingualText(existing.english || anomaly.explanation, anomaly.explanation_urdu),
          explanation_urdu: anomaly.explanation_urdu,
        };
      }

      return {
        ...anomaly,
        explanation: combineBilingualText(existing.english, existing.urdu),
        explanation_urdu: existing.urdu ?? undefined,
      };
    });

    if (summary) {
      const parsedSummary = splitBilingualText(summary);
      const preferredUrdu =
        summaryUrdu?.trim() ||
        parsedSummary.urdu ||
        fallbackSummaryToUrdu(parsedSummary.english || summary);
      summary = combineBilingualText(parsedSummary.english || summary, preferredUrdu);
      summaryUrdu = preferredUrdu;
    } else if (summaryUrdu) {
      summary = combineBilingualText('No anomalies detected in the provided shifts.', summaryUrdu);
    }

    if (anomaliesArray.length > 0) {
      const representativeShiftId = shifts[0]?.id;

      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const existingToday = await db.anomalyFlag.findMany({
          where: {
            workerId: workerId,
            detectedAt: { gte: todayStart, lte: todayEnd },
          },
          select: { flagType: true },
        });
        const existingTypes = new Set(
          existingToday.map((f: { flagType: string }) => f.flagType),
        );

        const newAnomalies = anomaliesArray.filter(
          (a: { type: string }) => !existingTypes.has(a.type),
        );

        const anomalyRows = newAnomalies.flatMap((anomaly) => {
          const affectedShiftIds = Array.isArray(anomaly.affected_shifts)
            ? anomaly.affected_shifts.filter((shiftId): shiftId is string =>
                typeof shiftId === 'string',
              )
            : [];

          const shiftLogId = affectedShiftIds[0] ?? representativeShiftId;

          if (!shiftLogId) {
            return [];
          }

          const zScore =
            typeof anomaly.data?.recent_mean_modified_z === 'number'
              ? anomaly.data.recent_mean_modified_z
              : null;

          return [
            {
              workerId,
              shiftLogId,
              flagType: anomaly.type,
              severity: anomaly.severity,
              explanation: anomaly.explanation,
              zScore,
            },
          ];
        });

        if (anomalyRows.length > 0) {
          await db.anomalyFlag.createMany({
            data: anomalyRows,
          });
        }
      } catch (error) {
        console.error('Failed to persist anomaly flags', error);
      }
    }

    return c.json({
      ...data,
      anomalies: anomaliesArray,
      summary,
      summary_urdu: summaryUrdu,
      openrouter_response: openrouterResponse,
      analyzed_shifts: data.analyzed_shifts ?? shifts.length,
    });
  } catch {
    return c.json({ anomalies: [], error: 'anomaly_service_unavailable' });
  }
};

export const detectWorkerAnomalyHandler = async (c: Context) => {
  const { workerId } = await c.req.json<{ workerId: string }>();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const shifts = await db.shiftLog.findMany({
    where: {
      workerId,
      shiftDate: {
        gte: ninetyDaysAgo,
      },
    },
    include: {
      platform: true,
    },
    orderBy: {
      shiftDate: 'asc',
    },
  });

  const payload: AnalyzeRequestPayload = {
    worker_id: workerId,
    earnings: shifts.map((shift) => ({
      shift_id: shift.id,
      date: shift.shiftDate.toISOString().split('T')[0],
      platform: shift.platform.name,
      hours_worked: Number(shift.hoursWorked),
      gross_earned: Number(shift.grossEarned),
      platform_deduction: Number(shift.platformDeductions),
      net_received: Number(shift.netReceived),
    })),
  };

  const serviceUrl =
    process.env.ANOMALY_SERVICE_URL ?? 'http://localhost:8001/analyze';
  const detectEndpoint = serviceUrl
    .replace(/\/analyze\/?$/, '')
    .replace(/\/detect\/?$/, '')
    .replace(/\/$/, '')
    .concat('/detect');

  try {
    const response = await fetch(detectEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return c.json({ flags: [], anomalies: [], error: 'anomaly_service_unavailable' });
    }

    const data = (await response.json()) as {
      flags?: AnalyzeServiceAnomaly[];
      worker_id?: string;
      analyzed_shifts?: number;
    };

    // Keep anomalies alias for backwards compatibility on worker UI.
    return c.json({
      workerId: data.worker_id ?? workerId,
      analyzedShifts: data.analyzed_shifts ?? shifts.length,
      flags: data.flags ?? [],
      anomalies: data.flags ?? [],
    });
  } catch {
    return c.json({ flags: [], anomalies: [], error: 'anomaly_service_unavailable' });
  }
};

export const analyzeBatchHandler = async (c: Context) => {
  try {
    const body = await c.req.json<{ workerIds?: string[] }>();
    const workerIds = Array.isArray(body.workerIds) ? body.workerIds : [];

    if (workerIds.length > 50) {
      return c.json({ error: 'Max 50 workers' }, 400);
    }

    const workers = await Promise.all(
      workerIds.map(async (workerId) => {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const shifts = await db.shiftLog.findMany({
          where: {
            workerId,
            shiftDate: {
              gte: ninetyDaysAgo,
            },
          },
          include: {
            platform: true,
          },
          orderBy: {
            shiftDate: 'asc',
          },
        });

        return {
          worker_id: workerId,
          earnings: shifts.map((shift) => ({
            shift_id: shift.id,
            date: shift.shiftDate.toISOString().split('T')[0],
            platform: shift.platform.name,
            hours_worked: Number(shift.hoursWorked),
            gross_earned: Number(shift.grossEarned),
            platform_deduction: Number(shift.platformDeductions),
            net_received: Number(shift.netReceived),
          })),
        };
      }),
    );

    const payload: BatchAnalyzeRequestPayload = {
      workers,
    };

    const serviceUrl =
      process.env.ANOMALY_SERVICE_URL ?? 'http://localhost:8001/analyze';
    const baseUrl = serviceUrl
      .replace(/\/analyze\/?$/, '')
      .replace(/\/$/, '');
    const analyzeBatchEndpoint = `${baseUrl}/analyze/batch?enrich=false`;

    const response = await fetch(analyzeBatchEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return c.json({ error: 'anomaly_service_unavailable', results: [] });
    }

    const data = await response.json();
    return c.json(data);
  } catch {
    return c.json({ error: 'anomaly_service_unavailable', results: [] });
  }
};

export const getCityMedianHandler = async (c: Context) => {
  const cityZone = c.req.query('cityZone');
  const categoryParam = c.req.query('category');

  const categoryValues = Object.values(WorkerCategory) as string[];
  const category =
    categoryParam && categoryValues.includes(categoryParam)
      ? (categoryParam as WorkerCategory)
      : undefined;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const stats = await db.dailyPlatformStat.findMany({
    where: {
      ...(cityZone ? { cityZone } : {}),
      ...(category ? { category } : {}),
      statDate: {
        gte: ninetyDaysAgo,
      },
    },
    select: {
      medianNetEarned: true,
      avgCommissionPct: true,
      workerCount: true,
    },
  });

  if (stats.length === 0) {
    return c.json({
      median_hourly: null,
      median_income: null,
      avg_commission_rate: null,
      sample_size: 0,
      message: 'Insufficient data for this zone',
    });
  }

  const sampleSize = stats.reduce((sum, row) => sum + row.workerCount, 0);
  const weightedIncomeNumerator = stats.reduce(
    (sum, row) => sum + Number(row.medianNetEarned) * row.workerCount,
    0,
  );
  const weightedIncomeAverage =
    sampleSize > 0 ? weightedIncomeNumerator / sampleSize : null;
  const commissionAverage =
    stats.reduce((sum, row) => sum + Number(row.avgCommissionPct), 0) /
    stats.length;

  return c.json({
    median_hourly: weightedIncomeAverage,
    median_income: weightedIncomeAverage,
    avg_commission_rate: commissionAverage,
    sample_size: sampleSize,
    city_zone: cityZone || 'all',
    category: category || 'all',
  });
};
