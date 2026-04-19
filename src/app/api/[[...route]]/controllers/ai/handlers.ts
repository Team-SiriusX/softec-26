import db from '@/lib/db';
import { Context } from 'hono';

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
};

type AiChatMode =
  | 'auto'
  | 'worker_evidence'
  | 'worker_recovery'
  | 'post_quality'
  | 'advocate_triage'
  | 'weekly_brief';

type AiLocale = 'en' | 'ur';

type AiHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

type AiActionPayload = Record<string, unknown>;

type AiDraftPayload = {
  title?: string;
  body?: string;
  platformId?: string;
  media?: Array<{ url?: string; mediaType?: string }>;
};

type AiConfirmAction = {
  id?: string;
  type: string;
  label?: string;
  route?: string;
  payload?: AiActionPayload;
  confirmed?: boolean;
};

type AiChatRequest = {
  mode: AiChatMode;
  message: string;
  locale?: AiLocale;
  entityId?: string;
  history?: AiHistoryItem[];
  threadSummary?: string;
  draft?: AiDraftPayload;
  confirmAction?: AiConfirmAction;
  stream?: boolean;
};

type ShiftAiReviewSummary = {
  summary: string | null;
  reasons: string[];
  model: string | null;
  trustScore: number | null;
  confidence: number | null;
  generatedAt: string | null;
};

type SuggestedAction = {
  id: string;
  type: string;
  label: string;
  route?: string;
  requiresConfirmation?: boolean;
  payload?: AiActionPayload;
};

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const AI_DEFAULT_MODEL = 'openai/gpt-4.1-mini';

const WORKER_ALLOWED_ROUTES = [
  '/worker/dashboard',
  '/worker/my-shift-logs',
  '/worker/log-shift',
  '/worker/anomaly-detection',
  '/worker/grievances',
  '/worker/community-feed',
  '/worker/earnings',
  '/worker/certificate',
  '/worker/profile',
] as const;

const ADVOCATE_ALLOWED_ROUTES = [
  '/advocate/dashboard',
  '/advocate/community-moderation',
  '/advocate/grievances',
  '/advocate/analytics',
] as const;

const BASE_SYSTEM_PROMPT = [
  'You are FairGig Copilot, a role-aware operations assistant for gig workers and advocates.',
  'Be concise, practical, and specific to retrieved context.',
  'Never fabricate facts not present in the provided context.',
  'If data is missing, clearly say what is missing.',
  'For worker safety and fairness, provide simple language first, then short actionable steps.',
  'Respect role boundaries. Do not suggest actions outside allowed routes and permissions.',
  'If the user asks to open or navigate to a page, include a NAVIGATE action using one of the allowed routes.',
  'If the user asks "who am I" or profile/account details, answer from currentUserProfile context and include SHOW_MY_PROFILE action.',
  'Do not claim navigation is already completed. Only propose actions and ask for confirmation when required.',
  'For any destructive or submission action, require explicit user confirmation.',
  'Always end your response with a machine-readable action block in this exact marker format:',
  '[[AI_ACTIONS_JSON]]',
  '{"actions":[{"id":"string","type":"string","label":"string","route":"optional","requiresConfirmation":false,"payload":{}}],"scores":{},"rewrite":{}}',
  '[[/AI_ACTIONS_JSON]]',
  'Keep JSON valid and compact. If no actions, return an empty array.',
].join('\n');

const MODE_PROMPTS: Record<Exclude<AiChatMode, 'auto'>, string> = {
  worker_evidence: [
    'Mode: Worker Evidence Coach.',
    'Explain why a shift was flagged in plain language.',
    'Interpret trust and confidence numbers clearly.',
    'Provide a practical re-upload checklist with at most 6 bullets.',
    'Prioritize evidence-backed mismatch reasons.',
    'Include at least one navigation action to log-shift with guidance.',
  ].join('\n'),
  worker_recovery: [
    'Mode: Worker Recovery Flow.',
    'Focus on income drop causes, strongest supporting shifts/screenshots, and recovery steps.',
    'Create a concise grievance draft suggestion if context supports it.',
    'Include a confirmation-gated grievance action when possible.',
  ].join('\n'),
  post_quality: [
    'Mode: Community Post Quality Assistant.',
    'Score draft on clarity, evidence completeness, tone risk, and likely trust outcome on a 0-100 scale.',
    'Provide rewrite suggestions with improved title/body.',
    'Keep rewrite suggestions concise and practical.',
    'Return scores in action JSON under scores and rewrite under rewrite.',
    'Include action suggestions for apply rewrite and evidence improvement.',
  ].join('\n'),
  advocate_triage: [
    'Mode: Advocate Triage Copilot.',
    'Rank high-risk moderation queue items first and provide decision rationale.',
    'Highlight items that should run AI review first versus human decision first.',
    'Include targeted actions for run-ai-review or human-review when post ids are available.',
  ].join('\n'),
  weekly_brief: [
    'Mode: Advocate Weekly Intelligence Brief.',
    'Generate a concise weekly memo with top deduction spikes, vulnerable cohorts, recurring grievance clusters, and recommendations.',
    'Keep it practical and decision-ready.',
    'Include actions for export brief and navigation to impacted views.',
  ].join('\n'),
};

function buildLocaleInstruction(locale: AiLocale, channel: 'text' | 'voice'): string {
  if (locale === 'ur') {
    return [
      'Locale: Urdu (ur-PK).',
      'Respond in clear Urdu script for user-facing text.',
      'Keep machine-readable JSON keys/actions/route fields in English and valid ASCII.',
      channel === 'voice'
        ? 'Keep sentences shorter for spoken playback and avoid dense formatting.'
        : 'Use concise bullets and practical wording.',
    ].join('\n');
  }

  return [
    'Locale: English (en-US).',
    'Respond in clear English for user-facing text.',
    channel === 'voice'
      ? 'Keep sentences shorter for spoken playback and avoid dense formatting.'
      : 'Use concise bullets and practical wording.',
  ].join('\n');
}

function buildSystemPrompt(
  mode: Exclude<AiChatMode, 'auto'>,
  locale: AiLocale,
  channel: 'text' | 'voice',
): string {
  return `${BASE_SYSTEM_PROMPT}\n\n${MODE_PROMPTS[mode]}\n\n${buildLocaleInstruction(locale, channel)}`;
}

type RouteIntentTarget = {
  id: string;
  label: string;
  route: string;
  patterns: RegExp[];
};

const WORKER_ROUTE_INTENTS: RouteIntentTarget[] = [
  {
    id: 'nav_worker_anomaly',
    label: 'Open Anomaly Detection',
    route: '/worker/anomaly-detection',
    patterns: [
      /\banomal(?:y|ies)\b/,
      /\banamoly\b/,
      /\banomoly\b/,
      /\banamaly\b/,
      /\banomly\b/,
    ],
  },
  {
    id: 'nav_worker_shift_logs',
    label: 'Open My Shift Logs',
    route: '/worker/my-shift-logs',
    patterns: [/\bmy\s+shift\s*logs?\b/, /\bshift\s*logs?\b/, /\bshift\s*history\b/],
  },
  {
    id: 'nav_worker_log_shift',
    label: 'Open Log Shift',
    route: '/worker/log-shift',
    patterns: [/\blog\s+shift\b/, /\bsubmit\s+shift\b/],
  },
  {
    id: 'nav_worker_community_feed',
    label: 'Open Community Feed',
    route: '/worker/community-feed',
    patterns: [/\bcommunity\s*(?:feed|board|post)\b/],
  },
  {
    id: 'nav_worker_grievances',
    label: 'Open Grievance Board',
    route: '/worker/grievances',
    patterns: [/\bgrievance(?:s|\s+board)?\b/, /\bcomplaint\s*board\b/],
  },
  {
    id: 'nav_worker_earnings',
    label: 'Open Earnings',
    route: '/worker/earnings',
    patterns: [/\bearnings?\b/, /\bincome\s*history\b/],
  },
  {
    id: 'nav_worker_certificate',
    label: 'Open Certificate Page',
    route: '/worker/certificate',
    patterns: [
      /\bcertificate\b/,
      /\bcertificates\b/,
      /\bmy\s+certificate\b/,
      /\bverification\s+certificate\b/,
    ],
  },
  {
    id: 'nav_worker_profile',
    label: 'Open My Profile',
    route: '/worker/profile',
    patterns: [/\bprofile\b/, /\baccount\b/, /\bmy\s+details\b/],
  },
  {
    id: 'nav_worker_dashboard',
    label: 'Open Worker Dashboard',
    route: '/worker/dashboard',
    patterns: [/\bdashboard\b/, /\bhome\b/],
  },
];

const ADVOCATE_ROUTE_INTENTS: RouteIntentTarget[] = [
  {
    id: 'nav_advocate_moderation',
    label: 'Open Community Moderation',
    route: '/advocate/community-moderation',
    patterns: [/\bcommunity[-\s]?moderation\b/, /\bmoderation\s*queue\b/, /\btriage\b/],
  },
  {
    id: 'nav_advocate_grievances',
    label: 'Open Grievances',
    route: '/advocate/grievances',
    patterns: [/\bgrievance(?:s)?\b/, /\bescalation\b/],
  },
  {
    id: 'nav_advocate_analytics',
    label: 'Open Advocate Analytics',
    route: '/advocate/analytics',
    patterns: [/\banalytics\b/, /\bbrief\b/, /\bintelligence\b/],
  },
  {
    id: 'nav_advocate_dashboard',
    label: 'Open Advocate Dashboard',
    route: '/advocate/dashboard',
    patterns: [/\bdashboard\b/, /\bhome\b/],
  },
];

function getOpenRouterApiKey(): string | null {
  const raw = process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTER_API_KEY;
  const value = raw?.trim();
  return value ? value : null;
}

function resolveLocale(locale: unknown): AiLocale {
  return locale === 'ur' ? 'ur' : 'en';
}

function normalizeMode(
  requestedMode: AiChatMode,
  role: SessionUser['role'],
  message: string,
): Exclude<AiChatMode, 'auto'> {
  if (requestedMode !== 'auto') {
    return requestedMode;
  }

  const normalized = normalizeIntentText(message);
  const isNavigationQuery =
    hasNavigationLanguage(normalized) || looksLikeRouteOnlyRequest(normalized);

  if (role === 'ADVOCATE') {
    if (/week|brief|summary|intelligence/.test(normalized)) {
      return 'weekly_brief';
    }

    return 'advocate_triage';
  }

  if (
    /post|title|rewrite|trust outcome|evidence completeness|community|feed|board/.test(
      normalized,
    )
  ) {
    return 'post_quality';
  }

  if (
    /recover|income drop|anomal(?:y|ies)|anamoly|anomoly|anamaly|anomly|grievance/.test(
      normalized,
    )
  ) {
    return 'worker_recovery';
  }

  if (isNavigationQuery) {
    return 'worker_evidence';
  }

  return 'worker_evidence';
}

function modeAllowedForRole(mode: Exclude<AiChatMode, 'auto'>, role: SessionUser['role']): boolean {
  if (role === 'ADVOCATE') {
    return mode === 'advocate_triage' || mode === 'weekly_brief';
  }

  return mode === 'worker_evidence' || mode === 'worker_recovery' || mode === 'post_quality';
}

function normalizeIntentText(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasNavigationLanguage(text: string): boolean {
  return /(navigate|navigation|open|visit|take me|bring me|move me|route me|go to|show me|page)/.test(
    text,
  );
}

function looksLikeRouteOnlyRequest(text: string): boolean {
  return /^(?:my\s+)?(?:shift\s*logs?|anomal(?:y|ies)|anamoly|anomoly|anamaly|anomly|community\s*(?:feed|board)|grievance(?:s|\s+board)?|profile|dashboard|earnings?|certificate|certificates?|log\s+shift)$/.test(
    text,
  );
}

function findRouteIntent(text: string, targets: RouteIntentTarget[]): RouteIntentTarget | null {
  for (const target of targets) {
    if (target.patterns.some((pattern) => pattern.test(text))) {
      return target;
    }
  }

  return null;
}

function detectIdentityIntent(message: string): boolean {
  const text = normalizeIntentText(message);
  return /(who am i|whoami|about me|my profile|my account|my details|my role|my info|my information)/.test(
    text,
  );
}

function parseFiniteNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normalizeStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function parsePersistedShiftAiReview(rawNote: string): ShiftAiReviewSummary | null {
  try {
    const parsed = JSON.parse(rawNote) as Record<string, unknown>;

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : null;

    const reasons = normalizeStringArray(parsed.reasons, 12);

    const model =
      typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : null;

    const generatedAt =
      typeof parsed.generatedAt === 'string' && parsed.generatedAt.trim()
        ? parsed.generatedAt.trim()
        : null;

    return {
      summary,
      reasons,
      model,
      trustScore: parseFiniteNumber(parsed.trustScore),
      confidence: parseFiniteNumber(parsed.confidence),
      generatedAt,
    };
  } catch {
    return null;
  }
}

function extractShiftAiReviewFromNotes(notes: Array<string | null>): ShiftAiReviewSummary | null {
  for (const note of notes) {
    if (!note || !note.trim()) {
      continue;
    }

    const parsed = parsePersistedShiftAiReview(note);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function shortText(value: string, max = 500): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function isArrayOfUnknown(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function buildPostQualityLocalFallback(context: unknown): {
  summary: string;
  scores: {
    clarity: number;
    evidenceCompleteness: number;
    toneRisk: number;
    trustOutcome: number;
  };
  rewrite: {
    title: string;
    body: string;
  };
} {
  const workerContext = context as {
    draft?: {
      title?: string;
      body?: string;
      media?: Array<{ url?: string; mediaType?: string }>;
    } | null;
  };

  const draft = workerContext.draft ?? null;
  const rawTitle = typeof draft?.title === 'string' ? draft.title.trim() : '';
  const rawBody = typeof draft?.body === 'string' ? draft.body.trim() : '';
  const media = isArrayOfUnknown(draft?.media) ? draft.media : [];

  const combined = `${rawTitle}\n${rawBody}`.trim();

  const hasDate =
    /(\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b)|(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)|(\btoday\b|\byesterday\b)/i.test(
      combined,
    );
  const hasAmount =
    /(\b(?:pkr|rs\.?|usd|\$)\s*\d)|(\b\d[\d,]*(?:\.\d+)?\s*(?:pkr|rs|usd)\b)/i.test(
      combined,
    );
  const hasEvidenceTerms =
    /\b(screenshot|receipt|proof|attached|evidence|invoice|statement|trip|order id|transaction)\b/i.test(
      combined,
    );

  const exclamationCount = (combined.match(/!/g) ?? []).length;
  const allCapsCount = (combined.match(/\b[A-Z]{4,}\b/g) ?? []).length;
  const inflammatoryCount = (
    combined.match(/\b(scam|fraud|thief|cheat|hate|idiot|useless|stole)\b/gi) ?? []
  ).length;

  let clarity = 45;
  clarity += rawTitle.length >= 12 && rawTitle.length <= 120 ? 15 : rawTitle.length >= 8 ? 8 : 0;
  clarity += rawBody.length >= 80 && rawBody.length <= 1600 ? 22 : rawBody.length >= 40 ? 12 : 0;
  clarity += hasDate ? 10 : 0;
  clarity += hasAmount ? 8 : 0;
  clarity = Math.round(clampScore(clarity));

  let evidenceCompleteness = 28;
  evidenceCompleteness += Math.min(media.length * 12, 36);
  evidenceCompleteness += hasDate ? 12 : 0;
  evidenceCompleteness += hasAmount ? 14 : 0;
  evidenceCompleteness += hasEvidenceTerms ? 10 : 0;
  evidenceCompleteness = Math.round(clampScore(evidenceCompleteness));

  let toneRisk = 16 + exclamationCount * 4 + allCapsCount * 3 + inflammatoryCount * 15;
  toneRisk = Math.round(clampScore(toneRisk, 5, 95));

  const trustOutcome = Math.round(
    clampScore(clarity * 0.35 + evidenceCompleteness * 0.45 + (100 - toneRisk) * 0.2),
  );

  const improvedTitle =
    rawTitle.length >= 8
      ? shortText(rawTitle, 140)
      : 'Payout discrepancy report with dates, amounts, and evidence';

  const issueSummary =
    rawBody.length > 0
      ? shortText(rawBody, 260)
      : '[Describe what changed in payout and why it appears unfair]';

  const timelineLine = hasDate
    ? 'Timeline: Keep exact shift/trip dates and times in chronological order.'
    : 'Timeline: Add exact date and time for each affected shift/trip.';

  const amountLine = hasAmount
    ? 'Amounts: Keep expected vs received values in PKR on separate lines.'
    : 'Amounts: Add expected vs received payout values (PKR), including deductions.';

  const evidenceLine =
    media.length > 0
      ? `Evidence attached: ${media.length} file(s). Mention which screenshot proves each amount.`
      : 'Evidence attached: Add screenshot(s) of payout, deductions, and trip/order details.';

  const improvedBody = [
    'Issue summary:',
    issueSummary,
    '',
    timelineLine,
    amountLine,
    evidenceLine,
    'Requested resolution: State the exact correction requested from the platform.',
  ]
    .join('\n')
    .trim();

  const titleForPreview = rawTitle || '[No title provided]';
  const bodyForPreview = rawBody || '[No body provided]';

  const summary = [
    '### Draft Quality Assessment',
    '',
    `**Title:** ${titleForPreview}`,
    '',
    `**Body:** ${bodyForPreview}`,
    '',
    '**Scores:**',
    `- **Clarity:** ${clarity}/100`,
    `- **Evidence Completeness:** ${evidenceCompleteness}/100`,
    `- **Tone Risk:** ${toneRisk}/100`,
    `- **Likely Trust Outcome:** ${trustOutcome}/100`,
    '',
    '### Rewrite Suggestions',
    '',
    `**Improved Title:** ${improvedTitle}`,
    '',
    `**Improved Body:** ${improvedBody}`,
    '',
    '### Action Suggestions',
    '1. **Apply Suggested Rewrite** to populate the composer instantly.',
    '2. **Add Missing Evidence Prompt** and attach screenshots proving each claim.',
    '',
    '> Provider is currently rate-limited, so this assessment was generated locally from your draft context.',
  ].join('\n');

  return {
    summary,
    scores: {
      clarity,
      evidenceCompleteness,
      toneRisk,
      trustOutcome,
    },
    rewrite: {
      title: improvedTitle,
      body: improvedBody,
    },
  };
}

function splitIntoKeywords(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 50);
}

function summarizeCommonKeywords(descriptions: string[]): Array<{ keyword: string; count: number }> {
  const stopWords = new Set([
    'that',
    'this',
    'with',
    'from',
    'have',
    'were',
    'your',
    'there',
    'about',
    'platform',
    'worker',
    'claim',
    'issue',
  ]);

  const counts = new Map<string, number>();

  for (const description of descriptions) {
    const seen = new Set<string>();

    for (const keyword of splitIntoKeywords(description)) {
      if (stopWords.has(keyword) || seen.has(keyword)) {
        continue;
      }

      seen.add(keyword);
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));
}

async function buildWorkerContext(params: {
  userId: string;
  entityId?: string;
  mode: Exclude<AiChatMode, 'auto'>;
  draft?: AiDraftPayload;
}) {
  const currentUser = await db.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      fullName: true,
      name: true,
      email: true,
      role: true,
      cityZone: true,
      category: true,
      isActive: true,
      createdAt: true,
    },
  });

  const shifts = await db.shiftLog.findMany({
    where: { workerId: params.userId },
    orderBy: { shiftDate: 'desc' },
    take: 20,
    include: {
      platform: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      screenshots: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          status: true,
          fileUrl: true,
          fileKey: true,
          verifierNotes: true,
          uploadedAt: true,
        },
      },
    },
  });

  const normalizedShifts = shifts.map((shift) => {
    const aiReview = extractShiftAiReviewFromNotes(
      shift.screenshots.map((item) => item.verifierNotes),
    );

    return {
      id: shift.id,
      shiftDate: shift.shiftDate.toISOString().slice(0, 10),
      platformId: shift.platform.id,
      platformName: shift.platform.name,
      verificationStatus: shift.verificationStatus,
      hoursWorked: Number(shift.hoursWorked),
      grossEarned: Number(shift.grossEarned),
      platformDeductions: Number(shift.platformDeductions),
      netReceived: Number(shift.netReceived),
      screenshots: shift.screenshots.map((item) => ({
        status: item.status,
        fileUrl: item.fileUrl,
        fileKey: item.fileKey,
        uploadedAt: item.uploadedAt.toISOString(),
      })),
      aiReview,
    };
  });

  const selectedShift =
    (params.entityId
      ? normalizedShifts.find((item) => item.id === params.entityId)
      : null) ??
    normalizedShifts.find(
      (item) => item.verificationStatus === 'FLAGGED' || item.verificationStatus === 'UNVERIFIABLE',
    ) ??
    normalizedShifts[0] ??
    null;

  const anomalies = await db.anomalyFlag.findMany({
    where: { workerId: params.userId },
    orderBy: { detectedAt: 'desc' },
    take: 5,
    include: {
      shiftLog: {
        select: {
          id: true,
          shiftDate: true,
          platform: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const grievanceRows = await db.grievance.findMany({
    where: { workerId: params.userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      platformId: true,
      category: true,
      status: true,
      title: true,
      description: true,
      isAnonymous: true,
      clusterId: true,
      createdAt: true,
      tags: {
        select: {
          tag: true,
        },
      },
      escalations: {
        orderBy: { escalatedAt: 'desc' },
        take: 1,
        select: {
          note: true,
          escalatedAt: true,
        },
      },
    },
  });

  const platformIds = grievanceRows
    .map((item) => item.platformId)
    .filter((value): value is string => Boolean(value));

  const grievancePlatforms = platformIds.length
    ? await db.platform.findMany({
        where: {
          id: {
            in: [...new Set(platformIds)],
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      })
    : [];

  const platformById = new Map(grievancePlatforms.map((platform) => [platform.id, platform]));

  const grievances = grievanceRows.map((item) => ({
    id: item.id,
    platform: item.platformId ? platformById.get(item.platformId) ?? null : null,
    category: item.category,
    status: item.status,
    title: shortText(item.title, 120),
    description: shortText(item.description, 260),
    isAnonymous: item.isAnonymous,
    clusterId: item.clusterId,
    tags: item.tags.map((tag) => tag.tag),
    latestEscalation: item.escalations[0]
      ? {
          note: item.escalations[0].note,
          escalatedAt: item.escalations[0].escalatedAt.toISOString(),
        }
      : null,
    createdAt: item.createdAt.toISOString(),
  }));

  const vulnerabilityFlags = await db.vulnerabilityFlag.findMany({
    where: { workerId: params.userId },
    orderBy: { flagMonth: 'desc' },
    take: 3,
    select: {
      flagMonth: true,
      prevMonthNet: true,
      currMonthNet: true,
      dropPct: true,
      resolved: true,
    },
  });

  const recentPosts = await db.communityPost.findMany({
    where: { authorId: params.userId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      title: true,
      body: true,
      verificationStatus: true,
      trustScore: true,
      reportCount: true,
      createdAt: true,
    },
  });

  return {
    role: 'WORKER',
    currentUserProfile: currentUser
      ? {
          id: currentUser.id,
          fullName: currentUser.fullName,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          cityZone: currentUser.cityZone,
          category: currentUser.category,
          isActive: currentUser.isActive,
          joinedAt: currentUser.createdAt.toISOString(),
        }
      : null,
    selectedShift,
    recentShifts: normalizedShifts,
    topAnomalies: anomalies.map((item) => ({
      id: item.id,
      type: item.flagType,
      severity: item.severity,
      explanation: shortText(item.explanation, 260),
      zScore: item.zScore ? Number(item.zScore) : null,
      detectedAt: item.detectedAt.toISOString(),
      shift: item.shiftLog
        ? {
            id: item.shiftLog.id,
            shiftDate: item.shiftLog.shiftDate.toISOString().slice(0, 10),
            platformName: item.shiftLog.platform.name,
          }
        : null,
    })),
    grievances,
    vulnerabilityFlags: vulnerabilityFlags.map((item) => ({
      flagMonth: item.flagMonth.toISOString().slice(0, 10),
      prevMonthNet: Number(item.prevMonthNet),
      currMonthNet: Number(item.currMonthNet),
      dropPct: Number(item.dropPct),
      resolved: item.resolved,
    })),
    postQualityHistory: recentPosts.map((item) => ({
      id: item.id,
      title: shortText(item.title, 140),
      body: shortText(item.body, 200),
      verificationStatus: item.verificationStatus,
      trustScore: item.trustScore ? Number(item.trustScore) : null,
      reportCount: item.reportCount,
      createdAt: item.createdAt.toISOString(),
    })),
    draft: params.draft ?? null,
  };
}

async function buildAdvocateContext(params: {
  userId: string;
  mode: Exclude<AiChatMode, 'auto'>;
}) {
  const currentUser = await db.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      fullName: true,
      name: true,
      email: true,
      role: true,
      cityZone: true,
      category: true,
      isActive: true,
      createdAt: true,
    },
  });

  const moderationQueue = await db.communityPostReviewQueue.findMany({
    where: {
      status: 'PENDING',
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 10,
    include: {
      triggeredBy: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
      post: {
        select: {
          id: true,
          title: true,
          body: true,
          verificationStatus: true,
          trustScore: true,
          upvoteCount: true,
          reportCount: true,
          createdAt: true,
          platform: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          media: {
            orderBy: { createdAt: 'asc' },
            take: 4,
            select: {
              id: true,
              mediaType: true,
              url: true,
            },
          },
          reports: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              reason: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const [
    grievanceTotal,
    grievanceOpen,
    grievanceEscalated,
    grievanceResolved,
    grievanceByCategory,
    recurringClusters,
  ] = await Promise.all([
    db.grievance.count(),
    db.grievance.count({ where: { status: 'OPEN' } }),
    db.grievance.count({ where: { status: 'ESCALATED' } }),
    db.grievance.count({ where: { status: 'RESOLVED' } }),
    db.grievance.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: 'desc',
        },
      },
      take: 6,
    }),
    db.grievance.groupBy({
      by: ['clusterId'],
      where: {
        clusterId: { not: null },
      },
      _count: {
        clusterId: true,
      },
      orderBy: {
        _count: {
          clusterId: 'desc',
        },
      },
      take: 5,
    }),
  ]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const anomalySignals = await db.anomalyFlag.groupBy({
    by: ['flagType', 'severity'],
    where: {
      detectedAt: {
        gte: weekAgo,
      },
    },
    _count: {
      flagType: true,
    },
    orderBy: {
      _count: {
        flagType: 'desc',
      },
    },
    take: 10,
  });

  const deductionSpikeRows = await db.dailyPlatformStat.findMany({
    where: {
      statDate: {
        gte: weekAgo,
      },
    },
    orderBy: [{ avgCommissionPct: 'desc' }, { statDate: 'desc' }],
    take: 8,
    select: {
      platformId: true,
      cityZone: true,
      category: true,
      statDate: true,
      avgCommissionPct: true,
      workerCount: true,
    },
  });

  const affectedPlatformIds = [...new Set(deductionSpikeRows.map((item) => item.platformId))];
  const affectedPlatforms = affectedPlatformIds.length
    ? await db.platform.findMany({
        where: {
          id: {
            in: affectedPlatformIds,
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      })
    : [];

  const platformById = new Map(affectedPlatforms.map((item) => [item.id, item]));

  const vulnerabilityRecent = await db.vulnerabilityFlag.findMany({
    where: {
      createdAt: {
        gte: weekAgo,
      },
    },
    select: {
      workerId: true,
      dropPct: true,
      createdAt: true,
      flagMonth: true,
    },
    take: 80,
    orderBy: {
      createdAt: 'desc',
    },
  });

  const vulnerableWorkerIds = [...new Set(vulnerabilityRecent.map((item) => item.workerId))];
  const vulnerableWorkers = vulnerableWorkerIds.length
    ? await db.user.findMany({
        where: {
          id: {
            in: vulnerableWorkerIds,
          },
        },
        select: {
          id: true,
          cityZone: true,
          category: true,
        },
      })
    : [];

  const workerById = new Map(vulnerableWorkers.map((item) => [item.id, item]));

  const vulnerableCohortMap = new Map<string, { cityZone: string; category: string; count: number }>();

  for (const item of vulnerabilityRecent) {
    const worker = workerById.get(item.workerId);
    const cityZone = worker?.cityZone ?? 'Unknown';
    const category = worker?.category ?? 'OTHER';
    const key = `${cityZone}::${category}`;

    const existing = vulnerableCohortMap.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    vulnerableCohortMap.set(key, {
      cityZone,
      category,
      count: 1,
    });
  }

  const recentGrievances = await db.grievance.findMany({
    where: {
      createdAt: {
        gte: weekAgo,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 40,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      clusterId: true,
      createdAt: true,
    },
  });

  return {
    role: 'ADVOCATE',
    currentUserProfile: currentUser
      ? {
          id: currentUser.id,
          fullName: currentUser.fullName,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          cityZone: currentUser.cityZone,
          category: currentUser.category,
          isActive: currentUser.isActive,
          joinedAt: currentUser.createdAt.toISOString(),
        }
      : null,
    moderationQueue: moderationQueue.map((item) => ({
      id: item.id,
      reason: item.reason,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
      triggeredBy: item.triggeredBy
        ? {
            id: item.triggeredBy.id,
            fullName: item.triggeredBy.fullName,
            role: item.triggeredBy.role,
          }
        : null,
      post: {
        id: item.post.id,
        title: shortText(item.post.title, 140),
        body: shortText(item.post.body, 220),
        verificationStatus: item.post.verificationStatus,
        trustScore: item.post.trustScore ? Number(item.post.trustScore) : null,
        reportCount: item.post.reportCount,
        upvoteCount: item.post.upvoteCount,
        platform: item.post.platform,
        media: item.post.media,
        recentReportReasons: item.post.reports.map((report) => ({
          reason: shortText(report.reason, 90),
          createdAt: report.createdAt.toISOString(),
        })),
      },
    })),
    grievanceSummary: {
      total: grievanceTotal,
      open: grievanceOpen,
      escalated: grievanceEscalated,
      resolved: grievanceResolved,
      topCategories: grievanceByCategory.map((item) => ({
        category: item.category,
        count: item._count.category,
      })),
      recurringClusters: recurringClusters.map((item) => ({
        clusterId: item.clusterId,
        count: item._count.clusterId,
      })),
      recentKeywordSignals: summarizeCommonKeywords(
        recentGrievances.map((item) => `${item.title} ${item.description}`),
      ),
    },
    weeklySignals: {
      topDeductionSpikes: deductionSpikeRows.map((item) => ({
        platformId: item.platformId,
        platformName: platformById.get(item.platformId)?.name ?? item.platformId,
        cityZone: item.cityZone,
        category: item.category,
        statDate: item.statDate.toISOString().slice(0, 10),
        avgCommissionPct: Number(item.avgCommissionPct),
        workerCount: item.workerCount,
      })),
      anomalySignals: anomalySignals.map((item) => ({
        flagType: item.flagType,
        severity: item.severity,
        count: item._count.flagType,
      })),
      vulnerableCohorts: [...vulnerableCohortMap.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      recentGrievanceClusters: recentGrievances
        .filter((item) => item.clusterId)
        .slice(0, 12)
        .map((item) => ({
          id: item.id,
          clusterId: item.clusterId,
          category: item.category,
          status: item.status,
          title: shortText(item.title, 120),
          createdAt: item.createdAt.toISOString(),
        })),
    },
  };
}

async function buildModeContext(params: {
  user: SessionUser;
  mode: Exclude<AiChatMode, 'auto'>;
  entityId?: string;
  draft?: AiDraftPayload;
}) {
  if (params.user.role === 'ADVOCATE') {
    return buildAdvocateContext({
      userId: params.user.id,
      mode: params.mode,
    });
  }

  return buildWorkerContext({
    userId: params.user.id,
    mode: params.mode,
    entityId: params.entityId,
    draft: params.draft,
  });
}

function buildSuggestedActions(params: {
  mode: Exclude<AiChatMode, 'auto'>;
  role: SessionUser['role'];
  context: unknown;
}): SuggestedAction[] {
  const { mode, role } = params;

  if (role === 'WORKER') {
    const workerContext = params.context as {
      selectedShift?: {
        id: string;
        verificationStatus: string;
      } | null;
      recentShifts?: Array<{
        id: string;
        platformId?: string;
      }>;
      topAnomalies?: Array<{
        shift?: { id: string } | null;
      }>;
    };

    if (mode === 'worker_evidence') {
      const shiftId = workerContext.selectedShift?.id;

      return [
        {
          id: 'open_shift_log_guided',
          type: 'OPEN_SHIFT_LOG_WITH_GUIDANCE',
          label: 'Open Log Shift With AI Guidance',
          route: shiftId
            ? `/worker/log-shift?guided=1&source=evidence_coach&shiftId=${encodeURIComponent(shiftId)}`
            : '/worker/log-shift?guided=1&source=evidence_coach',
          payload: shiftId ? { shiftId } : undefined,
        },
        {
          id: 'open_my_shift_logs',
          type: 'NAVIGATE',
          label: 'Open My Shift Logs',
          route: '/worker/my-shift-logs',
        },
      ];
    }

    if (mode === 'worker_recovery') {
      const targetShiftId =
        workerContext.topAnomalies?.[0]?.shift?.id ?? workerContext.selectedShift?.id ?? null;
      const platformId = workerContext.recentShifts?.[0]?.platformId;

      return [
        {
          id: 'draft_grievance',
          type: 'DRAFT_GRIEVANCE',
          label: 'Draft Grievance From Recovery Plan',
          requiresConfirmation: true,
          payload: {
            platformId,
            category: 'PAYMENT_DISPUTE',
            description:
              targetShiftId
                ? `AI-assisted grievance draft: Income drop and/or deduction anomalies observed around shift ${targetShiftId}. Please review payout fairness.`
                : 'AI-assisted grievance draft: Income drop and deduction anomalies observed. Please review payout fairness.',
            isAnonymous: false,
          },
        },
        {
          id: 'open_grievance_board',
          type: 'NAVIGATE',
          label: 'Open Grievance Board',
          route: '/worker/grievances',
        },
        {
          id: 'open_anomaly_page',
          type: 'NAVIGATE',
          label: 'Open Anomaly Detection',
          route: '/worker/anomaly-detection',
        },
      ];
    }

    if (mode === 'post_quality') {
      return [
        {
          id: 'apply_rewrite_to_community_draft',
          type: 'APPLY_REWRITE_TO_COMMUNITY_DRAFT',
          label: 'Apply Rewrite In Community Composer',
          route: '/worker/community-feed?view=mine&compose=1&source=worker_ai',
        },
        {
          id: 'apply_rewrite',
          type: 'APPLY_REWRITE',
          label: 'Apply Suggested Rewrite',
        },
        {
          id: 'add_missing_evidence',
          type: 'ADD_MISSING_EVIDENCE_PROMPT',
          label: 'Add Missing Evidence Prompt',
        },
        {
          id: 'request_verification_readiness',
          type: 'REQUEST_VERIFICATION_READINESS',
          label: 'Request Verification Readiness',
          route: '/worker/community-feed?view=mine',
        },
      ];
    }
  }

  if (role === 'ADVOCATE') {
    const advocateContext = params.context as {
      moderationQueue?: Array<{
        post: {
          id: string;
          verificationStatus: string;
        };
      }>;
      weeklySignals?: {
        topDeductionSpikes?: Array<{
          platformId: string;
        }>;
      };
    };

    if (mode === 'advocate_triage') {
      const queue = advocateContext.moderationQueue ?? [];
      const firstAiCandidate = queue.find(
        (item) =>
          item.post.verificationStatus === 'PENDING_AI_REVIEW' ||
          item.post.verificationStatus === 'UNVERIFIED',
      );
      const firstHumanCandidate = queue.find(
        (item) => item.post.verificationStatus === 'PENDING_HUMAN_REVIEW',
      );

      return [
        ...(firstAiCandidate
          ? [
              {
                id: 'run_ai_review_first',
                type: 'RUN_AI_REVIEW',
                label: 'Run AI Review On Top Candidate',
                payload: {
                  postId: firstAiCandidate.post.id,
                },
              } satisfies SuggestedAction,
            ]
          : []),
        ...(firstHumanCandidate
          ? [
              {
                id: 'human_verify_candidate',
                type: 'SUBMIT_HUMAN_REVIEW',
                label: 'Human Verify Top Human-Review Candidate',
                requiresConfirmation: true,
                payload: {
                  postId: firstHumanCandidate.post.id,
                  verdict: 'VERIFIED',
                },
              } satisfies SuggestedAction,
            ]
          : []),
        {
          id: 'open_similar_cases',
          type: 'OPEN_SIMILAR_CASES',
          label: 'Open Similar Grievance Cases',
          route: '/advocate/grievances',
        },
      ];
    }

    if (mode === 'weekly_brief') {
      const topPlatform = advocateContext.weeklySignals?.topDeductionSpikes?.[0]?.platformId;

      return [
        {
          id: 'export_weekly_brief',
          type: 'EXPORT_WEEKLY_BRIEF',
          label: 'Export Weekly Brief',
        },
        {
          id: 'open_impacted_platform_slice',
          type: 'OPEN_IMPACTED_PLATFORM',
          label: 'Open Impacted Platform Slice',
          route: topPlatform
            ? `/advocate/analytics?platformId=${encodeURIComponent(topPlatform)}`
            : '/advocate/analytics',
          payload: topPlatform ? { platformId: topPlatform } : undefined,
        },
        {
          id: 'open_escalation_candidates',
          type: 'OPEN_ESCALATION_CANDIDATES',
          label: 'Open Escalation Candidates',
          route: '/advocate/grievances?status=ESCALATED',
        },
      ];
    }
  }

  return [];
}

function detectNavigationIntent(
  message: string,
  role: SessionUser['role'],
): SuggestedAction | null {
  const text = normalizeIntentText(message);
  const hasNavIntent = hasNavigationLanguage(text) || looksLikeRouteOnlyRequest(text);

  if (!hasNavIntent) {
    return null;
  }

  const target =
    role === 'ADVOCATE'
      ? findRouteIntent(text, ADVOCATE_ROUTE_INTENTS)
      : findRouteIntent(text, WORKER_ROUTE_INTENTS);

  if (!target) {
    return null;
  }

  return {
    id: target.id,
    type: 'NAVIGATE',
    label: target.label,
    route: target.route,
  };
}

function buildIdentityAction(params: {
  message: string;
  role: SessionUser['role'];
  user: SessionUser;
  context: unknown;
}): SuggestedAction | null {
  if (!detectIdentityIntent(params.message)) {
    return null;
  }

  const contextProfile = (params.context as {
    currentUserProfile?: {
      fullName?: string | null;
      name?: string | null;
      email?: string | null;
      role?: string | null;
      cityZone?: string | null;
      category?: string | null;
      joinedAt?: string | null;
      isActive?: boolean | null;
    } | null;
  }).currentUserProfile;

  const profileRoute = params.role === 'WORKER' ? '/worker/profile' : '/advocate/dashboard';

  return {
    id: 'show_my_profile',
    type: 'SHOW_MY_PROFILE',
    label: params.role === 'WORKER' ? 'Open My Profile' : 'Open Advocate Dashboard',
    route: profileRoute,
    payload: {
      fullName: contextProfile?.fullName ?? contextProfile?.name ?? params.user.name,
      email: contextProfile?.email ?? params.user.email,
      role: contextProfile?.role ?? params.user.role,
      cityZone: contextProfile?.cityZone ?? null,
      category: contextProfile?.category ?? null,
      joinedAt: contextProfile?.joinedAt ?? null,
      isActive: contextProfile?.isActive ?? null,
    },
  };
}

function prependSuggestedAction(
  actions: SuggestedAction[],
  action: SuggestedAction | null,
): SuggestedAction[] {
  if (!action) {
    return actions;
  }

  const exists = actions.some(
    (item) => item.id === action.id || (item.route && item.route === action.route),
  );

  if (exists) {
    return actions;
  }

  return [action, ...actions];
}

function buildRouteGuardrails(role: SessionUser['role']): readonly string[] {
  if (role === 'ADVOCATE') {
    return ADVOCATE_ALLOWED_ROUTES;
  }

  return WORKER_ALLOWED_ROUTES;
}

function buildFallbackAssistantText(params: {
  mode: Exclude<AiChatMode, 'auto'>;
  locale: AiLocale;
  actions: SuggestedAction[];
  context: unknown;
  modelError?: string | null;
}): string {
  const baseMessage =
    params.locale === 'ur'
      ? params.mode === 'worker_evidence'
        ? 'میں ابھی AI ماڈل تک نہیں پہنچ سکا، لیکن آپ کے تازہ ترین شفٹ ریویو کے مطابق اسکرین شاٹس کی وضاحت، کرنسی کی نمائش، اور نمبر میچنگ دوبارہ چیک کریں۔'
        : params.mode === 'worker_recovery'
          ? 'میں ابھی AI ماڈل تک نہیں پہنچ سکا، لیکن آمدن کی بحالی کے لئے پہلے مضبوط شواہد جمع کریں اور پھر مختصر گریوینس ڈرافٹ بنائیں۔'
          : params.mode === 'post_quality'
            ? 'میں ابھی AI ماڈل تک نہیں پہنچ سکا، لیکن آپ اپنی پوسٹ کو تاریخ، رقم اور ثبوت واضح لکھ کر بہتر بنا سکتے ہیں۔'
            : params.mode === 'advocate_triage'
              ? 'میں ابھی AI ماڈل تک نہیں پہنچ سکا، لیکن آپ پھر بھی زیادہ رپورٹ اور کم ٹرسٹ آئٹمز کو پہلے ترجیح دے سکتے ہیں۔'
              : 'میں ابھی AI ماڈل تک نہیں پہنچ سکا، لیکن آپ اینالیٹکس میں ٹاپ اسپائکس، کوہورٹس اور کلسٹر پیٹرنز دیکھ سکتے ہیں۔'
      : params.mode === 'worker_evidence'
        ? 'I could not reach the AI model right now, but your latest shift review suggests you should recheck screenshot clarity, currency visibility, and mismatch fields before re-uploading.'
        : params.mode === 'worker_recovery'
          ? 'I could not reach the AI model right now, but income recovery usually starts with collecting your strongest anomaly evidence and drafting a focused grievance.'
          : params.mode === 'post_quality'
            ? 'I could not reach the AI model right now, but you can still improve your post by being specific about dates, amounts, and evidence attachments.'
            : params.mode === 'advocate_triage'
              ? 'I could not reach the AI model right now, but you can still prioritize high-report and low-trust queue items first.'
              : 'I could not reach the AI model right now, but you can still review top spikes, cohorts, and cluster patterns from analytics.';

  const structured: {
    actions: SuggestedAction[];
    scores?: {
      clarity: number;
      evidenceCompleteness: number;
      toneRisk: number;
      trustOutcome: number;
    };
    rewrite?: {
      title: string;
      body: string;
    };
  } = {
    actions: params.actions,
  };

  let text = baseMessage;

  if (params.mode === 'post_quality') {
    const local = buildPostQualityLocalFallback(params.context);
    text = local.summary;
    structured.scores = local.scores;
    structured.rewrite = local.rewrite;
  } else if (params.modelError) {
    text = `${baseMessage}\n\nModel error: ${shortText(params.modelError, 220)}`;
  }

  return [
    text,
    '',
    '[[AI_ACTIONS_JSON]]',
    JSON.stringify(structured),
    '[[/AI_ACTIONS_JSON]]',
  ].join('\n');
}

function ensureActionBlock(text: string, actions: SuggestedAction[]): string {
  if (text.includes('[[AI_ACTIONS_JSON]]')) {
    return text;
  }

  return [
    text.trim(),
    '',
    '[[AI_ACTIONS_JSON]]',
    JSON.stringify({ actions }),
    '[[/AI_ACTIONS_JSON]]',
  ].join('\n');
}

function extractCompletionText(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];

  if (!first || typeof first !== 'object') {
    return '';
  }

  const firstRecord = first as Record<string, unknown>;
  const message = firstRecord.message;

  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content;

    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (part && typeof part === 'object') {
            const text = (part as Record<string, unknown>).text;
            return typeof text === 'string' ? text : '';
          }

          return '';
        })
        .join('')
        .trim();
    }
  }

  return '';
}

function createSseChunk(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function splitIntoStreamChunks(text: string, maxChars = 80): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const chunks: string[] = [];

  for (const line of lines) {
    if (line.length <= maxChars) {
      chunks.push(`${line}\n`);
      continue;
    }

    const words = line.split(/\s+/).filter(Boolean);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;

      if (candidate.length > maxChars) {
        if (current) {
          chunks.push(`${current}\n`);
        }
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) {
      chunks.push(`${current}\n`);
    }
  }

  return chunks.length > 0 ? chunks : [text];
}

function createFallbackSseResponse(text: string): Response {
  const now = Math.floor(Date.now() / 1000);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      controller.enqueue(
        encoder.encode(
          createSseChunk({
            id: 'fallback',
            object: 'chat.completion.chunk',
            created: now,
            model: 'fallback-local',
            choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
          }),
        ),
      );

      for (const chunk of splitIntoStreamChunks(text)) {
        controller.enqueue(
          encoder.encode(
            createSseChunk({
              id: 'fallback',
              object: 'chat.completion.chunk',
              created: now,
              model: 'fallback-local',
              choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
            }),
          ),
        );

        await new Promise((resolve) => setTimeout(resolve, 14));
      }

      controller.enqueue(
        encoder.encode(
          createSseChunk({
            id: 'fallback',
            object: 'chat.completion.chunk',
            created: now,
            model: 'fallback-local',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          }),
        ),
      );

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-AI-Fallback': 'true',
    },
  });
}

function normalizeHistory(history: AiHistoryItem[] | undefined): AiHistoryItem[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (item): item is AiHistoryItem =>
        Boolean(item) &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0,
    )
    .slice(-6)
    .map((item) => ({
      role: item.role,
      content: shortText(item.content, 4000),
    }));
}

function buildPromptPayload(params: {
  user: SessionUser;
  mode: Exclude<AiChatMode, 'auto'>;
  locale: AiLocale;
  message: string;
  context: unknown;
  actions: SuggestedAction[];
  threadSummary?: string;
  confirmAction?: AiConfirmAction;
}): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      role: params.user.role,
      userId: params.user.id,
      mode: params.mode,
      locale: params.locale,
      query: params.message,
      threadSummary: params.threadSummary ?? null,
      allowedRoutes: buildRouteGuardrails(params.user.role),
      suggestedActions: params.actions,
      confirmedAction: params.confirmAction ?? null,
      context: params.context,
      requirements: {
        keepAnswersGroundedToContext: true,
        includeActionBlock: true,
        includeNavigateActionWhenRequested: true,
        markerStart: '[[AI_ACTIONS_JSON]]',
        markerEnd: '[[/AI_ACTIONS_JSON]]',
        maxBullets: 6,
      },
    },
    null,
    2,
  );
}

function preferredAiModels(): string[] {
  const prioritizedModel =
    process.env.OPENROUTER_CHAT_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.OPEN_ROUTER_MODEL?.trim() ||
    AI_DEFAULT_MODEL;

  const configuredListRaw =
    process.env.OPENROUTER_CHAT_MODELS?.trim() ||
    process.env.OPENROUTER_MODELS?.trim() ||
    process.env.OPEN_ROUTER_MODELS?.trim() ||
    '';

  const configuredList = configuredListRaw
    ? configuredListRaw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const defaults = [
    prioritizedModel,
    'openai/gpt-4o-mini',
    'google/gemini-2.0-flash-001',
    'anthropic/claude-3.5-haiku',
  ];

  const seen = new Set<string>();
  const ordered = [...configuredList, ...defaults].filter((model) => {
    if (seen.has(model)) {
      return false;
    }

    seen.add(model);
    return true;
  });

  return ordered.length > 0 ? ordered : [AI_DEFAULT_MODEL];
}

export const chatHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = (c.req as unknown as { valid: (target: 'json') => AiChatRequest }).valid(
    'json',
  );
  const locale = resolveLocale(payload.locale);

  const resolvedMode = normalizeMode(payload.mode, user.role, payload.message);

  if (!modeAllowedForRole(resolvedMode, user.role)) {
    return c.json(
      {
        error: 'Mode is not allowed for your role',
      },
      403,
    );
  }

  const context = await buildModeContext({
    user,
    mode: resolvedMode,
    entityId: payload.entityId,
    draft: payload.draft,
  });

  const suggestedActions = buildSuggestedActions({
    mode: resolvedMode,
    role: user.role,
    context,
  });

  const navIntentAction = detectNavigationIntent(payload.message, user.role);
  const identityAction = buildIdentityAction({
    message: payload.message,
    role: user.role,
    user,
    context,
  });

  const withNavigation = prependSuggestedAction(suggestedActions, navIntentAction);
  const finalSuggestedActions = prependSuggestedAction(withNavigation, identityAction);

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return createFallbackSseResponse(
      buildFallbackAssistantText({
        mode: resolvedMode,
        locale,
        actions: finalSuggestedActions,
        context,
      }),
    );
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: buildSystemPrompt(resolvedMode, locale, 'text'),
    },
    ...normalizeHistory(payload.history).map((item) => ({
      role: item.role,
      content: item.content,
    })),
    {
      role: 'user',
      content: buildPromptPayload({
        user,
        mode: resolvedMode,
        locale,
        message: payload.message,
        context,
        actions: finalSuggestedActions,
        threadSummary: payload.threadSummary,
        confirmAction: payload.confirmAction,
      }),
    },
  ];

  const modelCandidates = preferredAiModels();

  let openRouterResponse: Response | null = null;
  let selectedModel = modelCandidates[0] ?? AI_DEFAULT_MODEL;
  let lastModelError: string | null = null;

  for (const modelCandidate of modelCandidates) {
    selectedModel = modelCandidate;

    const candidateResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelCandidate,
        stream: payload.stream !== false,
        temperature: 0.2,
        messages,
      }),
    });

    if (candidateResponse.ok) {
      openRouterResponse = candidateResponse;
      break;
    }

    const errorText = await candidateResponse.text();
    lastModelError = `model=${modelCandidate}; status=${candidateResponse.status}; ${shortText(
      errorText,
      220,
    )}`;

    const noEndpointFound =
      candidateResponse.status === 404 && /no endpoints found/i.test(errorText);

    const shouldRetry =
      noEndpointFound ||
      candidateResponse.status === 429 ||
      (candidateResponse.status >= 500 && candidateResponse.status <= 599);

    if (!shouldRetry) {
      break;
    }
  }

  if (!openRouterResponse) {
    return createFallbackSseResponse(
      buildFallbackAssistantText({
        mode: resolvedMode,
        locale,
        actions: finalSuggestedActions,
        context,
        modelError: lastModelError,
      }),
    );
  }

  if (payload.stream === false) {
    const parsed = (await openRouterResponse.json()) as Record<string, unknown>;
    return c.json({ data: parsed });
  }

  if (!openRouterResponse.body) {
    return createFallbackSseResponse(
      buildFallbackAssistantText({
        mode: resolvedMode,
        locale,
        actions: finalSuggestedActions,
        context,
      }),
    );
  }

  return new Response(openRouterResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-AI-Mode': resolvedMode,
      'X-AI-Provider': 'openrouter',
      'X-AI-Model': selectedModel,
    },
  });
};

type AiVoiceSpeakRequest = {
  text: string;
  locale?: AiLocale;
};

export const voiceQueryHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = (c.req as unknown as { valid: (target: 'json') => AiChatRequest }).valid(
    'json',
  );
  const locale = resolveLocale(payload.locale);

  const resolvedMode = normalizeMode(payload.mode, user.role, payload.message);

  if (!modeAllowedForRole(resolvedMode, user.role)) {
    return c.json(
      {
        error: 'Mode is not allowed for your role',
      },
      403,
    );
  }

  const context = await buildModeContext({
    user,
    mode: resolvedMode,
    entityId: payload.entityId,
    draft: payload.draft,
  });

  const suggestedActions = buildSuggestedActions({
    mode: resolvedMode,
    role: user.role,
    context,
  });

  const navIntentAction = detectNavigationIntent(payload.message, user.role);
  const identityAction = buildIdentityAction({
    message: payload.message,
    role: user.role,
    user,
    context,
  });

  const withNavigation = prependSuggestedAction(suggestedActions, navIntentAction);
  const finalSuggestedActions = prependSuggestedAction(withNavigation, identityAction);

  const apiKey = getOpenRouterApiKey();

  if (!apiKey) {
    const fallback = buildFallbackAssistantText({
      mode: resolvedMode,
      locale,
      actions: finalSuggestedActions,
      context,
    });

    return c.json({
      rawText: ensureActionBlock(fallback, finalSuggestedActions),
      locale,
      languageTag: locale === 'ur' ? 'ur-PK' : 'en-US',
      mode: resolvedMode,
      provider: 'fallback',
      model: 'fallback-local',
    });
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: buildSystemPrompt(resolvedMode, locale, 'voice'),
    },
    ...normalizeHistory(payload.history).map((item) => ({
      role: item.role,
      content: item.content,
    })),
    {
      role: 'user',
      content: buildPromptPayload({
        user,
        mode: resolvedMode,
        locale,
        message: payload.message,
        context,
        actions: finalSuggestedActions,
        threadSummary: payload.threadSummary,
        confirmAction: payload.confirmAction,
      }),
    },
  ];

  const modelCandidates = preferredAiModels();

  let responseText = '';
  let selectedModel = modelCandidates[0] ?? AI_DEFAULT_MODEL;
  let lastModelError: string | null = null;

  for (const modelCandidate of modelCandidates) {
    selectedModel = modelCandidate;

    const candidateResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelCandidate,
        stream: false,
        temperature: 0.2,
        messages,
      }),
    });

    if (candidateResponse.ok) {
      const parsed = (await candidateResponse.json()) as Record<string, unknown>;
      responseText = extractCompletionText(parsed);
      break;
    }

    const errorText = await candidateResponse.text();
    lastModelError = `model=${modelCandidate}; status=${candidateResponse.status}; ${shortText(
      errorText,
      220,
    )}`;

    const noEndpointFound =
      candidateResponse.status === 404 && /no endpoints found/i.test(errorText);

    const shouldRetry =
      noEndpointFound ||
      candidateResponse.status === 429 ||
      (candidateResponse.status >= 500 && candidateResponse.status <= 599);

    if (!shouldRetry) {
      break;
    }
  }

  const rawText =
    responseText.trim().length > 0
      ? ensureActionBlock(responseText, finalSuggestedActions)
      : buildFallbackAssistantText({
          mode: resolvedMode,
          locale,
          actions: finalSuggestedActions,
          context,
          modelError: lastModelError,
        });

  return c.json({
    rawText,
    locale,
    languageTag: locale === 'ur' ? 'ur-PK' : 'en-US',
    mode: resolvedMode,
    provider: responseText.trim().length > 0 ? 'openrouter' : 'fallback',
    model: responseText.trim().length > 0 ? selectedModel : 'fallback-local',
  });
};

export const voiceSpeakHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = (c.req as unknown as { valid: (target: 'json') => AiVoiceSpeakRequest }).valid(
    'json',
  );

  const locale = resolveLocale(payload.locale);
  const languageTag = locale === 'ur' ? 'ur-PK' : 'en-US';
  const speechText = shortText(payload.text, 1800);

  return c.json({
    locale,
    languageTag,
    text: speechText,
    speechText,
    voiceHint: locale === 'ur' ? 'urdu' : 'english',
  });
};
