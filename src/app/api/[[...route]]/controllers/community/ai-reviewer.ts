const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_DEFAULT_MODEL = 'google/gemma-2-9b-it:free';
const COMMUNITY_AI_PASS_THRESHOLD = 0.65;
const COMMUNITY_AI_PROMPT_VERSION = 'community-ai-review-v1';

export type CommunityAiReviewInput = {
  postId: string;
  title: string;
  body: string;
  createdAt: string;
  platform: {
    name: string;
    slug: string;
  } | null;
  upvoteCount: number;
  commentCount: number;
  reportCount: number;
  media: Array<{
    id: string;
    url: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  }>;
  recentComments: Array<{
    id: string;
    content: string;
    isAnonymous: boolean;
    createdAt: string;
  }>;
  reportReasons: string[];
  pendingQueueReasons: string[];
  moderatorNote?: string;
};

export type CommunityAiReviewVerdict = 'AI_VERIFIED' | 'AI_UNVERIFIED_LOW_TRUST';

export type CommunityAiReviewRecommendation =
  | 'VERIFY'
  | 'ESCALATE_HUMAN'
  | 'NEED_MORE_EVIDENCE';

export type CommunityAiReviewDecision = {
  verdict: CommunityAiReviewVerdict;
  trustScore: number;
  confidence: number;
  recommendation: CommunityAiReviewRecommendation;
  summary: string;
  reasons: string[];
  riskFlags: string[];
};

export type CommunityAiReviewUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type CommunityAiReviewRun = {
  provider: 'openrouter';
  model: string;
  promptVersion: string;
  latencyMs: number;
  decision: CommunityAiReviewDecision;
  usage: CommunityAiReviewUsage;
  rawResponse?: Record<string, unknown>;
};

const COMMUNITY_AI_REVIEW_SYSTEM_PROMPT = [
  'You are an expert trust-and-safety reviewer for worker grievance community posts.',
  'Read the provided post metadata and output ONLY valid JSON.',
  'Your job is to evaluate trustworthiness and moderation risk, not legal final judgment.',
  'Return concise and actionable reasons.',
  'Do not include markdown, code fences, or additional text.',
  'Use this JSON schema exactly:',
  '{',
  '  "trustScore": number,                 // 0 to 1',
  '  "confidence": number,                // 0 to 1',
  '  "verdict": "AI_VERIFIED" | "AI_UNVERIFIED_LOW_TRUST",',
  '  "recommendation": "VERIFY" | "ESCALATE_HUMAN" | "NEED_MORE_EVIDENCE",',
  '  "summary": string,',
  '  "reasons": string[],                 // up to 5',
  '  "riskFlags": string[]                // up to 5',
  '}',
].join('\n');

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, min, max);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return clamp(parsed, min, max);
    }
  }

  return clamp(fallback, min, max);
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  return cleaned.length ? cleaned : fallback;
}

function extractContentText(content: unknown): string | null {
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

function parseJsonContent(content: unknown): Record<string, unknown> | null {
  const text = extractContentText(content);
  if (!text) {
    return null;
  }

  let raw = text.trim();
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

function normalizeRecommendation(
  value: unknown,
  trustScore: number,
): CommunityAiReviewRecommendation {
  if (
    value === 'VERIFY' ||
    value === 'ESCALATE_HUMAN' ||
    value === 'NEED_MORE_EVIDENCE'
  ) {
    return value;
  }

  if (trustScore >= COMMUNITY_AI_PASS_THRESHOLD) {
    return 'VERIFY';
  }

  if (trustScore < 0.45) {
    return 'ESCALATE_HUMAN';
  }

  return 'NEED_MORE_EVIDENCE';
}

function normalizeDecision(payload: Record<string, unknown>): CommunityAiReviewDecision {
  const trustScore = normalizeNumber(payload.trustScore, 0.5, 0, 1);
  const confidence = normalizeNumber(payload.confidence, 0.6, 0, 1);

  const verdict: CommunityAiReviewVerdict =
    payload.verdict === 'AI_VERIFIED' || payload.verdict === 'AI_UNVERIFIED_LOW_TRUST'
      ? payload.verdict
      : trustScore >= COMMUNITY_AI_PASS_THRESHOLD
        ? 'AI_VERIFIED'
        : 'AI_UNVERIFIED_LOW_TRUST';

  const recommendation = normalizeRecommendation(payload.recommendation, trustScore);

  const summary = normalizeText(
    payload.summary,
    verdict === 'AI_VERIFIED'
      ? 'Signals are consistent with a trustworthy claim.'
      : 'Signals indicate this post needs additional verification.',
  );

  const reasons = normalizeStringArray(payload.reasons, [
    verdict === 'AI_VERIFIED'
      ? 'Community and evidence signals look internally consistent.'
      : 'Reported risk indicators lower trust in this claim.',
  ]);

  const riskFlags = normalizeStringArray(
    payload.riskFlags,
    verdict === 'AI_VERIFIED' ? [] : ['Insufficient confidence for autonomous verification'],
  );

  return {
    verdict,
    trustScore,
    confidence,
    recommendation,
    summary,
    reasons,
    riskFlags,
  };
}

function normalizeUsage(payload: Record<string, unknown>): CommunityAiReviewUsage {
  const usage = payload.usage && typeof payload.usage === 'object'
    ? (payload.usage as Record<string, unknown>)
    : null;

  const toNullableInt = (value: unknown): number | null => {
    const normalized = normalizeNumber(value, Number.NaN, 0, Number.MAX_SAFE_INTEGER);
    return Number.isFinite(normalized) ? Math.round(normalized) : null;
  };

  return {
    promptTokens: toNullableInt(usage?.prompt_tokens),
    completionTokens: toNullableInt(usage?.completion_tokens),
    totalTokens: toNullableInt(usage?.total_tokens),
  };
}

function getOpenRouterApiKey(): string | null {
  const rawKey = process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTER_API_KEY;
  const key = rawKey?.trim();
  return key ? key : null;
}

async function runWithModel(params: {
  model: string;
  apiKey: string;
  input: CommunityAiReviewInput;
  includeRawResponse: boolean;
}): Promise<CommunityAiReviewRun | null> {
  const startedAt = Date.now();

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: COMMUNITY_AI_REVIEW_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify(params.input),
        },
      ],
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      payload.error && typeof payload.error === 'object'
        ? (payload.error as { message?: string }).message
        : undefined;
    throw new Error(message?.trim() || `OpenRouter request failed (${response.status})`);
  }

  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const firstChoice = choices[0] as { message?: { content?: unknown } };
  const parsed = parseJsonContent(firstChoice?.message?.content);
  if (!parsed) {
    return null;
  }

  const latencyMs = Date.now() - startedAt;

  return {
    provider: 'openrouter',
    model: params.model,
    promptVersion: COMMUNITY_AI_PROMPT_VERSION,
    latencyMs,
    decision: normalizeDecision(parsed),
    usage: normalizeUsage(payload),
    rawResponse: params.includeRawResponse ? payload : undefined,
  };
}

export async function runCommunityAiReview(
  input: CommunityAiReviewInput,
  options?: { includeRawResponse?: boolean },
): Promise<CommunityAiReviewRun> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('OpenRouter API key is missing. Set OPENROUTER_API_KEY.');
  }

  const preferredModel =
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.OPEN_ROUTER_MODEL?.trim() ||
    OPENROUTER_DEFAULT_MODEL;

  const includeRawResponse = Boolean(options?.includeRawResponse);

  const primaryResult = await runWithModel({
    model: preferredModel,
    apiKey,
    input,
    includeRawResponse,
  });

  if (primaryResult) {
    return primaryResult;
  }

  if (preferredModel !== OPENROUTER_DEFAULT_MODEL) {
    const fallbackResult = await runWithModel({
      model: OPENROUTER_DEFAULT_MODEL,
      apiKey,
      input,
      includeRawResponse,
    });

    if (fallbackResult) {
      return fallbackResult;
    }
  }

  throw new Error('AI review response was empty or invalid JSON.');
}
