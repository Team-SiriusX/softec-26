export type AiChatMode =
  | 'auto'
  | 'worker_evidence'
  | 'worker_recovery'
  | 'post_quality'
  | 'advocate_triage'
  | 'weekly_brief';

export type AiLocale = 'en' | 'ur';

export type AiAction = {
  id?: string;
  type: string;
  label: string;
  route?: string;
  requiresConfirmation?: boolean;
  payload?: Record<string, unknown>;
};

export type AiScores = {
  clarity?: number;
  evidenceCompleteness?: number;
  toneRisk?: number;
  trustOutcome?: number;
};

export type AiRewrite = {
  title?: string;
  body?: string;
};

export type AiStructuredPayload = {
  actions?: AiAction[];
  scores?: AiScores;
  rewrite?: AiRewrite;
  [key: string]: unknown;
};

export type AiChatRequestPayload = {
  mode: AiChatMode;
  message: string;
  locale?: AiLocale;
  entityId?: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  threadSummary?: string;
  draft?: {
    title?: string;
    body?: string;
    platformId?: string;
    media?: Array<{
      url?: string;
      mediaType?: string;
    }>;
  };
  confirmAction?: {
    id?: string;
    type: string;
    label?: string;
    route?: string;
    payload?: Record<string, unknown>;
    confirmed?: boolean;
  };
};

export const AI_ACTIONS_START = '[[AI_ACTIONS_JSON]]';
export const AI_ACTIONS_END = '[[/AI_ACTIONS_JSON]]';
export const AI_COMMUNITY_REWRITE_STORAGE_KEY = 'ai:worker:community-rewrite-draft';

function toStructuredPayload(parsed: unknown): AiStructuredPayload | null {
  if (Array.isArray(parsed)) {
    const firstObject = parsed.find(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
    );

    if (!firstObject) {
      return null;
    }

    return toStructuredPayload(firstObject);
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const object = parsed as Record<string, unknown>;

  return {
    ...object,
    actions: normalizeActionArray(object.actions),
    scores:
      object.scores && typeof object.scores === 'object'
        ? (object.scores as AiScores)
        : undefined,
    rewrite:
      object.rewrite && typeof object.rewrite === 'object'
        ? (object.rewrite as AiRewrite)
        : undefined,
  };
}

function extractFirstJsonCandidate(raw: string): string | null {
  const startIndex = raw.search(/[\[{]/);

  if (startIndex < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === '\\') {
        escaping = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === '}' || char === ']') {
      depth -= 1;

      if (depth === 0) {
        return raw.slice(startIndex, index + 1).trim();
      }
    }
  }

  return raw.slice(startIndex).trim();
}

function normalizeActionArray(value: unknown): AiAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => {
      return Boolean(item && typeof item === 'object');
    })
    .map((item) => {
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      const type = typeof item.type === 'string' ? item.type.trim() : '';

      return {
        id: typeof item.id === 'string' ? item.id : undefined,
        label,
        type,
        route: typeof item.route === 'string' ? item.route : undefined,
        requiresConfirmation:
          typeof item.requiresConfirmation === 'boolean'
            ? item.requiresConfirmation
            : false,
        payload:
          item.payload && typeof item.payload === 'object'
            ? (item.payload as Record<string, unknown>)
            : undefined,
      } satisfies AiAction;
    })
    .filter((item) => item.label.length > 0 && item.type.length > 0);
}

function parseStructuredJson(raw: string): AiStructuredPayload | null {
  const candidates = [raw.trim(), extractFirstJsonCandidate(raw.trim())].filter(
    (candidate, index, all): candidate is string => Boolean(candidate) && all.indexOf(candidate) === index,
  );

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const structured = toStructuredPayload(parsed);

      if (structured) {
        return structured;
      }
    } catch {
      // Continue with the next candidate.
    }
  }

  return null;
}

export function extractAiStructuredPayload(content: string): {
  cleanText: string;
  structured: AiStructuredPayload | null;
} {
  const start = content.indexOf(AI_ACTIONS_START);
  const end = content.indexOf(AI_ACTIONS_END);

  if (start >= 0) {
    const hasEndMarker = end > start;
    const rawJson = hasEndMarker
      ? content.slice(start + AI_ACTIONS_START.length, end).trim()
      : content.slice(start + AI_ACTIONS_START.length).trim();

    const structured = parseStructuredJson(rawJson);
    const prefix = content.slice(0, start).trim();
    const suffix = hasEndMarker
      ? content.slice(end + AI_ACTIONS_END.length).trim()
      : '';
    const cleanText = [prefix, suffix].filter(Boolean).join('\n').trim();

    return {
      cleanText,
      structured,
    };
  }

  const jsonFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (jsonFenceMatch) {
    const structured = parseStructuredJson(jsonFenceMatch[1].trim());

    if (structured) {
      const cleanText = content.replace(jsonFenceMatch[0], '').trim();

      return {
        cleanText,
        structured,
      };
    }
  }

  return {
    cleanText: content.trim(),
    structured: null,
  };
}

export async function streamAiChat(params: {
  payload: AiChatRequestPayload;
  signal?: AbortSignal;
  onToken?: (token: string, fullText: string) => void;
}): Promise<{
  rawText: string;
  cleanText: string;
  structured: AiStructuredPayload | null;
}> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params.payload,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to stream AI response');
  }

  if (!response.body) {
    throw new Error('AI response stream is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let done = false;
  let buffer = '';
  let rawText = '';

  while (!done) {
    const chunk = await reader.read();

    done = chunk.done;

    if (chunk.value) {
      buffer += decoder.decode(chunk.value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }

        const payload = trimmed.slice(5).trim();

        if (!payload || payload === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: {
                content?: string | Array<{ text?: string }>;
              };
            }>;
          };

          const delta = parsed.choices?.[0]?.delta?.content;

          let token = '';

          if (typeof delta === 'string') {
            token = delta;
          } else if (Array.isArray(delta)) {
            token = delta
              .map((item) => (typeof item?.text === 'string' ? item.text : ''))
              .join('');
          }

          if (token) {
            rawText += token;
            params.onToken?.(token, rawText);
          }
        } catch {
          // Ignore non-JSON stream control lines.
        }
      }
    }
  }

  const { cleanText, structured } = extractAiStructuredPayload(rawText);

  return {
    rawText,
    cleanText,
    structured,
  };
}

export async function queryAiVoice(params: {
  payload: AiChatRequestPayload;
  signal?: AbortSignal;
}): Promise<{
  rawText: string;
  cleanText: string;
  structured: AiStructuredPayload | null;
  locale: AiLocale;
  languageTag: string;
}> {
  const response = await fetch('/api/ai/voice/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.payload),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to run voice AI query');
  }

  const payload = (await response.json()) as {
    rawText?: string;
    locale?: AiLocale;
    languageTag?: string;
  };

  const rawText = typeof payload.rawText === 'string' ? payload.rawText : '';
  const { cleanText, structured } = extractAiStructuredPayload(rawText);

  return {
    rawText,
    cleanText,
    structured,
    locale: payload.locale === 'ur' ? 'ur' : 'en',
    languageTag:
      typeof payload.languageTag === 'string' && payload.languageTag.trim()
        ? payload.languageTag
        : payload.locale === 'ur'
          ? 'ur-PK'
          : 'en-US',
  };
}

export async function prepareAiVoiceSpeech(params: {
  text: string;
  locale: AiLocale;
  signal?: AbortSignal;
}): Promise<{
  speechText: string;
  locale: AiLocale;
  languageTag: string;
}> {
  const response = await fetch('/api/ai/voice/speak', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: params.text,
      locale: params.locale,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to prepare AI voice speech');
  }

  const payload = (await response.json()) as {
    speechText?: string;
    text?: string;
    locale?: AiLocale;
    languageTag?: string;
  };

  const speechText =
    typeof payload.speechText === 'string' && payload.speechText.trim().length > 0
      ? payload.speechText
      : typeof payload.text === 'string'
        ? payload.text
        : params.text;

  return {
    speechText,
    locale: payload.locale === 'ur' ? 'ur' : 'en',
    languageTag:
      typeof payload.languageTag === 'string' && payload.languageTag.trim()
        ? payload.languageTag
        : params.locale === 'ur'
          ? 'ur-PK'
          : 'en-US',
  };
}
