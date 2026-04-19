'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { type AiAction, streamAiChat } from '@/lib/ai-assistant';
import {
  type CommunityAiReviewResult,
  useCommunityModerationQueue,
  useRunAiReview,
  useSubmitHumanReview,
} from '@/hooks/use-community';
import { cn } from '@/lib/utils';

function renderModerationMediaPreview(media: {
  url: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}) {
  if (media.mediaType === 'VIDEO') {
    return (
      <video
        src={media.url}
        className='h-24 w-full object-cover'
        controls
        preload='metadata'
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.url}
      alt='Post evidence media'
      className='h-24 w-full object-cover'
      loading='lazy'
    />
  );
}

export default function CommunityModerationPage() {
  const router = useRouter();
  const [notesByPostId, setNotesByPostId] = useState<Record<string, string>>({});
  const [aiReviewByPostId, setAiReviewByPostId] = useState<
    Record<string, CommunityAiReviewResult>
  >({});
  const [triagePrompt, setTriagePrompt] = useState('');
  const [triageResponse, setTriageResponse] = useState('');
  const [triageActions, setTriageActions] = useState<AiAction[]>([]);
  const [isTriageLoading, setIsTriageLoading] = useState(false);

  const queueQuery = useCommunityModerationQueue();
  const runAiReview = useRunAiReview();
  const submitHumanReview = useSubmitHumanReview();

  const queueItems = queueQuery.data?.data ?? [];

  const runTriageCopilot = async (message: string) => {
    if (!message.trim()) {
      return;
    }

    setIsTriageLoading(true);
    setTriageResponse('');
    setTriageActions([]);

    try {
      const result = await streamAiChat({
        payload: {
          mode: 'advocate_triage',
          message,
          entityId: queueItems[0]?.post.id,
        },
        onToken: (_, fullText) => setTriageResponse(fullText),
      });

      setTriageResponse(result.cleanText || 'No response generated.');
      setTriageActions(result.structured?.actions ?? []);
    } catch (error) {
      setTriageResponse(
        error instanceof Error ? error.message : 'Unable to generate triage recommendations.',
      );
    } finally {
      setIsTriageLoading(false);
    }
  };

  const handleTriageAction = async (action: AiAction) => {
    const payload = action.payload ?? {};
    const postId = typeof payload.postId === 'string' ? payload.postId : '';

    if (action.type === 'RUN_AI_REVIEW' && postId) {
      const note = notesByPostId[postId]?.trim() || undefined;
      const result = await runAiReview.mutateAsync({ postId, note });

      setAiReviewByPostId((prev) => ({
        ...prev,
        [postId]: result.data.aiReview,
      }));
      return;
    }

    if (action.type === 'SUBMIT_HUMAN_REVIEW' && postId) {
      const verdict =
        typeof payload.verdict === 'string' && payload.verdict === 'UNVERIFIED'
          ? 'UNVERIFIED'
          : 'VERIFIED';

      const shouldProceed = window.confirm(
        `Confirm human ${verdict.toLowerCase()} decision for this post?`,
      );

      if (!shouldProceed) {
        return;
      }

      await submitHumanReview.mutateAsync({
        postId,
        verdict,
        note: notesByPostId[postId]?.trim() || undefined,
      });
      return;
    }

    if (action.route) {
      router.push(action.route);
      return;
    }

    if (action.type === 'OPEN_SIMILAR_CASES') {
      router.push('/advocate/grievances');
    }
  };

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_95%_5%,rgba(245,158,11,0.15),transparent_36%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='space-y-2'>
            <Badge variant='outline' className='w-fit'>
              Advocate Queue
            </Badge>
            <CardTitle className='text-2xl'>Community Moderation Console</CardTitle>
            <p className='text-sm text-muted-foreground'>
              Run AI verification for queued posts and finalize low-trust cases
              with human review decisions.
            </p>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            <Link
              href='/advocate/dashboard'
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Back To Dashboard
            </Link>
            <Link
              href='/community/board'
              className={cn(buttonVariants({ variant: 'default' }))}
            >
              Open Community Feed
            </Link>
          </CardContent>
        </Card>

        <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start'>
          <div className='space-y-3'>
            {queueQuery.isLoading ? (
              <>
                <Skeleton className='h-44 rounded-3xl' />
                <Skeleton className='h-44 rounded-3xl' />
              </>
            ) : queueItems.length === 0 ? (
              <Card className='border-dashed'>
                <CardContent className='p-6 text-sm text-muted-foreground'>
                  Queue is empty. No pending community review items right now.
                </CardContent>
              </Card>
            ) : (
              queueItems.map((item) => {
                const note = notesByPostId[item.post.id] ?? '';
                const aiReview = aiReviewByPostId[item.post.id];
                const canRunAi =
                  item.post.verificationStatus === 'PENDING_AI_REVIEW' ||
                  item.reason === 'MULTIPLE_REPORTS' ||
                  item.reason === 'USER_REQUEST';
                const canRunHuman =
                  item.post.verificationStatus === 'PENDING_HUMAN_REVIEW' ||
                  item.reason === 'TRUST_SCORE_LOW';

                return (
                  <Card key={item.id} className='border-border/60 bg-card/90'>
                    <CardHeader className='space-y-2'>
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge variant='secondary'>{item.reason.replaceAll('_', ' ')}</Badge>
                          <Badge variant='outline'>
                            {item.post.verificationStatus.replaceAll('_', ' ')}
                          </Badge>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Reports: {item.post.reportCount} · Upvotes: {item.post.upvoteCount}
                        </p>
                      </div>

                      <CardTitle className='text-lg'>{item.post.title}</CardTitle>
                      <p className='text-sm text-muted-foreground line-clamp-2'>{item.post.body}</p>
                    </CardHeader>

                    <CardContent className='space-y-3'>
                      {item.post.media.length > 0 ? (
                        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
                          {item.post.media.map((media) => (
                            <a
                              key={media.id}
                              href={media.url}
                              target='_blank'
                              rel='noreferrer'
                              className='relative overflow-hidden rounded-xl border border-border/60'
                            >
                              {renderModerationMediaPreview(media)}
                              <span className='absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white'>
                                {media.mediaType}
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : null}

                      <div className='grid gap-2 text-xs text-muted-foreground md:grid-cols-3'>
                        <p>
                          Triggered by:{' '}
                          <span className='font-medium'>
                            {item.triggeredBy?.fullName ?? 'System'}
                          </span>
                        </p>
                        <p>
                          Platform:{' '}
                          <span className='font-medium'>
                            {item.post.platform?.name ?? 'Unspecified'}
                          </span>
                        </p>
                        <p>
                          Trust score:{' '}
                          <span className='font-medium'>
                            {item.post.trustScore === null
                              ? 'Not scored'
                              : `${(item.post.trustScore * 100).toFixed(0)}%`}
                          </span>
                        </p>
                      </div>

                      <Input
                        value={note}
                        onChange={(event) =>
                          setNotesByPostId((prev) => ({
                            ...prev,
                            [item.post.id]: event.target.value,
                          }))
                        }
                        placeholder='Optional moderation note'
                      />

                      <div className='flex flex-wrap gap-2'>
                        {canRunAi ? (
                          <Button
                            type='button'
                            variant='outline'
                            disabled={runAiReview.isPending}
                            onClick={() => {
                              void runAiReview
                                .mutateAsync({
                                  postId: item.post.id,
                                  note: note.trim() || undefined,
                                })
                                .then((result) => {
                                  setAiReviewByPostId((prev) => ({
                                    ...prev,
                                    [item.post.id]: result.data.aiReview,
                                  }));
                                })
                                .catch(() => {
                                  // Error handling is centralized in the mutation hook.
                                });
                            }}
                          >
                            <Bot className='size-4' />
                            Run AI Review
                          </Button>
                        ) : null}

                        {canRunHuman ? (
                          <Button
                            type='button'
                            disabled={submitHumanReview.isPending}
                            onClick={() =>
                              submitHumanReview.mutate({
                                postId: item.post.id,
                                verdict: 'VERIFIED',
                                note: note.trim() || undefined,
                              })
                            }
                          >
                            <CheckCircle2 className='size-4' />
                            Human Verify
                          </Button>
                        ) : null}

                        {canRunHuman ? (
                          <Button
                            type='button'
                            variant='destructive'
                            disabled={submitHumanReview.isPending}
                            onClick={() =>
                              submitHumanReview.mutate({
                                postId: item.post.id,
                                verdict: 'UNVERIFIED',
                                note: note.trim() || undefined,
                              })
                            }
                          >
                            <XCircle className='size-4' />
                            Human Unverify
                          </Button>
                        ) : null}
                      </div>

                      {aiReview ? (
                        <div className='space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <Badge
                              variant={
                                aiReview.verdict === 'AI_VERIFIED' ? 'default' : 'destructive'
                              }
                            >
                              {aiReview.verdict.replaceAll('_', ' ')}
                            </Badge>
                            <Badge variant='secondary'>
                              Trust {(aiReview.trustScore * 100).toFixed(0)}%
                            </Badge>
                            <Badge variant='outline'>
                              Confidence {(aiReview.confidence * 100).toFixed(0)}%
                            </Badge>
                            <Badge variant='outline'>
                              {aiReview.recommendation.replaceAll('_', ' ')}
                            </Badge>
                          </div>

                          <p className='text-sm text-foreground/90'>{aiReview.summary}</p>

                          <div className='grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4'>
                            <p>
                              Model: <span className='font-medium text-foreground'>{aiReview.model}</span>
                            </p>
                            <p>
                              Provider:{' '}
                              <span className='font-medium text-foreground'>{aiReview.provider}</span>
                            </p>
                            <p>
                              Prompt:{' '}
                              <span className='font-medium text-foreground'>{aiReview.promptVersion}</span>
                            </p>
                            <p>
                              Latency:{' '}
                              <span className='font-medium text-foreground'>{aiReview.latencyMs}ms</span>
                            </p>
                            <p>
                              Prompt tokens:{' '}
                              <span className='font-medium text-foreground'>
                                {aiReview.usage.promptTokens ?? 'n/a'}
                              </span>
                            </p>
                            <p>
                              Completion tokens:{' '}
                              <span className='font-medium text-foreground'>
                                {aiReview.usage.completionTokens ?? 'n/a'}
                              </span>
                            </p>
                            <p>
                              Total tokens:{' '}
                              <span className='font-medium text-foreground'>
                                {aiReview.usage.totalTokens ?? 'n/a'}
                              </span>
                            </p>
                          </div>

                          {aiReview.reasons.length > 0 ? (
                            <div className='space-y-1'>
                              <p className='text-xs font-medium text-muted-foreground'>AI Reasons</p>
                              <div className='space-y-1'>
                                {aiReview.reasons.map((reason) => (
                                  <p key={reason} className='text-xs text-foreground/80'>
                                    - {reason}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {aiReview.riskFlags.length > 0 ? (
                            <div className='space-y-1'>
                              <p className='text-xs font-medium text-muted-foreground'>Risk Flags</p>
                              <div className='space-y-1'>
                                {aiReview.riskFlags.map((riskFlag) => (
                                  <p key={riskFlag} className='text-xs text-amber-700'>
                                    - {riskFlag}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {item.reason === 'MULTIPLE_REPORTS' ? (
                        <p className='inline-flex items-center gap-2 text-xs text-amber-700'>
                          <AlertTriangle className='size-3.5' />
                          Auto-enqueued after repeated community reports.
                        </p>
                      ) : null}

                      {item.reason === 'TRUST_SCORE_LOW' ? (
                        <p className='inline-flex items-center gap-2 text-xs text-blue-700'>
                          <ShieldCheck className='size-3.5' />
                          Low trust-score requires human review decision.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <Card className='border-border/60 bg-card/90 xl:sticky xl:top-6'>
            <CardHeader className='space-y-2'>
              <Badge variant='outline' className='w-fit'>
                Advocate Copilot
              </Badge>
              <CardTitle className='text-lg'>Triage Side Panel</CardTitle>
              <p className='text-xs text-muted-foreground'>
                Summarize queue risk and run recommended moderation actions.
              </p>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={isTriageLoading}
                  onClick={() => {
                    void runTriageCopilot(
                      'Rank the top moderation queue items by risk and give a clear action order.',
                    );
                  }}
                >
                  <Sparkles className='mr-1 size-3.5' />
                  Rank Queue
                </Button>
              </div>

              <div className='flex gap-2'>
                <Input
                  value={triagePrompt}
                  onChange={(event) => setTriagePrompt(event.target.value)}
                  placeholder='Ask for triage recommendation...'
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const prompt = triagePrompt.trim();
                      if (!prompt || isTriageLoading) {
                        return;
                      }
                      setTriagePrompt('');
                      void runTriageCopilot(prompt);
                    }
                  }}
                />
                <Button
                  type='button'
                  size='icon'
                  disabled={isTriageLoading || !triagePrompt.trim()}
                  onClick={() => {
                    const prompt = triagePrompt.trim();
                    if (!prompt) {
                      return;
                    }
                    setTriagePrompt('');
                    void runTriageCopilot(prompt);
                  }}
                >
                  {isTriageLoading ? (
                    <Loader2 className='size-4 animate-spin' />
                  ) : (
                    <Send className='size-4' />
                  )}
                </Button>
              </div>

              {triageResponse ? (
                <div className='space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3'>
                  <p className='whitespace-pre-wrap text-sm leading-relaxed'>{triageResponse}</p>
                  {triageActions.length ? (
                    <div className='flex flex-wrap gap-2'>
                      {triageActions.slice(0, 5).map((action) => (
                        <Button
                          key={action.id ?? action.label}
                          type='button'
                          size='sm'
                          variant='outline'
                          disabled={isTriageLoading || runAiReview.isPending || submitHumanReview.isPending}
                          onClick={() => {
                            void handleTriageAction(action);
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>
                  Ask the copilot to prioritize which post should receive AI review versus direct human decision.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
