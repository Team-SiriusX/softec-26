'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

import { SiriOrb } from '@/components/ui/siri-orb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Locale = 'en' | 'ur';

type Confidence = 'high' | 'medium' | 'low';

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

function getFriendlyError(locale: Locale): string {
  return locale === 'ur'
    ? 'آڈیو بھیجنے میں مسئلہ آیا۔ دوبارہ کوشش کریں۔'
    : 'There was a problem processing your voice. Please try again.';
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const asRecord = payload as Record<string, unknown>;

  if (typeof asRecord.message === 'string' && asRecord.message.length > 0) {
    return asRecord.message;
  }

  if (typeof asRecord.detail === 'string' && asRecord.detail.length > 0) {
    return asRecord.detail;
  }

  return null;
}

export default function VoiceOrbAgent() {
  const [locale, setLocale] = useState<Locale>('en');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const sendVoiceQuery = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError(null);

    try {
      const fileType = audioBlob.type || 'audio/webm';
      const extension = fileType.includes('mpeg') ? 'mp3' : 'webm';
      const file = new File([audioBlob], `voice.${extension}`, { type: fileType });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('locale', locale);

      const apiResponse = await fetch('/api/advisor/voice/query', {
        method: 'POST',
        body: formData,
      });

      if (!apiResponse.ok) {
        const contentType = apiResponse.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const errorPayload = (await apiResponse.json()) as unknown;
          const message = extractErrorMessage(errorPayload);
          throw new Error(message || `Voice request failed with status ${apiResponse.status}`);
        }

        const errorText = await apiResponse.text();
        throw new Error(errorText || `Voice request failed with status ${apiResponse.status}`);
      }

      const payload = (await apiResponse.json()) as QueryResponse;
      setResponse(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : getFriendlyError(locale);
      setError(message || getFriendlyError(locale));
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    if (isProcessing || isRecording) {
      return;
    }

    setError(null);
    setResponse(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || 'audio/webm',
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (audioBlob.size > 0) {
          void sendVoiceQuery(audioBlob);
        } else {
          setError(
            locale === 'ur'
              ? 'آڈیو ریکارڈ نہیں ہوئی۔ تھوڑا زیادہ بول کر دوبارہ کوشش کریں۔'
              : 'No audio was captured. Please speak a bit longer and try again.',
          );
        }
      };

      recorder.start(250);
      setIsRecording(true);
    } catch {
      setError(
        locale === 'ur'
          ? 'مائیکروفون تک رسائی نہیں ملی۔ براہ کرم اجازت دیں۔'
          : 'Microphone access was denied. Please allow microphone access.',
      );
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const onOrbClick = () => {
    if (isProcessing) {
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    void startRecording();
  };

  return (
    <Card className='border-border/60 bg-card/95'>
      <CardHeader className='space-y-3'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <CardTitle className='text-xl'>Voice Saathi</CardTitle>
            <CardDescription>
              {locale === 'ur'
                ? 'رکارڈ کرنے کے لئے Orb پر کلک کریں، دوبارہ کلک سے روکیں۔'
                : 'Click the orb to record, click again to stop and send.'}
            </CardDescription>
          </div>
          <Badge variant='secondary'>{isRecording ? 'Recording' : 'Ready'}</Badge>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            type='button'
            size='sm'
            variant={locale === 'en' ? 'default' : 'outline'}
            onClick={() => setLocale('en')}
          >
            EN
          </Button>
          <Button
            type='button'
            size='sm'
            variant={locale === 'ur' ? 'default' : 'outline'}
            onClick={() => setLocale('ur')}
          >
            اردو
          </Button>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col items-center gap-6'>
        <button
          type='button'
          onClick={onOrbClick}
          disabled={isProcessing}
          aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
          className={cn(
            'relative rounded-full p-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isRecording ? 'scale-[1.03]' : 'hover:scale-[1.02]',
            isProcessing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
          )}
        >
          <SiriOrb
            size='220px'
            animationDuration={isRecording ? 7 : 16}
            className={cn(
              'drop-shadow-2xl',
              isRecording ? 'ring-2 ring-red-500/60 ring-offset-4 ring-offset-background' : '',
            )}
          />
          <span className='bg-background/80 absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full border backdrop-blur-sm'>
            {isProcessing ? (
              <Loader2 className='size-6 animate-spin' />
            ) : isRecording ? (
              <Square className='size-5 fill-current' />
            ) : (
              <Mic className='size-6' />
            )}
          </span>
        </button>

        <p className='text-muted-foreground text-center text-sm'>
          {isProcessing
            ? locale === 'ur'
              ? 'آواز پروسیس کی جا رہی ہے...'
              : 'Processing your voice...'
            : isRecording
              ? locale === 'ur'
                ? 'اب بات کریں، مکمل ہونے پر دوبارہ Orb پر کلک کریں۔'
                : 'Speak now, then click the orb again to stop.'
              : locale === 'ur'
                ? 'شروع کرنے کے لئے Orb دبائیں۔'
                : 'Tap the orb to start speaking.'}
        </p>

        {error ? (
          <div className='w-full rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300'>
            {error}
          </div>
        ) : null}

        {response ? (
          <div className='bg-muted/40 w-full space-y-3 rounded-xl border p-4'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-sm font-medium'>{response.answer}</p>
              <Badge variant='outline' className='capitalize'>
                {response.confidence}
              </Badge>
            </div>

            {response.evidence.length > 0 ? (
              <div className='flex flex-wrap gap-2'>
                {response.evidence.map((item, index) => (
                  <Badge key={`${item.label}-${index}`} variant='secondary'>
                    {item.label}
                  </Badge>
                ))}
              </div>
            ) : null}

            {response.caution ? (
              <p className='text-muted-foreground text-xs'>{response.caution}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
