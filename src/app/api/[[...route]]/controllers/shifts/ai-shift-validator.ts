import * as z from 'zod';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OCR_MODEL = 'google/gemma-4-26b-a4b-it:free';

const OCR_FALLBACK_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.2-11b-vision-instruct',
] as const;

const SHIFT_FIELDS = [
  'hoursWorked',
  'grossEarned',
  'platformDeductions',
  'netReceived',
] as const;

const SHIFT_VERDICT_VALUES = ['CONFIRMED', 'FLAGGED', 'UNVERIFIABLE'] as const;
const SHIFT_CURRENCY_VALUES = ['PKR', 'USD', 'UNKNOWN'] as const;

type ShiftField = (typeof SHIFT_FIELDS)[number];
type ShiftCurrency = (typeof SHIFT_CURRENCY_VALUES)[number];

type ClaimedShiftValues = Record<ShiftField, number>;

const FIELD_ALIASES: Record<ShiftField, string[]> = {
  hoursWorked: ['hoursWorked', 'hours_worked', 'hours', 'duration'],
  grossEarned: ['grossEarned', 'gross_earned', 'gross', 'totalEarned'],
  platformDeductions: [
    'platformDeductions',
    'platform_deductions',
    'deductions',
    'platformCut',
    'commission',
  ],
  netReceived: ['netReceived', 'net_received', 'net', 'takeHome', 'payout'],
};

const FIELD_TOLERANCE: Record<ShiftField, number> = {
  hoursWorked: 0.15,
  grossEarned: 0.08,
  platformDeductions: 0.08,
  netReceived: 0.08,
};

const MIN_EXTRACTED_FIELDS_FOR_CONFIRMED = 2;

const shiftFieldSchema = z.enum(SHIFT_FIELDS);
const shiftVerdictSchema = z.enum(SHIFT_VERDICT_VALUES);
const shiftCurrencySchema = z.enum(SHIFT_CURRENCY_VALUES);

const extractionResponseSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    summary: z.string().min(1),
    reasons: z.array(z.string().min(1)).max(12),
    ocrText: z.array(z.string().min(1)).max(20),
    evidence: z.object({
      hoursWorked: z.string().nullable(),
      grossEarned: z.string().nullable(),
      platformDeductions: z.string().nullable(),
      netReceived: z.string().nullable(),
    }),
    currencies: z
      .object({
        hoursWorked: shiftCurrencySchema,
        grossEarned: shiftCurrencySchema,
        platformDeductions: shiftCurrencySchema,
        netReceived: shiftCurrencySchema,
      })
      .optional(),
    detectedCurrency: shiftCurrencySchema.optional(),
    extracted: z.object({
      hoursWorked: z.number().nullable(),
      grossEarned: z.number().nullable(),
      platformDeductions: z.number().nullable(),
      netReceived: z.number().nullable(),
    }),
  })
  .strict();

const comparisonResponseSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    trustScore: z.number().min(0).max(1),
    recommendedVerdict: shiftVerdictSchema,
    summary: z.string().min(1),
    reasons: z.array(z.string().min(1)).max(12),
    comparisons: z
      .array(
        z
          .object({
            field: shiftFieldSchema,
            claimed: z.number(),
            extracted: z.number().nullable(),
            deltaPct: z.number().nullable(),
            withinTolerance: z.boolean(),
            reason: z.string().min(1),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();

const SHIFT_OCR_EXTRACT_SYSTEM_PROMPT = [
  'You are an OCR extraction agent for worker shift screenshots.',
  'Extract visible text and numeric earnings values from images only.',
  'Do not compare against claimed values in this step.',
  'Image currency is the source of truth for extracted earnings values.',
  'If currency is not visible in image evidence, set currency as UNKNOWN.',
  'Identify currency for each extracted numeric field using PKR, USD, or UNKNOWN.',
  'Return only valid JSON with this exact schema:',
  '{',
  '  "confidence": number,                      // 0..1',
  '  "summary": string,',
  '  "reasons": string[],',
  '  "ocrText": string[],',
  '  "evidence": {',
  '    "hoursWorked": string|null,',
  '    "grossEarned": string|null,',
  '    "platformDeductions": string|null,',
  '    "netReceived": string|null',
  '  },',
  '  "currencies": {',
  '    "hoursWorked": "PKR"|"USD"|"UNKNOWN",',
  '    "grossEarned": "PKR"|"USD"|"UNKNOWN",',
  '    "platformDeductions": "PKR"|"USD"|"UNKNOWN",',
  '    "netReceived": "PKR"|"USD"|"UNKNOWN"',
  '  },',
  '  "detectedCurrency": "PKR"|"USD"|"UNKNOWN",',
  '  "extracted": {',
  '    "hoursWorked": number|null,',
  '    "grossEarned": number|null,',
  '    "platformDeductions": number|null,',
  '    "netReceived": number|null',
  '  }',
  '}',
].join('\n');

const SHIFT_OCR_COMPARE_SYSTEM_PROMPT = [
  'You are a strict reconciliation agent for worker shift validations.',
  'Claimed values are always in PKR.',
  'User-submitted amounts are always PKR and must never be treated as USD.',
  'Image/OCR currency controls whether conversion is needed.',
  'Compare claimed shift values against OCR values after currency normalization to PKR.',
  'For Fiverr receipts, OCR amounts may be in USD and must be converted to PKR using provided usd_to_pkr_rate.',
  'If image currency is UNKNOWN for a money field, comparison for that field must be treated as UNVERIFIABLE, not FLAGGED.',
  'Set recommendedVerdict to FLAGGED only when at least one field is out of tolerance.',
  'If OCR evidence is insufficient, use recommendedVerdict UNVERIFIABLE.',
  'Return only valid JSON with this exact schema:',
  '{',
  '  "confidence": number,                      // 0..1',
  '  "trustScore": number,                      // 0..1',
  '  "recommendedVerdict": "CONFIRMED"|"FLAGGED"|"UNVERIFIABLE",',
  '  "summary": string,',
  '  "reasons": string[],',
  '  "comparisons": [',
  '    {',
  '      "field": "hoursWorked"|"grossEarned"|"platformDeductions"|"netReceived",',
  '      "claimed": number,',
  '      "extracted": number|null,',
  '      "deltaPct": number|null,',
  '      "withinTolerance": boolean,',
  '      "reason": string',
  '    }',
  '  ]',
  '}',
].join('\n');

export type ShiftValidationDiscrepancy = {
  field: ShiftField;
  claimed: number;
  extracted: number;
  deltaPct: number;
  withinTolerance: boolean;
};

export type ShiftOcrValidationResult = {
  model: string;
  confidence: number;
  trustScore: number;
  verdict: 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';
  summary: string;
  reasons: string[];
  discrepancies: ShiftValidationDiscrepancy[];
  extracted: Partial<ClaimedShiftValues>;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

export type ShiftOcrValidationInput = {
  shiftId: string;
  platformName: string;
  shiftDate: string;
  claimed: ClaimedShiftValues;
  screenshotUrls: string[];
  notes?: string | null;
};

type ValidationUsage = ShiftOcrValidationResult['usage'];

type OpenRouterStepResponse = {
  parsed: Record<string, unknown>;
  usage: ValidationUsage;
};

type CurrencyNormalizationMeta = {
  sourceCurrency: ShiftCurrency;
  currencyDetectedFromImage: boolean;
  rawValue: number;
  normalizedValue: number;
  conversionRate: number | null;
};

type CurrencyNormalizationResult = {
  normalized: Partial<ClaimedShiftValues>;
  currencies: Partial<Record<ShiftField, ShiftCurrency>>;
  conversionNotes: string[];
  normalizationMeta: Partial<Record<ShiftField, CurrencyNormalizationMeta>>;
  unresolvedCurrencyFields: ShiftField[];
  hasUnresolvedMoneyCurrency: boolean;
  usdToPkrRate: number;
};

type ExtractionStepResult = {
  confidence: number;
  summary: string;
  reasons: string[];
  ocrText: string[];
  evidence: Partial<Record<ShiftField, string>>;
  extracted: Partial<ClaimedShiftValues>;
  currencies: Partial<Record<ShiftField, ShiftCurrency>>;
  detectedCurrency: ShiftCurrency;
  usage: ValidationUsage;
};

type ComparisonStepResult = {
  confidence: number;
  trustScore: number;
  recommendedVerdict: 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';
  summary: string;
  reasons: string[];
  comparisons: Array<{
    field: ShiftField;
    claimed: number;
    extracted: number | null;
    deltaPct: number | null;
    withinTolerance: boolean;
    reason: string;
  }>;
  usage: ValidationUsage;
};

function sumNullable(a: number | null, b: number | null): number | null {
  if (a === null && b === null) {
    return null;
  }

  return (a ?? 0) + (b ?? 0);
}

function mergeUsage(
  first: ValidationUsage,
  second?: ValidationUsage,
): ValidationUsage {
  if (!second) {
    return first;
  }

  return {
    promptTokens: sumNullable(first.promptTokens, second.promptTokens),
    completionTokens: sumNullable(first.completionTokens, second.completionTokens),
    totalTokens: sumNullable(first.totalTokens, second.totalTokens),
  };
}

function normalizeEvidenceText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();
  return text ? text.slice(0, 180) : null;
}

function dedupeReasons(reasons: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const reason of reasons) {
    const next = reason.trim();
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    deduped.push(next);

    if (deduped.length >= 12) {
      break;
    }
  }

  return deduped;
}

const USD_TO_PKR_FALLBACK_RATE = 278;
let usdToPkrRateCache: { value: number; expiresAt: number } | null = null;

function isMoneyField(field: ShiftField): boolean {
  return field !== 'hoursWorked';
}

function isFiverrLikePlatform(platformName: string): boolean {
  return /fiverr/i.test(platformName);
}

function normalizeCurrency(value: unknown): ShiftCurrency {
  if (typeof value !== 'string') {
    return 'UNKNOWN';
  }

  const upper = value.trim().toUpperCase();
  if (upper === 'USD' || upper === 'PKR') {
    return upper;
  }

  return 'UNKNOWN';
}

function inferCurrencyFromText(value: string | null | undefined): ShiftCurrency {
  if (!value) {
    return 'UNKNOWN';
  }

  const text = value.toLowerCase();

  if (/\b(usd|us\$|\$)\b/.test(text)) {
    return 'USD';
  }

  if (/\b(pkr|rs\.?|rupees?)\b|₨/.test(text)) {
    return 'PKR';
  }

  return 'UNKNOWN';
}

async function fetchUsdToPkrRateFromSource(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;

    const directRates =
      payload.rates && typeof payload.rates === 'object'
        ? (payload.rates as Record<string, unknown>)
        : null;

    const directPkr = parseOptionalNumber(directRates?.PKR);
    if (directPkr && directPkr > 100 && directPkr < 1000) {
      return directPkr;
    }

    const usdBlock =
      payload.usd && typeof payload.usd === 'object'
        ? (payload.usd as Record<string, unknown>)
        : null;

    const nestedPkr = parseOptionalNumber(usdBlock?.pkr ?? usdBlock?.PKR);
    if (nestedPkr && nestedPkr > 100 && nestedPkr < 1000) {
      return nestedPkr;
    }

    return null;
  } catch {
    return null;
  }
}

async function getUsdToPkrRate(): Promise<number> {
  const cached = usdToPkrRateCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const envRate = parseOptionalNumber(process.env.USD_TO_PKR_RATE);
  if (envRate && envRate > 100 && envRate < 1000) {
    usdToPkrRateCache = {
      value: envRate,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    };
    return envRate;
  }

  const sources = [
    'https://open.er-api.com/v6/latest/USD',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
  ];

  for (const source of sources) {
    const value = await fetchUsdToPkrRateFromSource(source);
    if (!value) {
      continue;
    }

    usdToPkrRateCache = {
      value,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    };

    return value;
  }

  usdToPkrRateCache = {
    value: USD_TO_PKR_FALLBACK_RATE,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };

  return USD_TO_PKR_FALLBACK_RATE;
}

function normalizeExtractedValuesToPkr(params: {
  extracted: Partial<ClaimedShiftValues>;
  currencies: Partial<Record<ShiftField, ShiftCurrency>>;
  platformName: string;
  usdToPkrRate: number;
}): CurrencyNormalizationResult {
  const normalized: Partial<ClaimedShiftValues> = {};
  const normalizedCurrencies: Partial<Record<ShiftField, ShiftCurrency>> = {};
  const conversionNotes: string[] = [];
  const normalizationMeta: Partial<Record<ShiftField, CurrencyNormalizationMeta>> = {};
  const unresolvedCurrencyFields: ShiftField[] = [];

  for (const field of SHIFT_FIELDS) {
    const rawValue = params.extracted[field];
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      continue;
    }

    if (!isMoneyField(field)) {
      normalized[field] = rawValue;
      normalizedCurrencies[field] = 'UNKNOWN';
      normalizationMeta[field] = {
        sourceCurrency: 'UNKNOWN',
        currencyDetectedFromImage: false,
        rawValue,
        normalizedValue: rawValue,
        conversionRate: null,
      };
      continue;
    }

    const reportedCurrency = params.currencies[field] ?? 'UNKNOWN';

    if (reportedCurrency === 'UNKNOWN') {
      unresolvedCurrencyFields.push(field);
      normalizedCurrencies[field] = 'UNKNOWN';
      normalizationMeta[field] = {
        sourceCurrency: 'UNKNOWN',
        currencyDetectedFromImage: false,
        rawValue,
        normalizedValue: rawValue,
        conversionRate: null,
      };

      conversionNotes.push(
        `${labelForField(field)} currency is not visible in image evidence; skipped strict money comparison for this field.`,
      );

      continue;
    }

    const sourceCurrency = reportedCurrency;

    const normalizedValue =
      sourceCurrency === 'USD'
        ? roundTwo(rawValue * params.usdToPkrRate)
        : roundTwo(rawValue);

    normalized[field] = normalizedValue;
    normalizedCurrencies[field] = sourceCurrency;
    normalizationMeta[field] = {
      sourceCurrency,
      currencyDetectedFromImage: true,
      rawValue,
      normalizedValue,
      conversionRate: sourceCurrency === 'USD' ? params.usdToPkrRate : null,
    };

    if (sourceCurrency === 'USD') {
      conversionNotes.push(
        `${labelForField(field)} converted from USD ${roundTwo(rawValue)} to PKR ${normalizedValue.toLocaleString('en-PK')} using rate ${roundTwo(params.usdToPkrRate)}.`,
      );
    }
  }

  if (unresolvedCurrencyFields.length > 0 && isFiverrLikePlatform(params.platformName)) {
    conversionNotes.push(
      'Fiverr receipts often use USD. Ensure screenshot clearly shows $ or USD for strict conversion to PKR.',
    );
  }

  return {
    normalized,
    currencies: normalizedCurrencies,
    conversionNotes: dedupeReasons(conversionNotes),
    normalizationMeta,
    unresolvedCurrencyFields,
    hasUnresolvedMoneyCurrency: unresolvedCurrencyFields.length > 0,
    usdToPkrRate: params.usdToPkrRate,
  };
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .replace(/pkr|rs\.?/gi, '')
      .replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeStringArray(value: unknown, maxItems = 6): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function getApiKey(): string | null {
  const raw = process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTER_API_KEY;
  const key = raw?.trim();
  return key ? key : null;
}

function extractMessageContent(content: unknown): string | null {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const textParts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') {
      continue;
    }

    const maybeText = (part as { text?: unknown }).text;
    if (typeof maybeText === 'string' && maybeText.trim()) {
      textParts.push(maybeText);
    }
  }

  return textParts.length ? textParts.join('\n') : null;
}

function parseJsonPayload(content: unknown): Record<string, unknown> | null {
  const rawText = extractMessageContent(content);
  if (!rawText) {
    return null;
  }

  let raw = rawText.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return null;
      }

      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

function readUsage(payload: Record<string, unknown>) {
  const usage = payload.usage && typeof payload.usage === 'object'
    ? (payload.usage as Record<string, unknown>)
    : null;

  return {
    promptTokens: parseOptionalNumber(usage?.prompt_tokens),
    completionTokens: parseOptionalNumber(usage?.completion_tokens),
    totalTokens: parseOptionalNumber(usage?.total_tokens),
  };
}

function pickExtractedField(
  source: Record<string, unknown>,
  field: ShiftField,
): number | null {
  for (const key of FIELD_ALIASES[field]) {
    const next = parseOptionalNumber(source[key]);
    if (next !== null) {
      return next;
    }
  }

  return null;
}

function buildDiscrepancies(
  claimed: ClaimedShiftValues,
  extracted: Partial<ClaimedShiftValues>,
): ShiftValidationDiscrepancy[] {
  const output: ShiftValidationDiscrepancy[] = [];

  for (const field of SHIFT_FIELDS) {
    const extractedValue = extracted[field];
    if (typeof extractedValue !== 'number' || !Number.isFinite(extractedValue)) {
      continue;
    }

    const claimedValue = claimed[field];
    const denominator = Math.max(Math.abs(claimedValue), 1);
    const deltaPct = Math.abs(extractedValue - claimedValue) / denominator;
    const tolerance = FIELD_TOLERANCE[field];

    output.push({
      field,
      claimed: claimedValue,
      extracted: extractedValue,
      deltaPct,
      withinTolerance: deltaPct <= tolerance,
    });
  }

  return output;
}

function labelForField(field: ShiftField): string {
  switch (field) {
    case 'hoursWorked':
      return 'Hours worked';
    case 'grossEarned':
      return 'Gross earned';
    case 'platformDeductions':
      return 'Platform deductions';
    case 'netReceived':
      return 'Net received';
    default:
      return field;
  }
}

function formatFieldValue(field: ShiftField, value: number): string {
  if (field === 'hoursWorked') {
    return `${roundTwo(value)} hrs`;
  }

  return `PKR ${roundTwo(value).toLocaleString('en-PK')}`;
}

function buildDetailedMismatchReasons(
  discrepancies: ShiftValidationDiscrepancy[],
  evidence: Partial<Record<ShiftField, string>>,
  normalizationMeta?: Partial<Record<ShiftField, CurrencyNormalizationMeta>>,
): string[] {
  return discrepancies
    .filter((item) => !item.withinTolerance)
    .map((item) => {
      const evidenceText = evidence[item.field];
      const tolerancePct = Math.round(FIELD_TOLERANCE[item.field] * 100);
      const conversionMeta = normalizationMeta?.[item.field];
      const currencyContext =
        conversionMeta?.sourceCurrency === 'USD'
          ? ` Converted from USD ${roundTwo(conversionMeta.rawValue)} to PKR ${roundTwo(conversionMeta.normalizedValue).toLocaleString('en-PK')} using rate ${roundTwo(conversionMeta.conversionRate ?? 0)}.`
          : conversionMeta && !conversionMeta.currencyDetectedFromImage
            ? ' Currency could not be confirmed from image evidence.'
            : '';

      const base = `${labelForField(item.field)} mismatch: claimed ${formatFieldValue(item.field, item.claimed)} vs OCR ${formatFieldValue(item.field, item.extracted)} (${Math.round(item.deltaPct * 100)}% delta, tolerance ${tolerancePct}%).`;

      const withEvidence = evidenceText ? `${base}${currencyContext} Evidence: "${evidenceText}".` : `${base}${currencyContext}`;

      return withEvidence.trim();
    });
}

function sanitizeExtractedValue(field: ShiftField, value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (field === 'hoursWorked') {
    if (value <= 0 || value > 24) {
      return null;
    }

    return roundTwo(value);
  }

  if (value < 0 || value > 1_000_000) {
    return null;
  }

  return roundTwo(value);
}

function deriveMissingExtractedValues(
  extracted: Partial<ClaimedShiftValues>,
): Partial<ClaimedShiftValues> {
  const next = { ...extracted };

  if (
    typeof next.grossEarned === 'number' &&
    typeof next.platformDeductions === 'number' &&
    typeof next.netReceived !== 'number'
  ) {
    next.netReceived = roundTwo(next.grossEarned - next.platformDeductions);
  }

  if (
    typeof next.grossEarned === 'number' &&
    typeof next.netReceived === 'number' &&
    typeof next.platformDeductions !== 'number'
  ) {
    next.platformDeductions = roundTwo(next.grossEarned - next.netReceived);
  }

  if (
    typeof next.platformDeductions === 'number' &&
    typeof next.netReceived === 'number' &&
    typeof next.grossEarned !== 'number'
  ) {
    next.grossEarned = roundTwo(next.netReceived + next.platformDeductions);
  }

  return next;
}

function normalizeVerdict(value: unknown): 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE' | null {
  if (value === 'CONFIRMED' || value === 'FLAGGED' || value === 'UNVERIFIABLE') {
    return value;
  }

  return null;
}

function chooseVerdict(params: {
  parsedVerdict: 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE' | null;
  confidence: number;
  extractedFields: number;
  mismatchCount: number;
  hasUnresolvedMoneyCurrency: boolean;
}): 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE' {
  // FLAGGED must be evidence-based from extracted numeric mismatch.
  if (params.mismatchCount > 0) {
    return 'FLAGGED';
  }

  if (params.hasUnresolvedMoneyCurrency) {
    return 'UNVERIFIABLE';
  }

  if (
    params.extractedFields < MIN_EXTRACTED_FIELDS_FOR_CONFIRMED ||
    params.confidence < 0.3
  ) {
    return 'UNVERIFIABLE';
  }

  if (params.parsedVerdict === 'UNVERIFIABLE' && params.confidence < 0.45) {
    return 'UNVERIFIABLE';
  }

  return 'CONFIRMED';
}

function buildFallbackResult(
  model: string,
  summary: string,
  reasons?: string[],
): ShiftOcrValidationResult {
  return {
    model,
    confidence: 0,
    trustScore: 0.05,
    verdict: 'UNVERIFIABLE',
    summary,
    reasons: reasons?.length
      ? reasons
      : ['Automated OCR validation could not complete.'],
    discrepancies: [],
    extracted: {},
    usage: {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    },
  };
}

async function runModel(
  model: string,
  apiKey: string,
  input: ShiftOcrValidationInput,
): Promise<ShiftOcrValidationResult | null> {
  async function requestOpenRouterStep(messages: Array<{ role: 'system' | 'user'; content: unknown }>): Promise<OpenRouterStepResponse | null> {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages,
      }),
    });

    const responseText = await response.text();

    let payload: Record<string, unknown> = {};
    if (responseText.trim()) {
      try {
        const parsed = JSON.parse(responseText) as unknown;
        if (parsed && typeof parsed === 'object') {
          payload = parsed as Record<string, unknown>;
        }
      } catch {
        if (!response.ok) {
          throw new Error(
            `OpenRouter request failed (${response.status}) for model ${model}: ${responseText.slice(0, 180)}`,
          );
        }

        return null;
      }
    }

    if (!response.ok) {
      const message =
        payload.error && typeof payload.error === 'object'
          ? (payload.error as { message?: unknown }).message
          : undefined;

      throw new Error(
        typeof message === 'string' && message.trim()
          ? message.trim()
          : `OpenRouter request failed (${response.status}) for model ${model}`,
      );
    }

    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return null;
    }

    const firstChoice = choices[0] as { message?: { content?: unknown } };
    const parsed = parseJsonPayload(firstChoice?.message?.content);
    if (!parsed) {
      return null;
    }

    return {
      parsed,
      usage: readUsage(payload),
    };
  }

  function parseExtractionStep(parsed: Record<string, unknown>): Omit<ExtractionStepResult, 'usage'> | null {
    const extractedRaw =
      parsed.extracted && typeof parsed.extracted === 'object'
        ? (parsed.extracted as Record<string, unknown>)
        : parsed;

    const evidenceRaw =
      parsed.evidence && typeof parsed.evidence === 'object'
        ? (parsed.evidence as Record<string, unknown>)
        : {};

    const currenciesRaw =
      parsed.currencies && typeof parsed.currencies === 'object'
        ? (parsed.currencies as Record<string, unknown>)
        : {};

    const extractedCandidate = {
      hoursWorked: pickExtractedField(extractedRaw, 'hoursWorked'),
      grossEarned: pickExtractedField(extractedRaw, 'grossEarned'),
      platformDeductions: pickExtractedField(extractedRaw, 'platformDeductions'),
      netReceived: pickExtractedField(extractedRaw, 'netReceived'),
    };

    const evidenceCandidate = {
      hoursWorked: normalizeEvidenceText(evidenceRaw.hoursWorked),
      grossEarned: normalizeEvidenceText(evidenceRaw.grossEarned),
      platformDeductions: normalizeEvidenceText(evidenceRaw.platformDeductions),
      netReceived: normalizeEvidenceText(evidenceRaw.netReceived),
    };

    const extractionCandidate = {
      confidence: clamp(parseOptionalNumber(parsed.confidence) ?? 0.55, 0, 1),
      summary: normalizeText(parsed.summary, 'OCR extraction completed for uploaded screenshots.'),
      reasons: normalizeStringArray(parsed.reasons, 12),
      ocrText: normalizeStringArray(parsed.ocrText, 20),
      evidence: evidenceCandidate,
      currencies: {
        hoursWorked: normalizeCurrency(currenciesRaw.hoursWorked),
        grossEarned: normalizeCurrency(currenciesRaw.grossEarned),
        platformDeductions: normalizeCurrency(currenciesRaw.platformDeductions),
        netReceived: normalizeCurrency(currenciesRaw.netReceived),
      },
      detectedCurrency: normalizeCurrency(parsed.detectedCurrency),
      extracted: extractedCandidate,
    };

    const validated = extractionResponseSchema.safeParse(extractionCandidate);
    if (!validated.success) {
      return null;
    }

    const extracted: Partial<ClaimedShiftValues> = {};
    for (const field of SHIFT_FIELDS) {
      const rawValue = validated.data.extracted[field];
      if (typeof rawValue !== 'number') {
        continue;
      }

      const sanitized = sanitizeExtractedValue(field, rawValue);
      if (sanitized !== null) {
        extracted[field] = sanitized;
      }
    }

    const evidence: Partial<Record<ShiftField, string>> = {};
    for (const field of SHIFT_FIELDS) {
      const evidenceText = normalizeEvidenceText(validated.data.evidence[field]);
      if (evidenceText) {
        evidence[field] = evidenceText;
      }
    }

    const detectedCurrencyFromPayload =
      validated.data.detectedCurrency ?? 'UNKNOWN';

    const detectedCurrencyFromText = inferCurrencyFromText(
      validated.data.ocrText.join(' '),
    );

    const detectedCurrency =
      detectedCurrencyFromPayload !== 'UNKNOWN'
        ? detectedCurrencyFromPayload
        : detectedCurrencyFromText;

    const currencies: Partial<Record<ShiftField, ShiftCurrency>> = {};

    for (const field of SHIFT_FIELDS) {
      if (!isMoneyField(field)) {
        currencies[field] = 'UNKNOWN';
        continue;
      }

      const modelCurrency = validated.data.currencies?.[field] ?? 'UNKNOWN';
      const evidenceCurrency = inferCurrencyFromText(evidence[field]);
      const detectedCurrency = validated.data.detectedCurrency ?? 'UNKNOWN';

      const resolved =
        modelCurrency !== 'UNKNOWN'
          ? modelCurrency
          : evidenceCurrency !== 'UNKNOWN'
            ? evidenceCurrency
            : detectedCurrency;

      currencies[field] = resolved;
    }

    return {
      confidence: validated.data.confidence,
      summary: validated.data.summary,
      reasons: dedupeReasons(validated.data.reasons),
      ocrText: validated.data.ocrText.slice(0, 12),
      evidence,
      extracted,
      currencies,
      detectedCurrency,
    };
  }

  function parseComparisonStep(params: {
    parsed: Record<string, unknown>;
    claimed: ClaimedShiftValues;
    extracted: Partial<ClaimedShiftValues>;
    discrepancies: ShiftValidationDiscrepancy[];
  }): Omit<ComparisonStepResult, 'usage'> | null {
    const mismatchCount = params.discrepancies.filter((item) => !item.withinTolerance).length;
    const extractedFields = params.discrepancies.length;

    const comparisonRowsRaw = Array.isArray(params.parsed.comparisons)
      ? params.parsed.comparisons
      : [];

    const normalizedComparisons = SHIFT_FIELDS.map((field) => {
      const rawComparison = comparisonRowsRaw.find((item) => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const candidateField = (item as { field?: unknown }).field;
        return typeof candidateField === 'string' && candidateField === field;
      }) as Record<string, unknown> | undefined;

      const discrepancy = params.discrepancies.find((item) => item.field === field);
      const fallbackExtracted =
        typeof params.extracted[field] === 'number' ? params.extracted[field] : null;
      const fallbackDelta = discrepancy?.deltaPct ??
        (fallbackExtracted === null
          ? null
          : Math.abs(fallbackExtracted - params.claimed[field]) /
            Math.max(Math.abs(params.claimed[field]), 1));
      const fallbackWithinTolerance = discrepancy?.withinTolerance ??
        (fallbackDelta === null ? true : fallbackDelta <= FIELD_TOLERANCE[field]);

      const hasComparableValue = fallbackExtracted !== null;

      return {
        field,
        claimed:
          parseOptionalNumber(rawComparison?.claimed) ?? params.claimed[field],
        extracted:
          parseOptionalNumber(rawComparison?.extracted) ?? fallbackExtracted,
        deltaPct:
          parseOptionalNumber(rawComparison?.deltaPct) ?? fallbackDelta,
        withinTolerance:
          typeof rawComparison?.withinTolerance === 'boolean'
            ? rawComparison.withinTolerance
            : fallbackWithinTolerance,
        reason: normalizeText(
          rawComparison?.reason,
          !hasComparableValue
            ? `${labelForField(field)} comparison skipped because image currency was not clearly detected.`
            : fallbackWithinTolerance
            ? `${labelForField(field)} appears consistent with the receipt.`
            : `${labelForField(field)} differs from OCR extracted values.`,
        ),
      };
    });

    const parsedVerdict = normalizeVerdict(
      (params.parsed.recommendedVerdict ?? params.parsed.verdict) as unknown,
    );

    const heuristicVerdict: 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE' =
      mismatchCount > 0
        ? 'FLAGGED'
        : extractedFields < MIN_EXTRACTED_FIELDS_FOR_CONFIRMED
          ? 'UNVERIFIABLE'
          : 'CONFIRMED';

    const comparisonCandidate = {
      confidence: clamp(parseOptionalNumber(params.parsed.confidence) ?? 0.62, 0, 1),
      trustScore: clamp(
        parseOptionalNumber(params.parsed.trustScore) ??
          (heuristicVerdict === 'CONFIRMED'
            ? 0.78
            : heuristicVerdict === 'FLAGGED'
              ? 0.28
              : 0.16),
        0.01,
        0.99,
      ),
      recommendedVerdict: parsedVerdict ?? heuristicVerdict,
      summary: normalizeText(
        params.parsed.summary,
        heuristicVerdict === 'FLAGGED'
          ? 'Claimed values differ from OCR extracted receipt values.'
          : heuristicVerdict === 'CONFIRMED'
            ? 'Claimed values are consistent with OCR extracted receipt values.'
            : 'OCR extraction was not sufficient for strict comparison.',
      ),
      reasons: normalizeStringArray(params.parsed.reasons, 12),
      comparisons: normalizedComparisons,
    };

    const validated = comparisonResponseSchema.safeParse(comparisonCandidate);
    if (!validated.success) {
      return null;
    }

    return {
      confidence: validated.data.confidence,
      trustScore: validated.data.trustScore,
      recommendedVerdict: validated.data.recommendedVerdict,
      summary: validated.data.summary,
      reasons: dedupeReasons(validated.data.reasons),
      comparisons: validated.data.comparisons,
    };
  }

  const extractionStep = await requestOpenRouterStep([
    {
      role: 'system',
      content: SHIFT_OCR_EXTRACT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            task: 'extract_shift_receipt_values',
            shift_id: input.shiftId,
            platform: input.platformName,
            shift_date: input.shiftDate,
            user_claim_currency: 'PKR',
            screenshot_count: input.screenshotUrls.length,
            notes: input.notes ?? null,
            instructions: [
              'Extract visible text and numeric values from the screenshots.',
              'Do not classify or flag in this extraction step.',
              'Determine currency from image evidence only (PKR/USD); if not visible return UNKNOWN.',
              'Return strictly valid JSON matching the schema.',
            ],
          }),
        },
        ...input.screenshotUrls.map((url) => ({
          type: 'image_url',
          image_url: { url },
        })),
      ],
    },
  ]);

  if (!extractionStep) {
    return null;
  }

  const parsedExtraction = parseExtractionStep(extractionStep.parsed);
  if (!parsedExtraction) {
    return null;
  }

  const extractedRawWithDerivedValues = deriveMissingExtractedValues(parsedExtraction.extracted);
  const usdToPkrRate = await getUsdToPkrRate();
  const normalizedExtraction = normalizeExtractedValuesToPkr({
    extracted: extractedRawWithDerivedValues,
    currencies: parsedExtraction.currencies,
    platformName: input.platformName,
    usdToPkrRate,
  });

  const discrepancies = buildDiscrepancies(input.claimed, normalizedExtraction.normalized);
  const mismatchCount = discrepancies.filter((item) => !item.withinTolerance).length;
  const extractedFields = discrepancies.length;

  const comparisonStep = await requestOpenRouterStep([
    {
      role: 'system',
      content: SHIFT_OCR_COMPARE_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'compare_claimed_vs_ocr_receipt_values',
        shift_id: input.shiftId,
        platform: input.platformName,
        shift_date: input.shiftDate,
        claimed_currency: 'PKR',
        claimed_values: input.claimed,
        comparison_currency: 'PKR',
        usd_to_pkr_rate: normalizedExtraction.usdToPkrRate,
        extracted_raw_values: extractedRawWithDerivedValues,
        extracted_value_currency: normalizedExtraction.currencies,
        extracted_values_pkr: normalizedExtraction.normalized,
        unresolved_currency_fields: normalizedExtraction.unresolvedCurrencyFields,
        normalization_notes: normalizedExtraction.conversionNotes,
        evidence: parsedExtraction.evidence,
        ocr_text: parsedExtraction.ocrText,
        tolerance_pct: FIELD_TOLERANCE,
        required_statuses: SHIFT_VERDICT_VALUES,
        instructions: [
          'Compare each field independently with tolerance in PKR.',
          'For money fields, use extracted_values_pkr as source of truth for mismatch checks.',
          'If image currency is unknown for a money field, keep that field UNVERIFIABLE and do not use it for FLAGGED.',
          'Include comparison reason for each field.',
          'Recommend FLAGGED only when at least one field is out-of-tolerance.',
          'Return strictly valid JSON matching schema.',
        ],
      }),
    },
  ]);

  const parsedComparison = comparisonStep
    ? parseComparisonStep({
        parsed: comparisonStep.parsed,
        claimed: input.claimed,
        extracted: normalizedExtraction.normalized,
        discrepancies,
      })
    : null;

  const confidence = clamp(
    parsedExtraction.confidence * 0.65 +
      (parsedComparison?.confidence ?? parsedExtraction.confidence) * 0.35,
    0,
    1,
  );

  const verdict = chooseVerdict({
    parsedVerdict: parsedComparison?.recommendedVerdict ?? null,
    confidence,
    extractedFields,
    mismatchCount,
    hasUnresolvedMoneyCurrency: normalizedExtraction.hasUnresolvedMoneyCurrency,
  });

  const matchedCount = discrepancies.length - mismatchCount;

  let trustScore = clamp(
    parsedComparison?.trustScore ??
      (verdict === 'CONFIRMED' ? 0.82 : verdict === 'FLAGGED' ? 0.3 : 0.12),
    0.01,
    0.99,
  );

  trustScore = clamp(
    trustScore - mismatchCount * 0.12 + matchedCount * 0.04 + confidence * 0.08,
    0.01,
    0.99,
  );

  if (verdict === 'CONFIRMED') {
    trustScore = Math.max(trustScore, 0.7);
  }

  if (verdict === 'FLAGGED') {
    trustScore = Math.min(trustScore, 0.45);
  }

  if (verdict === 'UNVERIFIABLE') {
    trustScore = Math.min(trustScore, 0.35);
  }

  const mismatchReasons = buildDetailedMismatchReasons(
    discrepancies,
    parsedExtraction.evidence,
    normalizedExtraction.normalizationMeta,
  );

  const comparisonReasons = parsedComparison
    ? parsedComparison.comparisons
        .filter((item) => !item.withinTolerance)
        .map((item) => `${labelForField(item.field)} comparison: ${item.reason}`)
    : [];

  const ocrSnippetReason =
    verdict === 'FLAGGED' && parsedExtraction.ocrText.length > 0
      ? [
          `OCR snippets: ${parsedExtraction.ocrText
            .slice(0, 3)
            .join(' | ')}`,
        ]
      : [];

  const reasons = dedupeReasons([
    ...mismatchReasons,
    ...comparisonReasons,
    ...normalizedExtraction.conversionNotes,
    ...ocrSnippetReason,
    ...(parsedComparison?.reasons ?? []),
    ...parsedExtraction.reasons,
  ]);

  if (verdict === 'FLAGGED' && mismatchReasons.length === 0) {
    reasons.push('Flagging requires numeric mismatch evidence; verify OCR extraction quality manually.');
  }

  if (verdict === 'UNVERIFIABLE' && normalizedExtraction.hasUnresolvedMoneyCurrency) {
    reasons.push(
      `Money field currency missing in image evidence for: ${normalizedExtraction.unresolvedCurrencyFields.join(', ')}.`,
    );
  }

  const summary =
    verdict === 'FLAGGED'
      ? normalizeText(
          parsedComparison?.summary,
          `${mismatchCount} value field(s) are out of tolerance against OCR extraction.`,
        )
      : verdict === 'CONFIRMED'
        ? normalizeText(
            parsedComparison?.summary,
            'Claimed values are consistent with extracted receipt values within tolerance.',
          )
        : normalizeText(
            parsedComparison?.summary,
            normalizedExtraction.hasUnresolvedMoneyCurrency
              ? 'Image currency could not be determined for one or more money fields; strict reconciliation marked as unverifiable.'
              : 'OCR extraction data was insufficient for strict automated reconciliation.',
          );

  return {
    model,
    confidence,
    trustScore,
    verdict,
    summary,
    reasons,
    discrepancies,
    extracted: normalizedExtraction.normalized,
    usage: mergeUsage(extractionStep.usage, comparisonStep?.usage),
  };
}

export async function validateShiftAgainstScreenshots(
  input: ShiftOcrValidationInput,
): Promise<ShiftOcrValidationResult> {
  if (input.screenshotUrls.length === 0) {
    return buildFallbackResult(
      DEFAULT_OCR_MODEL,
      'No screenshots were uploaded, so automated OCR reconciliation is not possible.',
      ['Upload screenshot evidence for automatic trust validation.'],
    );
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return buildFallbackResult(
      DEFAULT_OCR_MODEL,
      'OpenRouter API key is missing for screenshot OCR validation.',
      ['Set OPENROUTER_API_KEY to enable AI screenshot validation.'],
    );
  }

  const preferredModel =
    process.env.OPENROUTER_OCR_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.OPEN_ROUTER_MODEL?.trim() ||
    DEFAULT_OCR_MODEL;

  const envFallbackModels = (process.env.OPENROUTER_OCR_FALLBACK_MODELS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const candidates = [
    preferredModel,
    ...envFallbackModels,
    ...OCR_FALLBACK_MODELS,
  ].filter((model, index, all) => all.indexOf(model) === index);

  let lastError: string | null = null;

  for (const model of candidates) {
    try {
      const result = await runModel(model, apiKey, input);
      if (result) {
        return result;
      }

      lastError = `Model ${model} returned empty/invalid JSON output`;
    } catch (error) {
      lastError =
        error instanceof Error && error.message.trim()
          ? error.message
          : `Model ${model} failed`;
    }
  }

  return buildFallbackResult(
    preferredModel,
    'AI OCR validation is currently unavailable. Shift kept for manual verification.',
    lastError ? [lastError] : undefined,
  );
}
