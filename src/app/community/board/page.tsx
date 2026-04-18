'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock4,
  MessageSquareText,
  ShieldCheck,
  ThumbsUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useCommunityFeed,
  useCommunityPlatforms,
  useCreateCommunityComment,
  useCreateCommunityPost,
  useReportCommunityPost,
  useRequestHumanReview,
  useRequestPostVerification,
  useToggleCommunityUpvote,
} from '@/hooks/use-community';
import {
  communitySortOptions,
  communityVerificationTone,
  formatCommunityVerificationStatus,
  isVerifiedCommunityStatus,
  type CommunityFeedSort,
  type CommunityPost,
} from '@/lib/community';
import { UploadDropzone } from '@/lib/uploadthing';

const FEED_LIMIT = 40;

type UploadedMediaItem = {
  url: string;
  fileKey?: string;
  mediaType?: string;
};

function prettyDate(value: string): string {
  return new Date(value).toLocaleDateString('en-PK', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function prettyRelative(value: string): string {
  const createdAt = new Date(value).getTime();
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function trustLabel(score: number | null): string {
  if (score === null) return 'Not scored yet';
  if (score >= 0.75) return 'High trust';
  if (score >= 0.55) return 'Moderate trust';
  return 'Low trust';
}

export default function CommunityBoardPage() {
  const { user } = useCurrentUser();
  const isSignedIn = Boolean(user?.id);
  const isWorker = user?.role === 'WORKER';
  const canParticipate = Boolean(isSignedIn && isWorker);

  const [sort, setSort] = useState<CommunityFeedSort>('hot');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMediaItem[]>([]);
  const [postPlatformId, setPostPlatformId] = useState('none');
  const [postAnonymously, setPostAnonymously] = useState(false);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const platformsQuery = useCommunityPlatforms();
  const feedQuery = useCommunityFeed({
    sort,
    platformId: platformFilter === 'all' ? undefined : platformFilter,
    limit: FEED_LIMIT,
    offset: 0,
  });

  const createPost = useCreateCommunityPost();
  const toggleUpvote = useToggleCommunityUpvote();
  const createComment = useCreateCommunityComment();
  const reportPost = useReportCommunityPost();
  const requestVerification = useRequestPostVerification();
  const requestHumanReview = useRequestHumanReview();

  const posts = feedQuery.data?.data ?? [];
  const q = searchTerm.trim().toLowerCase();
  const filteredPosts = q
    ? posts.filter((post) => {
        return [post.title, post.body, post.platform?.name ?? '', post.author.fullName]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
    : posts;

  const totalPosts = feedQuery.data?.meta.total ?? 0;
  const verifiedPosts = posts.filter((post) =>
    isVerifiedCommunityStatus(post.verificationStatus),
  ).length;

  const handleCreatePost = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canParticipate) {
      toast.error('Only workers can create community posts');
      return;
    }

    createPost.mutate(
      {
        title,
        body,
        platformId: postPlatformId === 'none' ? undefined : postPlatformId,
        isAnonymous: postAnonymously,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
          setUploadedMedia([]);
          setPostPlatformId('none');
          setPostAnonymously(false);
        },
      },
    );
  };

  const handleReport = async (post: CommunityPost) => {
    if (!canParticipate) {
      toast.error('Only workers can report community posts');
      return;
    }

    const reason = window.prompt(
      'Why are you reporting this post? (example: false claim, abuse, spam)',
      'Possible inaccurate claim',
    );

    if (!reason || reason.trim().length < 5) {
      toast.error('Report reason must be at least 5 characters');
      return;
    }

    await reportPost.mutateAsync({
      postId: post.id,
      reason: reason.trim(),
    });
  };

  const handleAddComment = async (post: CommunityPost) => {
    if (!canParticipate) {
      toast.error('Only workers can comment on community posts');
      return;
    }

    const content = commentDrafts[post.id]?.trim() ?? '';

    if (!content) {
      toast.error('Write a comment first');
      return;
    }

    await createComment.mutateAsync({
      postId: post.id,
      content,
      isAnonymous: false,
    });

    setCommentDrafts((prev) => ({
      ...prev,
      [post.id]: '',
    }));
  };

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_6%_4%,rgba(14,165,233,0.15),transparent_36%),radial-gradient(circle_at_96%_95%,rgba(34,197,94,0.15),transparent_34%)] px-4 py-8 md:px-8'>
      <div className='mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[370px_1fr]'>
        <section className='space-y-4'>
          <Card className='border-border/60 bg-card/90'>
            <CardHeader className='space-y-2'>
              <Badge variant='outline' className='w-fit'>
                Community V2
              </Badge>
              <CardTitle className='text-2xl'>Freelancer Justice Feed</CardTitle>
              <p className='text-sm text-muted-foreground'>
                Post claims with evidence, get community support, and escalate low-trust
                disputes to human review.
              </p>
            </CardHeader>
            <CardContent className='grid grid-cols-3 gap-2 text-center'>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-3 py-2'>
                <p className='text-xl font-semibold'>{totalPosts || '--'}</p>
                <p className='text-xs text-muted-foreground'>Feed Size</p>
              </div>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-3 py-2'>
                <p className='text-xl font-semibold'>{verifiedPosts}</p>
                <p className='text-xs text-muted-foreground'>Verified</p>
              </div>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-3 py-2'>
                <p className='text-xl font-semibold'>{posts.filter((item) => item.reportCount >= 3).length}</p>
                <p className='text-xs text-muted-foreground'>AI Queue</p>
              </div>
            </CardContent>
          </Card>

          <Card className='border-border/60 bg-card/90'>
            <CardHeader>
              <CardTitle className='text-lg'>Create a post</CardTitle>
            </CardHeader>
            <CardContent>
              {!isSignedIn ? (
                <p className='rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground'>
                  Sign in as a worker to create community posts and upload evidence.
                </p>
              ) : !isWorker ? (
                <p className='rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground'>
                  Community posting is worker-only. Advocates and verifiers can moderate from their dedicated queue.
                </p>
              ) : (
                <form className='space-y-4' onSubmit={handleCreatePost}>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder='Post title (what happened?)'
                    minLength={8}
                    maxLength={160}
                    required
                  />

                  <Textarea
                    rows={5}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder='Explain the claim with details: dates, amounts, platform actions, and why this feels unfair.'
                    minLength={20}
                    maxLength={4000}
                    required
                  />

                  <Select value={postPlatformId} onValueChange={(value) => setPostPlatformId(value ?? 'none')}>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Platform (optional)' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>No platform selected</SelectItem>
                      {(platformsQuery.data?.data ?? []).map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className='space-y-2'>
                    <p className='text-xs text-muted-foreground'>
                      Upload up to 4 image files as evidence (worker-only).
                    </p>
                    <UploadDropzone
                      endpoint='communityPostMediaUploader'
                      onClientUploadComplete={(files) => {
                        const next = files.map((file) => ({
                          url: file.serverData?.fileUrl ?? file.url,
                          fileKey: file.serverData?.fileKey ?? file.key,
                          mediaType: 'IMAGE',
                        }));

                        setUploadedMedia((prev) => {
                          const merged = [...prev, ...next];
                          const deduped = merged.filter((item, index, self) => {
                            return self.findIndex((entry) => entry.fileKey === item.fileKey) === index;
                          });
                          return deduped.slice(0, 4);
                        });

                        toast.success('Evidence uploaded');
                      }}
                      onUploadError={(error) => {
                        toast.error(error.message);
                      }}
                    />

                    {uploadedMedia.length > 0 ? (
                      <div className='grid grid-cols-2 gap-2'>
                        {uploadedMedia.map((media) => (
                          <div
                            key={media.fileKey ?? media.url}
                            className='relative overflow-hidden rounded-xl border border-border/60'
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={media.url}
                              alt='Uploaded evidence preview'
                              className='h-24 w-full object-cover'
                            />
                            <Button
                              type='button'
                              size='icon'
                              variant='secondary'
                              className='absolute right-1 top-1 size-7'
                              onClick={() => {
                                setUploadedMedia((prev) => {
                                  return prev.filter((item) => item.fileKey !== media.fileKey);
                                });
                              }}
                            >
                              <X className='size-4' />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <label className='inline-flex items-center gap-2 text-sm text-muted-foreground'>
                    <input
                      type='checkbox'
                      checked={postAnonymously}
                      onChange={(event) => setPostAnonymously(event.target.checked)}
                      className='size-4 rounded border border-input accent-primary'
                    />
                    Post anonymously
                  </label>

                  <Button type='submit' className='w-full min-h-11' disabled={createPost.isPending}>
                    {createPost.isPending ? 'Publishing...' : 'Publish Post'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </section>

        <section className='space-y-4'>
          <Card className='border-border/60 bg-card/90'>
            <CardContent className='grid gap-3 p-4 md:grid-cols-[1fr_210px_210px]'>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Search by claim text or platform'
              />

              <Select
                value={sort}
                onValueChange={(value) => setSort((value ?? 'hot') as CommunityFeedSort)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Sort feed' />
                </SelectTrigger>
                <SelectContent>
                  {communitySortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={platformFilter}
                onValueChange={(value) => setPlatformFilter(value ?? 'all')}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='All platforms' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All platforms</SelectItem>
                  {(platformsQuery.data?.data ?? []).map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {feedQuery.isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-52 rounded-3xl' />
              <Skeleton className='h-52 rounded-3xl' />
            </div>
          ) : filteredPosts.length === 0 ? (
            <Card className='border-dashed'>
              <CardContent className='p-6 text-sm text-muted-foreground'>
                No posts found. Be the first to publish a verified claim.
              </CardContent>
            </Card>
          ) : (
            filteredPosts.map((post) => {
              const isOwner = Boolean(user?.id && user.id === post.authorId);
              const canRequestVerification =
                canParticipate &&
                isOwner &&
                (post.verificationStatus === 'UNVERIFIED' ||
                  post.verificationStatus === 'HUMAN_UNVERIFIED');
              const canRequestHumanReview =
                canParticipate &&
                isOwner &&
                post.verificationStatus === 'AI_UNVERIFIED_LOW_TRUST';

              return (
                <Card
                  key={post.id}
                  className='border-border/60 bg-card/90 shadow-sm transition-shadow hover:shadow-md'
                >
                  <CardHeader className='space-y-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='flex flex-wrap items-center gap-2'>
                        {post.platform ? <Badge variant='outline'>{post.platform.name}</Badge> : null}
                        <Badge variant={communityVerificationTone[post.verificationStatus]}>
                          {formatCommunityVerificationStatus(post.verificationStatus)}
                        </Badge>
                        {post.trustScore !== null ? (
                          <Badge variant='secondary'>Trust {(post.trustScore * 100).toFixed(0)}%</Badge>
                        ) : null}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {prettyDate(post.createdAt)} · {prettyRelative(post.createdAt)}
                      </p>
                    </div>

                    <div>
                      <CardTitle className='text-lg'>{post.title}</CardTitle>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        by {post.author.fullName} · {trustLabel(post.trustScore)}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className='space-y-4'>
                    <p className='text-sm leading-relaxed text-foreground/90'>{post.body}</p>

                    {post.media.length > 0 ? (
                      <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
                        {post.media.map((media) => (
                          <a
                            key={media.id}
                            href={media.url}
                            target='_blank'
                            rel='noreferrer'
                            className='overflow-hidden rounded-xl border border-border/60'
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={media.url}
                              alt='Post evidence media'
                              className='h-24 w-full object-cover'
                              loading='lazy'
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    <div className='grid gap-2 text-xs text-muted-foreground md:grid-cols-3'>
                      <p className='inline-flex items-center gap-1'>
                        <ThumbsUp className='size-3.5' />
                        {post.upvoteCount} upvotes
                      </p>
                      <p className='inline-flex items-center gap-1'>
                        <MessageSquareText className='size-3.5' />
                        {post.commentCount} comments
                      </p>
                      <p className='inline-flex items-center gap-1'>
                        <AlertTriangle className='size-3.5' />
                        {post.reportCount} reports
                      </p>
                    </div>

                    {canParticipate ? (
                      <div className='flex flex-wrap gap-2'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          className='min-h-10'
                          disabled={toggleUpvote.isPending}
                          onClick={() => {
                            toggleUpvote.mutate(post.id);
                          }}
                        >
                          Upvote
                        </Button>

                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          className='min-h-10'
                          disabled={reportPost.isPending}
                          onClick={() => void handleReport(post)}
                        >
                          Report
                        </Button>

                        {canRequestVerification ? (
                          <Button
                            type='button'
                            size='sm'
                            className='min-h-10'
                            disabled={requestVerification.isPending}
                            onClick={() => requestVerification.mutate(post.id)}
                          >
                            Request Verification
                          </Button>
                        ) : null}

                        {canRequestHumanReview ? (
                          <Button
                            type='button'
                            size='sm'
                            variant='secondary'
                            className='min-h-10'
                            disabled={requestHumanReview.isPending}
                            onClick={() => requestHumanReview.mutate(post.id)}
                          >
                            Request Human Review
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className='text-xs text-muted-foreground'>
                        Sign in as a worker to upvote, report, and comment.
                      </p>
                    )}

                    <div className='rounded-2xl border border-border/60 bg-muted/20 p-3'>
                      <p className='mb-2 text-xs font-medium text-muted-foreground'>
                        Quick comments
                      </p>

                      <div className='space-y-2'>
                        {(post.commentsPreview ?? []).map((comment) => (
                          <div
                            key={comment.id}
                            className='rounded-xl border border-border/60 bg-background px-3 py-2'
                          >
                            <p className='text-xs text-muted-foreground'>
                              {comment.author.fullName} · {prettyRelative(comment.createdAt)}
                            </p>
                            <p className='mt-1 text-sm'>{comment.content}</p>
                          </div>
                        ))}
                      </div>

                      {canParticipate ? (
                        <div className='mt-3 flex gap-2'>
                          <Input
                            value={commentDrafts[post.id] ?? ''}
                            onChange={(event) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [post.id]: event.target.value,
                              }))
                            }
                            placeholder='Add a comment'
                          />
                          <Button
                            type='button'
                            variant='outline'
                            className='min-h-10'
                            disabled={createComment.isPending}
                            onClick={() => void handleAddComment(post)}
                          >
                            Comment
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {post.verificationStatus === 'PENDING_AI_REVIEW' ? (
                      <p className='inline-flex items-center gap-2 text-xs text-amber-700'>
                        <Clock4 className='size-3.5' />
                        This post is queued for AI review.
                      </p>
                    ) : null}

                    {post.verificationStatus === 'PENDING_HUMAN_REVIEW' ? (
                      <p className='inline-flex items-center gap-2 text-xs text-blue-700'>
                        <ShieldCheck className='size-3.5' />
                        Human advocate review is pending.
                      </p>
                    ) : null}

                    {post.verificationStatus === 'HUMAN_VERIFIED' ? (
                      <p className='inline-flex items-center gap-2 text-xs text-emerald-700'>
                        <CheckCircle2 className='size-3.5' />
                        Verified by human review.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
