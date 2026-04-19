'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot,
  ChevronDown,
  Loader2,
  MessageCircle,
  Mic,
  Send,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MarkdownRenderer } from '@/components/ui/markdown';
import { useCreateGrievance } from '@/hooks/use-grievances';
import {
  type AiAction,
  type AiChatMode,
  type AiLocale,
  AI_COMMUNITY_REWRITE_STORAGE_KEY,
  prepareAiVoiceSpeech,
  queryAiVoice,
  type AiRewrite,
  type AiStructuredPayload,
  streamAiChat,
} from '@/lib/ai-assistant';
import { cn } from '@/lib/utils';

type AdvisorMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  structured?: AiStructuredPayload | null;
};

type QuickPrompt = {
  label: string;
  mode: AiChatMode;
  message: string;
};

type WorkerRouteIntent = {
  route: string;
  label: string;
  patterns: RegExp[];
};

type SpeechRecognitionResultEventLike = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtorLike = new () => SpeechRecognitionLike;

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: 'Why was I flagged?',
    mode: 'worker_evidence',
    message: 'Why was my latest shift flagged and what should I do now?',
  },
  {
    label: 'Help me recover income',
    mode: 'worker_recovery',
    message: 'Help me recover income drop and prepare strongest evidence.',
  },
  {
    label: 'Draft grievance',
    mode: 'worker_recovery',
    message: 'Draft a grievance from my recent anomalies and evidence.',
  },
  {
    label: 'Who am I?',
    mode: 'auto',
    message: 'Who am I? Show my account details and role.',
  },
];

const WORKER_ROUTE_INTENTS: WorkerRouteIntent[] = [
  {
    route: '/worker/anomaly-detection',
    label: 'Anomaly Detection',
    patterns: [
      /\banomal(?:y|ies)\b/,
      /\banamoly\b/,
      /\banomoly\b/,
      /\banamaly\b/,
      /\banomly\b/,
    ],
  },
  {
    route: '/worker/my-shift-logs',
    label: 'My Shift Logs',
    patterns: [/\bmy\s+shift\s*logs?\b/, /\bshift\s*logs?\b/, /\bshift\s*history\b/],
  },
  {
    route: '/worker/log-shift',
    label: 'Log Shift',
    patterns: [/\blog\s+shift\b/, /\bsubmit\s+shift\b/],
  },
  {
    route: '/worker/community-feed',
    label: 'Community Feed',
    patterns: [/\bcommunity\s*(?:feed|board|post)\b/],
  },
  {
    route: '/worker/grievances',
    label: 'Grievance Board',
    patterns: [/\bgrievance(?:s|\s+board)?\b/, /\bcomplaint\s*board\b/],
  },
  {
    route: '/worker/earnings',
    label: 'Earnings',
    patterns: [/\bearnings?\b/, /\bincome\s*history\b/, /\bpayout\s*history\b/],
  },
  {
    route: '/worker/certificate',
    label: 'Certificate',
    patterns: [
      /\bcertificate\b/,
      /\bcertificates\b/,
      /\bmy\s+certificate\b/,
      /\bverification\s+certificate\b/,
    ],
  },
  {
    route: '/worker/profile',
    label: 'Profile',
    patterns: [/\bprofile\b/, /\bmy\s+account\b/, /\bmy\s+details\b/],
  },
  {
    route: '/worker/dashboard',
    label: 'Dashboard',
    patterns: [/\bdashboard\b/, /\bhome\b/],
  },
];

const DEFAULT_GREETING =
  'Ask me to navigate, explain flagged shifts, or run recovery actions with confirmation.';

const LOCALE_CONFIG: Record<
  AiLocale,
  {
    label: string;
    recognitionLang: string;
    speechLang: string;
    placeholder: string;
    unsupportedSpeech: string;
    unsupportedMic: string;
  }
> = {
  en: {
    label: 'EN',
    recognitionLang: 'en-US',
    speechLang: 'en-US',
    placeholder: 'Ask about flagged shift, recovery, grievance...',
    unsupportedSpeech: 'Speech output is not supported in this browser.',
    unsupportedMic: 'Voice input is not supported in this browser.',
  },
  ur: {
    label: 'اردو',
    recognitionLang: 'ur-PK',
    speechLang: 'ur-PK',
    placeholder: 'اپنا سوال لکھیں یا مائیک سے بولیں...',
    unsupportedSpeech: 'اس براؤزر میں وائس آؤٹ پٹ دستیاب نہیں ہے۔',
    unsupportedMic: 'اس براؤزر میں وائس اِن پٹ دستیاب نہیں ہے۔',
  },
};

const URDU_SCRIPT_REGEX = /[\u0600-\u06FF]/;

function getSpeechRecognitionCtor(): SpeechRecognitionCtorLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtorLike;
    webkitSpeechRecognition?: SpeechRecognitionCtorLike;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function detectSpeechLocaleFromText(text: string, fallback: AiLocale): AiLocale {
  if (URDU_SCRIPT_REGEX.test(text)) {
    return 'ur';
  }

  return fallback;
}

function pickVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  languageTag: string,
): SpeechSynthesisVoice | null {
  const normalizedTag = languageTag.toLowerCase();
  const langPrefix = normalizedTag.split('-')[0] ?? normalizedTag;

  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalizedTag) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${langPrefix}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix)) ??
    null
  );
}

function getSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();

  if (immediate.length > 0) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(synth.getVoices());
    }, 350);

    const handleVoicesChanged = () => {
      window.clearTimeout(timeoutId);
      synth.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(synth.getVoices());
    };

    synth.addEventListener('voiceschanged', handleVoicesChanged);
  });
}

function toHistory(messages: AdvisorMessage[]) {
  return messages
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));
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

function isAffirmativeReply(text: string): boolean {
  return /^(yes|yes\s+confirmed?|confirmed?\s+yes|yep|yeah|sure|ok|okay|go\s+ahead|do\s+it|proceed|please\s+proceed|confirm|confirm\s+it|please\s+do)$/i.test(
    text.trim(),
  );
}

function resolveWorkerRouteIntent(message: string): WorkerRouteIntent | null {
  const text = normalizeIntentText(message);
  const shouldNavigate = hasNavigationLanguage(text) || looksLikeRouteOnlyRequest(text);

  if (!shouldNavigate) {
    return null;
  }

  for (const intent of WORKER_ROUTE_INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(text))) {
      return intent;
    }
  }

  return null;
}

function getLatestActionForConfirmation(
  messages: AdvisorMessage[],
): { action: AiAction; rewrite: AiRewrite | null } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (item.role !== 'assistant') {
      continue;
    }

    const actions = item.structured?.actions ?? [];
    if (!actions.length) {
      const guidedMatch = /open\s+log\s+shift\s+with\s+ai\s+guidance|guided\s+log\s+shift/i.test(
        item.text,
      );

      if (guidedMatch) {
        return {
          action: {
            id: 'derived_open_shift_log_guided',
            type: 'OPEN_SHIFT_LOG_WITH_GUIDANCE',
            label: 'Open Log Shift With AI Guidance',
            route: '/worker/log-shift?guided=1&source=ai_advisor',
          },
          rewrite: null,
        };
      }

      const derivedRouteIntent = resolveWorkerRouteIntent(item.text);
      if (derivedRouteIntent) {
        return {
          action: {
            id: `derived_nav_${derivedRouteIntent.label.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'NAVIGATE',
            label: `Open ${derivedRouteIntent.label}`,
            route: derivedRouteIntent.route,
          },
          rewrite: null,
        };
      }

      continue;
    }

    const action =
      actions.find((candidate) => candidate.requiresConfirmation) ??
      actions.find(
        (candidate) => candidate.type === 'NAVIGATE' || candidate.type.startsWith('OPEN_'),
      ) ??
      actions[0];

    if (!action) {
      continue;
    }

    return {
      action,
      rewrite: item.structured?.rewrite ?? null,
    };
  }

  return null;
}

function deriveActionsFromAssistantText(text: string): AiAction[] {
  const actions: AiAction[] = [];
  const normalized = normalizeIntentText(text);

  if (
    /open\s+log\s+shift\s+with\s+ai\s+guidance|guided\s+log\s+shift/.test(normalized)
  ) {
    actions.push({
      id: 'derived_open_shift_log_guided',
      type: 'OPEN_SHIFT_LOG_WITH_GUIDANCE',
      label: 'Open Log Shift With AI Guidance',
      route: '/worker/log-shift?guided=1&source=ai_advisor',
    });
  }

  const routeIntent = resolveWorkerRouteIntent(text);
  if (routeIntent) {
    actions.push({
      id: `derived_nav_${routeIntent.label.toLowerCase().replace(/\s+/g, '_')}`,
      type: 'NAVIGATE',
      label: `Open ${routeIntent.label}`,
      route: routeIntent.route,
    });
  }

  return actions;
}

export default function AiAdvisor() {
  const router = useRouter();
  const grievanceMutation = useCreateGrievance();

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mode, setMode] = useState<AiChatMode>('auto');
  const [locale, setLocale] = useState<AiLocale>('en');
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      id: createId('assistant'),
      role: 'assistant',
      text: DEFAULT_GREETING,
      structured: {
        actions: [
          {
            id: 'nav_shift_logs',
            type: 'NAVIGATE',
            label: 'Open My Shift Logs',
            route: '/worker/my-shift-logs',
          },
          {
            id: 'nav_anomaly',
            type: 'NAVIGATE',
            label: 'Open Anomaly Detection',
            route: '/worker/anomaly-detection',
          },
        ],
      },
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isPinnedToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(messages.length);

  const visibleMessages = useMemo(() => messages.slice(-20), [messages]);
  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  const localeConfig = LOCALE_CONFIG[locale];

  useEffect(() => {
    if (!isOpen || isCollapsed) {
      return;
    }

    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    const nextCount = messages.length;
    const wasNewMessageAdded = nextCount > previousMessageCountRef.current;
    previousMessageCountRef.current = nextCount;

    if (!isPinnedToBottomRef.current && !wasNewMessageAdded) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: wasNewMessageAdded ? 'smooth' : 'auto',
    });
  }, [messages, isOpen, isCollapsed]);

  useEffect(() => {
    if (isOpen && !isCollapsed) {
      isPinnedToBottomRef.current = true;
    }
  }, [isOpen, isCollapsed]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      speechAbortRef.current?.abort();

      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const runPrompt = async (params: {
    mode: AiChatMode;
    message: string;
    confirmAction?: {
      id?: string;
      type: string;
      label?: string;
      route?: string;
      payload?: Record<string, unknown>;
      confirmed?: boolean;
    };
  }) => {
    const userMessage: AdvisorMessage = {
      id: createId('user'),
      role: 'user',
      text: params.message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantId = createId('assistant');
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        text: '...',
      },
    ]);

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await streamAiChat({
        payload: {
          mode: params.mode,
          message: params.message,
          locale,
          history: toHistory(visibleMessages),
          confirmAction: params.confirmAction,
        },
        signal: controller.signal,
        onToken: (_, fullText) => {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    text: fullText,
                  }
                : item,
            ),
          );
        },
      });

      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? (() => {
                const fallbackActions =
                  result.structured?.actions && result.structured.actions.length > 0
                    ? result.structured.actions
                    : deriveActionsFromAssistantText(result.cleanText || '');

                return {
                  ...item,
                  text: result.cleanText || 'No response generated.',
                  structured:
                    result.structured || fallbackActions.length
                      ? {
                          ...(result.structured ?? {}),
                          actions: fallbackActions,
                        }
                      : null,
                };
              })()
            : item,
        ),
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text:
                  error instanceof Error && error.message
                    ? `I hit an error: ${error.message}`
                    : 'I hit an error while generating a response.',
              }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const speakText = async (text: string) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error(localeConfig.unsupportedSpeech);
      return;
    }

    speechAbortRef.current?.abort();
    const controller = new AbortController();
    speechAbortRef.current = controller;
    const speechLocale = detectSpeechLocaleFromText(trimmed, locale);
    const speechLocaleConfig = LOCALE_CONFIG[speechLocale];

    setIsSpeaking(true);

    try {
      const speech = await prepareAiVoiceSpeech({
        text: trimmed,
        locale: speechLocale,
        signal: controller.signal,
      });

      const utterance = new SpeechSynthesisUtterance(speech.speechText);
      utterance.lang = speech.languageTag || speechLocaleConfig.speechLang;

      const voices = await getSpeechVoices();
      const voice =
        pickVoiceForLanguage(voices, utterance.lang) ??
        pickVoiceForLanguage(voices, speechLocaleConfig.speechLang);

      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        toast.error(localeConfig.unsupportedSpeech);
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      setIsSpeaking(false);
      toast.error(error instanceof Error ? error.message : speechLocaleConfig.unsupportedSpeech);
    }
  };

  const runVoicePrompt = async (message: string) => {
    const prompt = message.trim();

    if (!prompt || isStreaming) {
      return;
    }

    const userMessage: AdvisorMessage = {
      id: createId('user'),
      role: 'user',
      text: prompt,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantId = createId('assistant');
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        text: locale === 'ur' ? 'جواب تیار کیا جا رہا ہے...' : 'Preparing response...',
      },
    ]);

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await queryAiVoice({
        payload: {
          mode,
          message: prompt,
          locale,
          history: toHistory(visibleMessages),
        },
        signal: controller.signal,
      });

      let finalText = '';

      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? (() => {
                const fallbackActions =
                  result.structured?.actions && result.structured.actions.length > 0
                    ? result.structured.actions
                    : deriveActionsFromAssistantText(result.cleanText || '');

                finalText = result.cleanText || 'No response generated.';

                return {
                  ...item,
                  text: finalText,
                  structured:
                    result.structured || fallbackActions.length
                      ? {
                          ...(result.structured ?? {}),
                          actions: fallbackActions,
                        }
                      : null,
                };
              })()
            : item,
        ),
      );

      if (finalText.trim()) {
        await speakText(finalText);
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text:
                  error instanceof Error && error.message
                    ? `I hit an error: ${error.message}`
                    : 'I hit an error while generating a response.',
              }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
      setIsListening(false);
    }
  };

  const startVoiceInput = () => {
    if (isStreaming || isListening) {
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();

    if (!SpeechRecognitionCtor) {
      toast.error(localeConfig.unsupportedMic);
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;
      recognition.lang = localeConfig.recognitionLang;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => {
            const firstAlternative = result[0];
            return typeof firstAlternative?.transcript === 'string'
              ? firstAlternative.transcript
              : '';
          })
          .join(' ')
          .trim();

        if (!transcript) {
          toast.error(locale === 'ur' ? 'آواز واضح نہیں ملی۔' : 'No clear voice input captured.');
          return;
        }

        setInput(transcript);
        void runVoicePrompt(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error(locale === 'ur' ? 'وائس اِن پٹ ناکام ہوئی۔' : 'Voice input failed.');
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      toast.error(localeConfig.unsupportedMic);
    }
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const handleSend = async () => {
    const message = input.trim();

    if (!message || isStreaming) {
      return;
    }

    const latestAction = getLatestActionForConfirmation(messages);
    if (latestAction && isAffirmativeReply(message)) {
      setInput('');
      await handleAction(latestAction.action, latestAction.rewrite);
      return;
    }

    const directNavIntent = resolveWorkerRouteIntent(message);
    if (directNavIntent) {
      setInput('');
      router.push(directNavIntent.route);
      setIsOpen(false);
      toast.success(`Opening ${directNavIntent.label}.`);
      return;
    }

    setInput('');
    await runPrompt({
      mode,
      message,
    });
  };

  const handleQuickPrompt = async (prompt: QuickPrompt) => {
    if (isStreaming) {
      return;
    }

    setMode(prompt.mode);
    await runPrompt({
      mode: prompt.mode,
      message: prompt.message,
    });
  };

  const submitDraftGrievance = async (action: AiAction) => {
    const payload = action.payload ?? {};

    const platformId =
      typeof payload.platformId === 'string' && payload.platformId.trim()
        ? payload.platformId.trim()
        : '';

    const category =
      typeof payload.category === 'string' && payload.category.trim()
        ? payload.category.trim()
        : 'PAYMENT_DISPUTE';

    const description =
      typeof payload.description === 'string' && payload.description.trim()
        ? payload.description.trim()
        : 'AI-assisted grievance draft from recovery flow.';

    if (!platformId) {
      toast.error('AI draft is missing platform. Please open Grievance Board and select platform.');
      router.push('/worker/grievances');
      return;
    }

    const shouldSubmit = window.confirm(
      'Submit this AI-drafted grievance now? You can edit details later in Grievance Board.',
    );

    if (!shouldSubmit) {
      return;
    }

    await grievanceMutation.mutateAsync({
      platformId,
      category: category as
        | 'COMMISSION_CHANGE'
        | 'ACCOUNT_DEACTIVATION'
        | 'PAYMENT_DISPUTE'
        | 'UNFAIR_RATING'
        | 'SAFETY_CONCERN'
        | 'OTHER',
      description,
      isAnonymous:
        typeof payload.isAnonymous === 'boolean' ? payload.isAnonymous : false,
    });

    await runPrompt({
      mode: 'worker_recovery',
      message: 'I confirmed and submitted the grievance draft.',
      confirmAction: {
        id: action.id,
        type: action.type,
        label: action.label,
        route: action.route,
        payload: action.payload,
        confirmed: true,
      },
    });
  };

  const handleAction = async (action: AiAction, rewrite?: AiRewrite | null) => {
    if (action.type === 'APPLY_REWRITE_TO_COMMUNITY_DRAFT' || action.type === 'APPLY_REWRITE') {
      const nextTitle = typeof rewrite?.title === 'string' ? rewrite.title.trim() : '';
      const nextBody = typeof rewrite?.body === 'string' ? rewrite.body.trim() : '';

      if (!nextTitle && !nextBody) {
        toast.error('No rewrite content found in this suggestion.');
        return;
      }

      window.localStorage.setItem(
        AI_COMMUNITY_REWRITE_STORAGE_KEY,
        JSON.stringify({
          title: nextTitle,
          body: nextBody,
          source: 'worker_ai_advisor',
          createdAt: new Date().toISOString(),
        }),
      );
      window.dispatchEvent(new Event('ai-rewrite-ready'));

      router.push(action.route || '/worker/community-feed?view=mine&compose=1&source=worker_ai');
      setIsOpen(false);
      toast.success('Rewrite moved to Community Feed composer.');
      return;
    }

    if (action.type === 'NAVIGATE' && action.route) {
      toast.success(`Opening ${action.label}.`);
      router.push(action.route);
      setIsOpen(false);
      return;
    }

    if (action.type === 'SHOW_MY_PROFILE') {
      const payload = action.payload ?? {};
      const fullName =
        typeof payload.fullName === 'string' && payload.fullName.trim()
          ? payload.fullName.trim()
          : typeof payload.name === 'string' && payload.name.trim()
            ? payload.name.trim()
            : 'Unknown User';
      const role = typeof payload.role === 'string' ? payload.role : 'Unknown Role';
      const email = typeof payload.email === 'string' ? payload.email : 'No email available';
      const cityZone = typeof payload.cityZone === 'string' ? payload.cityZone : null;
      const category = typeof payload.category === 'string' ? payload.category : null;

      const details = [
        `Name: ${fullName}`,
        `Role: ${role}`,
        `Email: ${email}`,
        cityZone ? `City: ${cityZone}` : null,
        category ? `Category: ${category}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join(' | ');

      toast.info(details);

      if (action.route) {
        router.push(action.route);
        setIsOpen(false);
      }
      return;
    }

    if (action.type === 'OPEN_SHIFT_LOG_WITH_GUIDANCE') {
      toast.success('Opening Log Shift with AI guidance.');
      router.push(action.route || '/worker/log-shift?guided=1&source=ai_advisor');
      setIsOpen(false);
      return;
    }

    if (action.type === 'DRAFT_GRIEVANCE') {
      try {
        await submitDraftGrievance(action);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to submit AI grievance draft',
        );
      }
      return;
    }

    if (action.route) {
      toast.success(`Opening ${action.label}.`);
      router.push(action.route);
      setIsOpen(false);
      return;
    }

    toast('Action ready', {
      description: 'This action can be wired to a specific endpoint in the next step.',
    });
  };

  if (!isOpen) {
    return (
      <button
        type='button'
        onClick={() => setIsOpen(true)}
        className='fixed bottom-5 right-5 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.01]'
      >
        <MessageCircle className='size-4' />
        AI Advisor
      </button>
    );
  }

  return (
    <div className='fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-1.5rem)]'>
      <Card className='border-border/70 shadow-2xl'>
        <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0 pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Bot className='size-4' />
            Worker AI Advisor
          </CardTitle>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-8'
              onClick={() => setIsCollapsed((prev) => !prev)}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', isCollapsed && 'rotate-180')}
              />
            </Button>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-8'
              onClick={() => setIsOpen(false)}
            >
              <X className='size-4' />
            </Button>
          </div>
        </CardHeader>

        {!isCollapsed ? (
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap gap-1.5'>
              {QUICK_PROMPTS.map((prompt) => (
                <Button
                  key={prompt.label}
                  type='button'
                  size='sm'
                  variant='secondary'
                  className='h-7 rounded-full px-2.5 text-[11px]'
                  disabled={isStreaming}
                  onClick={() => {
                    void handleQuickPrompt(prompt);
                  }}
                >
                  <Sparkles className='mr-1 size-3' />
                  {prompt.label}
                </Button>
              ))}
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                const distanceFromBottom =
                  element.scrollHeight - element.scrollTop - element.clientHeight;
                isPinnedToBottomRef.current = distanceFromBottom < 48;
              }}
              className='max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-2 pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/70 [&::-webkit-scrollbar-track]:bg-transparent'
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'rounded-lg px-2.5 py-2 text-sm',
                    message.role === 'user'
                      ? 'ml-8 bg-primary text-primary-foreground'
                      : 'mr-8 bg-card',
                  )}
                >
                  {message.role === 'assistant' ? (
                    <div>
                      <div className='mb-1 flex items-center justify-end'>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='size-6'
                          disabled={isSpeaking || !message.text.trim()}
                          onClick={() => {
                            void speakText(message.text);
                          }}
                        >
                          <Volume2 className='size-3.5' />
                        </Button>
                      </div>
                      <MarkdownRenderer content={message.text} className='text-sm' />
                      {isStreaming && lastMessageId === message.id ? (
                        <span className='inline-block animate-pulse text-xs text-muted-foreground'>
                          Streaming...
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className='whitespace-pre-wrap leading-relaxed'>{message.text}</p>
                  )}

                  {message.role === 'assistant' && message.structured?.actions?.length ? (
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                      {message.structured.actions.slice(0, 4).map((action) => (
                        <Button
                          key={`${message.id}-${action.id ?? action.label}`}
                          type='button'
                          size='sm'
                          variant='outline'
                          className='h-7 text-[11px]'
                          disabled={isStreaming || grievanceMutation.isPending}
                          onClick={() => {
                            void handleAction(action, message.structured?.rewrite ?? null);
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-1'>
                {(Object.keys(LOCALE_CONFIG) as AiLocale[]).map((itemLocale) => (
                  <Button
                    key={itemLocale}
                    type='button'
                    size='sm'
                    variant={locale === itemLocale ? 'secondary' : 'ghost'}
                    className='h-7 px-2 text-[11px]'
                    onClick={() => setLocale(itemLocale)}
                    disabled={isStreaming || isListening}
                  >
                    {LOCALE_CONFIG[itemLocale].label}
                  </Button>
                ))}
              </div>

              <Button
                type='button'
                size='sm'
                variant={isListening ? 'destructive' : 'outline'}
                className='h-7 gap-1.5 px-2 text-[11px]'
                disabled={isStreaming}
                onClick={() => {
                  if (isListening) {
                    stopVoiceInput();
                    return;
                  }
                  startVoiceInput();
                }}
              >
                {isListening ? <Square className='size-3.5' /> : <Mic className='size-3.5' />}
                {isListening ? (locale === 'ur' ? 'روکیں' : 'Stop') : locale === 'ur' ? 'وائس' : 'Voice'}
              </Button>
            </div>

            <div className='flex items-center gap-2'>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as AiChatMode)}
                className='h-9 rounded-md border border-border bg-background px-2 text-xs'
              >
                <option value='auto'>Auto</option>
                <option value='worker_evidence'>Evidence Coach</option>
                <option value='worker_recovery'>Recovery Flow</option>
                <option value='post_quality'>Post Quality</option>
              </select>
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={localeConfig.placeholder}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                type='button'
                size='icon'
                disabled={isStreaming || !input.trim()}
                onClick={() => {
                  void handleSend();
                }}
              >
                {isStreaming ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
              </Button>
            </div>

            <p className='text-[11px] text-muted-foreground'>
              Writes are confirmation-gated. Navigation actions open relevant pages directly.
              <Link href='/worker/grievances' className='ml-1 underline'>
                Grievance Board
              </Link>
            </p>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
