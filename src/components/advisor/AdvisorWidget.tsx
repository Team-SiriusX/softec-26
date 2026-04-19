'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { client } from '@/lib/hono';
import { cn } from '@/lib/utils';

type Confidence = 'high' | 'medium' | 'low';
type Locale = 'en' | 'ur';

type QueryEvidence = {
  type: 'shift_data' | 'anomaly_flag' | 'city_median' | 'policy_doc';
  label: string;
  value: string;
};

type QueryAction = {
  label: string;
  action_type:
    | 'review_shifts'
    | 'file_grievance'
    | 'generate_certificate'
    | 'contact_advocate';
  route: string;
};

type QueryResponse = {
  answer: string;
  evidence: QueryEvidence[];
  confidence: Confidence;
  next_actions: QueryAction[];
  caution: string;
  locale: string;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  metadata?: QueryResponse;
};

type AdvisorWidgetProps = {
  mode?: 'floating' | 'page';
};

const CONFIDENCE_DOT_CLASS: Record<Confidence, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
};

function buildFallbackResponse(locale: Locale): QueryResponse {
  if (locale === 'ur') {
    return {
      answer:
        'معذرت، ابھی جواب تیار نہیں ہو سکا۔ براہ کرم سوال دوبارہ واضح انداز میں لکھیں۔',
      evidence: [],
      confidence: 'low',
      next_actions: [],
      caution: 'اگر مسئلہ برقرار رہے تو گریوینس فلو کے ذریعے معاون سے رابطہ کریں۔',
      locale,
    };
  }

  return {
    answer:
      'Sorry, I could not prepare a reliable answer right now. Please rephrase your question.',
    evidence: [],
    confidence: 'low',
    next_actions: [],
    caution:
      'If this keeps happening, use the grievance flow to contact an advocate.',
    locale,
  };
}

function AssistantMessage({
  message,
  onAction,
}: {
  message: ChatMessage;
  onAction: (route: string) => void;
}) {
  const metadata = message.metadata;

  if (!metadata) {
    return (
      <div className='bg-muted/50 rounded-2xl border p-3'>
        <p className='text-sm leading-relaxed'>{message.content}</p>
      </div>
    );
  }

  return (
    <div className='bg-muted/50 rounded-2xl border p-3'>
      <div className='mb-2 flex items-center justify-between gap-2'>
        <p className='text-sm leading-relaxed font-medium'>{metadata.answer}</p>
        <span className='inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs capitalize'>
          <span
            className={cn(
              'size-2 rounded-full',
              CONFIDENCE_DOT_CLASS[metadata.confidence],
            )}
          />
          {metadata.confidence}
        </span>
      </div>

      {metadata.evidence.length > 0 ? (
        <div className='mb-2'>
          <p className='text-muted-foreground mb-1 text-xs font-medium'>Evidence</p>
          <div className='flex flex-wrap gap-1'>
            {metadata.evidence.map((item, index) => (
              <Badge key={`${item.label}-${index}`} variant='outline' className='text-[11px]'>
                {item.label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {metadata.next_actions.length > 0 ? (
        <div className='mb-2'>
          <p className='text-muted-foreground mb-1 text-xs font-medium'>Next actions</p>
          <div className='flex flex-wrap gap-2'>
            {metadata.next_actions.map((action, index) => (
              <Button
                key={`${action.route}-${index}`}
                type='button'
                size='xs'
                variant='secondary'
                onClick={() => onAction(action.route)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <p className='text-muted-foreground text-xs'>{metadata.caution}</p>
    </div>
  );
}

export default function AdvisorWidget({ mode = 'floating' }: AdvisorWidgetProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isFloating = mode === 'floating';

  const [isOpen, setIsOpen] = useState(!isFloating);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [locale, setLocale] = useState<Locale>('en');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const placeholder = useMemo(
    () =>
      locale === 'ur'
        ? 'اپنا سوال لکھیں...'
        : 'Ask about earnings, anomalies, or actions...',
    [locale],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const onSend = async () => {
    const query = input.trim();

    if (!query || isLoading) {
      return;
    }

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setIsLoading(true);

    try {
      const response = await client.api.advisor.query.$post({
        json: {
          query,
          locale,
        },
      });

      if (!response.ok) {
        throw new Error(`Advisor request failed (${response.status})`);
      }

      const payload = (await response.json()) as QueryResponse;

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: payload.answer,
          metadata: payload,
        },
      ]);
    } catch {
      const fallback = buildFallbackResponse(locale);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: fallback.answer,
          metadata: fallback,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        isFloating
          ? 'fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3'
          : 'w-full',
      )}
    >
      {isOpen ? (
        <Card
          className={cn(
            'flex flex-col',
            isFloating
              ? 'h-[500px] w-[400px] max-w-[calc(100vw-2rem)] shadow-xl'
              : 'h-[min(72vh,680px)] w-full shadow-sm',
          )}
        >
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between gap-2'>
              <div>
                <CardTitle className='text-base'>FairGig Saathi</CardTitle>
                <CardDescription className='text-xs'>
                  Chat support for worker decisions
                </CardDescription>
              </div>
              <Badge variant='secondary'>AI-powered</Badge>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                size='xs'
                variant={locale === 'en' ? 'default' : 'outline'}
                onClick={() => setLocale('en')}
              >
                EN
              </Button>
              <Button
                type='button'
                size='xs'
                variant={locale === 'ur' ? 'default' : 'outline'}
                onClick={() => setLocale('ur')}
              >
                اردو
              </Button>
            </div>
          </CardHeader>

          <CardContent className='flex min-h-0 flex-1 flex-col gap-3'>
            <ScrollArea className='bg-muted/20 flex-1 rounded-2xl border p-3'>
              <div className='flex flex-col gap-3'>
                {messages.length === 0 ? (
                  <div className='text-muted-foreground rounded-2xl border border-dashed p-3 text-sm'>
                    {locale === 'ur'
                      ? 'سلام! میں آپ کی کمائی، کٹوتیوں اور اگلے اقدامات میں رہنمائی کر سکتا ہوں۔'
                      : 'Hi! I can help you understand earnings, deductions, and next best actions.'}
                  </div>
                ) : null}

                {messages.map((message, index) => {
                  if (message.role === 'assistant') {
                    return (
                      <AssistantMessage
                        key={`assistant-${index}`}
                        message={message}
                        onAction={(route) => router.push(route)}
                      />
                    );
                  }

                  return (
                    <div
                      key={`user-${index}`}
                      className='bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-2xl px-3 py-2 text-sm'
                    >
                      {message.content}
                    </div>
                  );
                })}

                {isLoading ? (
                  <div className='bg-muted/50 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm'>
                    <AlertCircle className='size-3.5 animate-pulse' />
                    {locale === 'ur' ? 'جواب تیار کیا جا رہا ہے...' : 'Preparing answer...'}
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void onSend();
              }}
              className='flex items-center gap-2'
            >
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={placeholder}
                disabled={isLoading}
              />
              <Button type='submit' size='sm' disabled={isLoading || input.trim().length === 0}>
                {locale === 'ur' ? 'بھیجیں' : 'Send'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {isFloating ? (
        <Button
          type='button'
          size='lg'
          className='rounded-full shadow-lg'
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <Sparkles data-icon='inline-start' />
          Saathi
        </Button>
      ) : null}
    </div>
  );
}
