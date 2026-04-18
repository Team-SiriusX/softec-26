'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bot, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCommunityModerationQueue,
  useRunMockAiReview,
  useSubmitHumanReview,
} from '@/hooks/use-community';
import { cn } from '@/lib/utils';

export default function CommunityModerationPage() {
  const [notesByPostId, setNotesByPostId] = useState<Record<string, string>>({});

  const queueQuery = useCommunityModerationQueue();
  const runMockAiReview = useRunMockAiReview();
  const submitHumanReview = useSubmitHumanReview();

  const queueItems = queueQuery.data?.data ?? [];

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
              Run mock AI verification for queued posts and finalize low-trust cases
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

        {queueQuery.isLoading ? (
          <div className='space-y-3'>
            <Skeleton className='h-44 rounded-3xl' />
            <Skeleton className='h-44 rounded-3xl' />
          </div>
        ) : queueItems.length === 0 ? (
          <Card className='border-dashed'>
            <CardContent className='p-6 text-sm text-muted-foreground'>
              Queue is empty. No pending community review items right now.
            </CardContent>
          </Card>
        ) : (
          queueItems.map((item) => {
            const note = notesByPostId[item.post.id] ?? '';
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
                      <Badge variant='outline'>{item.post.verificationStatus.replaceAll('_', ' ')}</Badge>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Reports: {item.post.reportCount} · Upvotes: {item.post.upvoteCount}
                    </p>
                  </div>

                  <CardTitle className='text-lg'>{item.post.title}</CardTitle>
                  <p className='text-sm text-muted-foreground line-clamp-2'>{item.post.body}</p>
                </CardHeader>

                <CardContent className='space-y-3'>
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
                        {item.post.trustScore === null ? 'Not scored' : `${(item.post.trustScore * 100).toFixed(0)}%`}
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
                        disabled={runMockAiReview.isPending}
                        onClick={() =>
                          runMockAiReview.mutate({
                            postId: item.post.id,
                            note: note.trim() || undefined,
                          })
                        }
                      >
                        <Bot className='size-4' />
                        Run Mock AI Review
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
    </main>
  );
}
