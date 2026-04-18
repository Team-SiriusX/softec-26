'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock4,
  Image as ImageIcon,
  MessageSquareText,
  PencilLine,
  Plus,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  UserRoundPen,
  Video,
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
  useDeleteCommunityPost,
  useMyCommunityPosts,
  useReportCommunityPost,
  useRequestHumanReview,
  useRequestPostVerification,
  useToggleCommunityUpvote,
  useUpdateCommunityPost,
} from '@/hooks/use-community';
import {
  type CommunityMedia,
  communitySortOptions,
  communityVerificationTone,
  formatCommunityVerificationStatus,
  isVerifiedCommunityStatus,
  type CommunityFeedSort,
  type CommunityPost,
} from '@/lib/community';
import { UploadDropzone } from '@/lib/uploadthing';

const FEED_LIMIT = 40;
const MY_POSTS_LIMIT = 40;
const MAX_MEDIA_ITEMS = 8;
const VIDEO_PATH_PATTERN = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;

type UploadedMediaItem = {
  url: string;
  fileKey?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
};

type BoardView = 'feed' | 'mine';

type EditablePostDraft = {
  title: string;
  body: string;
  platformId: string;
  isAnonymous: boolean;
};

function createEditDraft(post: CommunityPost): EditablePostDraft {
  return {
    title: post.title,
    body: post.body,
    platformId: post.platform?.id ?? 'none',
    isAnonymous: post.isAnonymous,
  };
}

function filterPostsByQuery(posts: CommunityPost[], query: string): CommunityPost[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    return posts;
  }

  return posts.filter((post) => {
    return [post.title, post.body, post.platform?.name ?? '', post.author.fullName]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

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

function normalizeMediaType(value: unknown): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
  if (value === 'VIDEO' || value === 'DOCUMENT') {
    return value;
  }

  return 'IMAGE';
}

function inferMediaTypeFromUrl(url: string): 'IMAGE' | 'VIDEO' {
  try {
    const parsed = new URL(url);
    return VIDEO_PATH_PATTERN.test(parsed.pathname) ? 'VIDEO' : 'IMAGE';
  } catch {
    return VIDEO_PATH_PATTERN.test(url) ? 'VIDEO' : 'IMAGE';
  }
}

function renderCommunityMediaPreview(media: Pick<CommunityMedia, 'url' | 'mediaType'>) {
  const mediaType = normalizeMediaType(media.mediaType);

  if (mediaType === 'VIDEO') {
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

export default function CommunityBoardPage() {
  const { user } = useCurrentUser();
  const isSignedIn = Boolean(user?.id);
  const isWorker = user?.role === 'WORKER';
  const canParticipate = Boolean(isSignedIn && isWorker);

  const [activeView, setActiveView] = useState<BoardView>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('view') === 'mine'
        ? 'mine'
        : 'feed';
    }

    return 'feed';
  });
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);

  const [sort, setSort] = useState<CommunityFeedSort>('hot');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMediaItem[]>([]);
  const [isCreateMediaUploading, setIsCreateMediaUploading] = useState(false);
  const [manualMediaUrl, setManualMediaUrl] = useState('');
  const [postPlatformId, setPostPlatformId] = useState('none');
  const [postAnonymously, setPostAnonymously] = useState(false);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditablePostDraft>>({});
  const [editMediaDrafts, setEditMediaDrafts] = useState<
    Record<string, UploadedMediaItem[]>
  >({});
  const [editManualMediaUrls, setEditManualMediaUrls] = useState<
    Record<string, string>
  >({});
  const [editUploadingByPost, setEditUploadingByPost] = useState<
    Record<string, boolean>
  >({});

  const platformsQuery = useCommunityPlatforms();
  const feedQuery = useCommunityFeed({
    sort,
    platformId: platformFilter === 'all' ? undefined : platformFilter,
    limit: FEED_LIMIT,
    offset: 0,
  });
  const myPostsQuery = useMyCommunityPosts(
    {
      limit: MY_POSTS_LIMIT,
      offset: 0,
    },
    canParticipate,
  );

  const createPost = useCreateCommunityPost();
  const toggleUpvote = useToggleCommunityUpvote();
  const createComment = useCreateCommunityComment();
  const reportPost = useReportCommunityPost();
  const requestVerification = useRequestPostVerification();
  const requestHumanReview = useRequestHumanReview();
  const updatePost = useUpdateCommunityPost();
  const deletePost = useDeleteCommunityPost();

  const platformOptions = platformsQuery.data?.data ?? [];
  const platformNameById = new Map(
    platformOptions.map((platform) => [platform.id, platform.name]),
  );

  const posts = feedQuery.data?.data ?? [];
  const myPosts = myPostsQuery.data?.data ?? [];
  const filteredPosts = filterPostsByQuery(posts, searchTerm);
  const filteredMyPosts = filterPostsByQuery(myPosts, searchTerm);

  const totalPosts = feedQuery.data?.meta.total ?? 0;
  const verifiedPosts = posts.filter((post) =>
    isVerifiedCommunityStatus(post.verificationStatus),
  ).length;

  const isKnownPlatformId = (platformId: string) => {
    return platformOptions.some((platform) => platform.id === platformId);
  };

  const platformLabel = (platformId: string) => {
    if (platformId === 'none') {
      return 'Platform (optional)';
    }

    return platformNameById.get(platformId) ?? 'Select a valid platform';
  };

  const normalizeUploadedMedia = (
    media: Pick<CommunityMedia, 'url' | 'fileKey' | 'mediaType'>,
  ): UploadedMediaItem => {
    return {
      url: media.url,
      fileKey: media.fileKey ?? undefined,
      mediaType: normalizeMediaType(media.mediaType),
    };
  };

  const mergeUploadedMediaItems = (
    current: UploadedMediaItem[],
    incoming: UploadedMediaItem[],
  ) => {
    const merged = [...current, ...incoming];
    const deduped = merged.filter((item, index, self) => {
      return (
        self.findIndex((entry) => {
          if (entry.fileKey && item.fileKey) {
            return entry.fileKey === item.fileKey;
          }

          return entry.url === item.url;
        }) === index
      );
    });

    return deduped.slice(0, MAX_MEDIA_ITEMS);
  };

  const removeUploadedMediaItem = (
    current: UploadedMediaItem[],
    target: UploadedMediaItem,
  ) => {
    return current.filter((item) => {
      if (target.fileKey) {
        return item.fileKey !== target.fileKey;
      }

      return item.url !== target.url;
    });
  };

  const areUploadedMediaItemsEqual = (
    left: UploadedMediaItem[],
    right: UploadedMediaItem[],
  ) => {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((item, index) => {
      const other = right[index];

      return (
        item.url === other.url &&
        (item.fileKey ?? null) === (other.fileKey ?? null) &&
        normalizeMediaType(item.mediaType) === normalizeMediaType(other.mediaType)
      );
    });
  };

  const extractUploadedMediaItems = (
    files: Array<{
      serverData?: { fileUrl?: string; fileKey?: string; mediaType?: unknown };
      ufsUrl?: string;
      url?: string;
      key?: string;
      type?: string;
    }>,
  ): UploadedMediaItem[] => {
    const next: UploadedMediaItem[] = [];

    for (const file of files) {
      const inferredType = normalizeMediaType(
        file.serverData?.mediaType ??
          (file.type?.startsWith('video/') ? 'VIDEO' : 'IMAGE'),
      );
      const resolvedUrl = file.serverData?.fileUrl ?? file.ufsUrl ?? file.url;

      if (!resolvedUrl) {
        continue;
      }

      next.push({
        url: resolvedUrl,
        fileKey: file.serverData?.fileKey ?? file.key ?? undefined,
        mediaType: inferredType,
      });
    }

    return next;
  };

  const clearEditMediaState = (postId: string) => {
    setEditMediaDrafts((prev) => {
      if (!(postId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[postId];
      return next;
    });

    setEditManualMediaUrls((prev) => {
      if (!(postId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[postId];
      return next;
    });

    setEditUploadingByPost((prev) => {
      if (!(postId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[postId];
      return next;
    });
  };

  const handleCancelEdit = (postId: string) => {
    clearEditMediaState(postId);
    setEditingPostId((current) => (current === postId ? null : current));
  };

  const handleEditStart = (post: CommunityPost) => {
    setEditingPostId(post.id);
    setEditDrafts((prev) => ({
      ...prev,
      [post.id]: createEditDraft(post),
    }));
    setEditMediaDrafts((prev) => ({
      ...prev,
      [post.id]: post.media.map(normalizeUploadedMedia),
    }));
    setEditManualMediaUrls((prev) => ({
      ...prev,
      [post.id]: '',
    }));
  };

  const handleToggleAnonymous = async (post: CommunityPost) => {
    if (!canParticipate) {
      toast.error('Only workers can edit their posts');
      return;
    }

    await updatePost.mutateAsync({
      postId: post.id,
      isAnonymous: !post.isAnonymous,
    });
  };

  const handleDeletePost = async (post: CommunityPost) => {
    if (!canParticipate) {
      toast.error('Only workers can delete their posts');
      return;
    }

    const shouldDelete = window.confirm(
      'Delete this post permanently? This cannot be undone.',
    );

    if (!shouldDelete) {
      return;
    }

    await deletePost.mutateAsync(post.id);

    setEditDrafts((prev) => {
      if (!(post.id in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[post.id];
      return next;
    });

    clearEditMediaState(post.id);

    setEditingPostId((current) => (current === post.id ? null : current));
  };

  const handleAddManualMediaUrlToEdit = (postId: string) => {
    const candidate = (editManualMediaUrls[postId] ?? '').trim();

    if (!candidate) {
      return;
    }

    try {
      const parsed = new URL(candidate);
      if (!parsed.protocol.startsWith('http')) {
        throw new Error('invalid protocol');
      }
    } catch {
      toast.error('Please enter a valid media URL');
      return;
    }

    setEditMediaDrafts((prev) => {
      const current = prev[postId] ?? [];

      if (current.some((item) => item.url === candidate)) {
        return prev;
      }

      if (current.length >= MAX_MEDIA_ITEMS) {
        toast.error(`You can attach up to ${MAX_MEDIA_ITEMS} media items`);
        return prev;
      }

      return {
        ...prev,
        [postId]: mergeUploadedMediaItems(current, [
          {
            url: candidate,
            mediaType: inferMediaTypeFromUrl(candidate),
          },
        ]),
      };
    });

    setEditManualMediaUrls((prev) => ({
      ...prev,
      [postId]: '',
    }));
    toast.success('Media URL added');
  };

  const handleAddManualMediaUrl = () => {
    const candidate = manualMediaUrl.trim();

    if (!candidate) {
      return;
    }

    try {
      const parsed = new URL(candidate);
      if (!parsed.protocol.startsWith('http')) {
        throw new Error('invalid protocol');
      }
    } catch {
      toast.error('Please enter a valid media URL');
      return;
    }

    setUploadedMedia((prev) => {
      const exists = prev.some((item) => item.url === candidate);

      if (exists) {
        return prev;
      }

      if (prev.length >= MAX_MEDIA_ITEMS) {
        toast.error(`You can attach up to ${MAX_MEDIA_ITEMS} media items`);
        return prev;
      }

      return [...prev, { url: candidate, mediaType: inferMediaTypeFromUrl(candidate) }];
    });

    setManualMediaUrl('');
    toast.success('Media URL added');
  };

  const handleSaveEdit = async (postId: string) => {
    if (!canParticipate) {
      toast.error('Only workers can edit their posts');
      return;
    }

    if (editUploadingByPost[postId]) {
      toast.error('Please wait for media upload to finish before saving');
      return;
    }

    const draft = editDrafts[postId];

    if (!draft) {
      toast.error('No draft found for this post');
      return;
    }

    const nextTitle = draft.title.trim();
    const nextBody = draft.body.trim();

    if (nextTitle.length < 8 || nextTitle.length > 160) {
      toast.error('Title must be between 8 and 160 characters');
      return;
    }

    if (nextBody.length < 20 || nextBody.length > 4000) {
      toast.error('Body must be between 20 and 4000 characters');
      return;
    }

    const resolvedPlatformId =
      draft.platformId === 'none'
        ? null
        : isKnownPlatformId(draft.platformId)
          ? draft.platformId
          : null;

    if (draft.platformId !== 'none' && !resolvedPlatformId) {
      toast.error('Please select a valid platform before saving');
      return;
    }

    const sourcePost = myPosts.find((item) => item.id === postId);
    const originalMedia = sourcePost
      ? sourcePost.media.map(normalizeUploadedMedia)
      : [];
    const draftMedia = editMediaDrafts[postId] ?? originalMedia;
    const shouldSendMedia = sourcePost
      ? !areUploadedMediaItemsEqual(draftMedia, originalMedia)
      : Boolean(editMediaDrafts[postId]);

    await updatePost.mutateAsync({
      postId,
      title: nextTitle,
      body: nextBody,
      platformId: resolvedPlatformId,
      isAnonymous: draft.isAnonymous,
      media: shouldSendMedia ? draftMedia : undefined,
    });

    clearEditMediaState(postId);
    setEditingPostId((current) => (current === postId ? null : current));
  };

  const handleCreatePost = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canParticipate) {
      toast.error('Only workers can create community posts');
      return;
    }

    const selectedPlatformId =
      postPlatformId === 'none'
        ? undefined
        : isKnownPlatformId(postPlatformId)
          ? postPlatformId
          : undefined;

    if (postPlatformId !== 'none' && !selectedPlatformId) {
      toast.error('Selected platform is no longer available. Please select it again.');
      setPostPlatformId('none');
      return;
    }

    createPost.mutate(
      {
        title,
        body,
        platformId: selectedPlatformId,
        isAnonymous: postAnonymously,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
          setUploadedMedia([]);
          setManualMediaUrl('');
          setPostPlatformId('none');
          setPostAnonymously(false);
          setIsCreatePanelOpen(false);
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

  const isActiveViewLoading =
    activeView === 'feed' ? feedQuery.isLoading : myPostsQuery.isLoading;

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_6%_4%,rgba(14,165,233,0.15),transparent_36%),radial-gradient(circle_at_96%_95%,rgba(34,197,94,0.15),transparent_34%)] px-4 py-8 md:px-8'>
      <div
        className={`mx-auto w-full gap-6 ${
          activeView === 'mine'
            ? 'grid max-w-7xl lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)]'
            : 'max-w-7xl'
        }`}
      >
        {activeView === 'mine' ? (
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
            <CardHeader className='flex flex-row items-start justify-between gap-3'>
              <div className='space-y-1'>
                <CardTitle className='text-lg'>Create a post</CardTitle>
                <p className='text-xs text-muted-foreground'>
                  Share evidence with multiple images and short videos.
                </p>
              </div>
              <Button
                type='button'
                size='icon'
                variant={isCreatePanelOpen ? 'secondary' : 'default'}
                className='size-10 rounded-full'
                disabled={!canParticipate}
                onClick={() => setIsCreatePanelOpen((prev) => !prev)}
              >
                {isCreatePanelOpen ? <X className='size-5' /> : <Plus className='size-5' />}
              </Button>
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
              ) : !isCreatePanelOpen ? (
                <button
                  type='button'
                  className='w-full rounded-3xl border border-dashed border-emerald-300/70 bg-emerald-500/10 p-5 text-left transition hover:border-emerald-400 hover:bg-emerald-500/15'
                  onClick={() => setIsCreatePanelOpen(true)}
                >
                  <span className='mb-3 inline-flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white'>
                    <Plus className='size-5' />
                  </span>
                  <p className='text-sm font-semibold'>Start a new community post</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Tap to open the composer and attach images/videos.
                  </p>
                </button>
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
                      <SelectValue placeholder='Platform (optional)'>
                        {platformLabel(postPlatformId)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>No platform selected</SelectItem>
                      {platformOptions.map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className='space-y-2'>
                    <p className='inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                      <ImageIcon className='size-3.5' />
                      <Video className='size-3.5' />
                      Upload up to {MAX_MEDIA_ITEMS} media files (images + videos).
                    </p>
                    <UploadDropzone
                      endpoint='communityPostMediaUploader'
                      onUploadBegin={() => setIsCreateMediaUploading(true)}
                      onClientUploadComplete={(files) => {
                        setIsCreateMediaUploading(false);
                        const next = extractUploadedMediaItems(files);

                        if (next.length === 0) {
                          toast.error(
                            'Upload finished but no media URL was returned. Try uploading again.',
                          );
                          return;
                        }

                        setUploadedMedia((prev) => {
                          return mergeUploadedMediaItems(prev, next);
                        });

                        toast.success('Evidence uploaded');
                      }}
                      onUploadError={(error) => {
                        setIsCreateMediaUploading(false);
                        toast.error(
                          error.message ||
                            'Upload failed. You can add a media URL manually below.',
                        );
                      }}
                    />

                    <div className='flex flex-col gap-2 sm:flex-row'>
                      <Input
                        value={manualMediaUrl}
                        onChange={(event) => setManualMediaUrl(event.target.value)}
                        placeholder='Or paste a public media URL'
                      />
                      <Button
                        type='button'
                        variant='outline'
                        className='min-h-10 sm:min-w-32'
                        onClick={handleAddManualMediaUrl}
                      >
                        Add URL
                      </Button>
                    </div>

                    {uploadedMedia.length > 0 ? (
                      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                        {uploadedMedia.map((media) => (
                          <div
                            key={media.fileKey ?? media.url}
                            className='relative overflow-hidden rounded-xl border border-border/60'
                          >
                            {renderCommunityMediaPreview({
                              url: media.url,
                              mediaType: media.mediaType ?? 'IMAGE',
                            })}
                            <span className='absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white'>
                              {normalizeMediaType(media.mediaType)}
                            </span>
                            <Button
                              type='button'
                              size='icon'
                              variant='secondary'
                              className='absolute right-1 top-1 size-7'
                              onClick={() => {
                                setUploadedMedia((prev) => {
                                  return removeUploadedMediaItem(prev, media);
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

                  <div className='flex flex-col gap-2 sm:flex-row'>
                    <Button
                      type='submit'
                      className='min-h-11 w-full'
                      disabled={createPost.isPending || isCreateMediaUploading}
                    >
                      {isCreateMediaUploading
                        ? 'Uploading media...'
                        : createPost.isPending
                          ? 'Publishing...'
                          : 'Publish Post'}
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      className='min-h-11 w-full sm:w-auto'
                      onClick={() => setIsCreatePanelOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
          </section>
        ) : null}

        <section className='space-y-4'>
          {activeView === 'feed' ? (
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
                  <p className='text-xl font-semibold'>
                    {posts.filter((item) => item.reportCount >= 3).length}
                  </p>
                  <p className='text-xs text-muted-foreground'>AI Queue</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className='border-border/60 bg-card/90'>
            <CardContent className='space-y-3 p-4'>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant={activeView === 'feed' ? 'default' : 'outline'}
                  onClick={() => setActiveView('feed')}
                >
                  Community Feed
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={activeView === 'mine' ? 'default' : 'outline'}
                  onClick={() => setActiveView('mine')}
                  disabled={!canParticipate}
                >
                  My Posts
                </Button>
              </div>

              <div className='grid gap-3 md:grid-cols-[1fr_210px_210px]'>
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder='Search by claim text or platform'
                />

                {activeView === 'feed' ? (
                  <>
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
                        {platformOptions.map((platform) => (
                          <SelectItem key={platform.id} value={platform.id}>
                            {platform.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <p className='text-xs text-muted-foreground md:col-span-2 md:self-center'>
                    Manage your own community posts here. Editing text or platform resets verification.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {activeView === 'mine' && canParticipate ? (
            <Card className='border-emerald-500/40 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(14,165,233,0.1))]'>
              <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <p className='text-sm font-semibold'>Create a new community post</p>
                  <p className='text-xs text-muted-foreground'>
                    Open the composer to publish with multiple images and videos.
                  </p>
                </div>
                <Button
                  type='button'
                  size='sm'
                  className='min-h-10'
                  onClick={() => setIsCreatePanelOpen(true)}
                >
                  <Plus className='size-4' />
                  Create Post
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isActiveViewLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-52 rounded-3xl' />
              <Skeleton className='h-52 rounded-3xl' />
            </div>
          ) : activeView === 'feed' && filteredPosts.length === 0 ? (
            <Card className='border-dashed'>
              <CardContent className='p-6 text-sm text-muted-foreground'>
                No posts found. Be the first to publish a verified claim.
              </CardContent>
            </Card>
          ) : activeView === 'feed' ? (
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
                      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                        {post.media.map((media) => (
                          <a
                            key={media.id}
                            href={media.url}
                            target='_blank'
                            rel='noreferrer'
                            className='overflow-hidden rounded-xl border border-border/60'
                          >
                            {renderCommunityMediaPreview(media)}
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
                          className='min-h-10 w-full sm:w-auto'
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
                          className='min-h-10 w-full sm:w-auto'
                          disabled={reportPost.isPending}
                          onClick={() => void handleReport(post)}
                        >
                          Report
                        </Button>

                        {canRequestVerification ? (
                          <Button
                            type='button'
                            size='sm'
                            className='min-h-10 w-full sm:w-auto'
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
                            className='min-h-10 w-full sm:w-auto'
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
                        <div className='mt-3 flex flex-col gap-2 sm:flex-row'>
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
                            className='min-h-10 sm:min-w-28'
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
          ) : !isSignedIn ? (
            <Card className='border-dashed'>
              <CardContent className='p-6 text-sm text-muted-foreground'>
                Sign in to manage your posts.
              </CardContent>
            </Card>
          ) : !isWorker ? (
            <Card className='border-dashed'>
              <CardContent className='p-6 text-sm text-muted-foreground'>
                Only worker accounts can create and edit community posts.
              </CardContent>
            </Card>
          ) : filteredMyPosts.length === 0 ? (
            <Card className='border-dashed'>
              <CardContent className='p-6 text-sm text-muted-foreground'>
                You have not posted to the community yet.
              </CardContent>
            </Card>
          ) : (
            filteredMyPosts.map((post) => {
              const draft = editDrafts[post.id] ?? createEditDraft(post);
              const draftMedia = editMediaDrafts[post.id] ?? post.media.map(normalizeUploadedMedia);
              const editManualMediaUrl = editManualMediaUrls[post.id] ?? '';
              const isEditing = editingPostId === post.id;
              const isEditMediaUploading = Boolean(editUploadingByPost[post.id]);
              const canRequestVerification =
                post.verificationStatus === 'UNVERIFIED' ||
                post.verificationStatus === 'HUMAN_UNVERIFIED';
              const canRequestHumanReview =
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
                        <Badge variant='secondary'>
                          {post.isAnonymous ? 'Anonymous' : 'Public'}
                        </Badge>
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        Updated {prettyRelative(post.updatedAt)}
                      </p>
                    </div>

                    <CardTitle className='text-lg'>{post.title}</CardTitle>
                  </CardHeader>

                  <CardContent className='space-y-4'>
                    {isEditing ? (
                      <div className='space-y-3'>
                        <Input
                          value={draft.title}
                          onChange={(event) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [post.id]: {
                                ...draft,
                                title: event.target.value,
                              },
                            }))
                          }
                          maxLength={160}
                        />

                        <Textarea
                          rows={5}
                          value={draft.body}
                          onChange={(event) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [post.id]: {
                                ...draft,
                                body: event.target.value,
                              },
                            }))
                          }
                          maxLength={4000}
                        />

                        <Select
                          value={draft.platformId}
                          onValueChange={(value) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [post.id]: {
                                ...draft,
                                platformId: value ?? 'none',
                              },
                            }))
                          }
                        >
                          <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Platform (optional)'>
                              {platformLabel(draft.platformId)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='none'>No platform selected</SelectItem>
                            {platformOptions.map((platform) => (
                              <SelectItem key={platform.id} value={platform.id}>
                                {platform.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className='space-y-2'>
                          <p className='inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                            <ImageIcon className='size-3.5' />
                            <Video className='size-3.5' />
                            Add, remove, or replace up to {MAX_MEDIA_ITEMS} media items.
                          </p>

                          <UploadDropzone
                            endpoint='communityPostMediaUploader'
                            onUploadBegin={() => {
                              setEditUploadingByPost((prev) => ({
                                ...prev,
                                [post.id]: true,
                              }));
                            }}
                            onClientUploadComplete={(files) => {
                              setEditUploadingByPost((prev) => ({
                                ...prev,
                                [post.id]: false,
                              }));

                              const next = extractUploadedMediaItems(files);

                              if (next.length === 0) {
                                toast.error(
                                  'Upload finished but no media URL was returned. Try uploading again.',
                                );
                                return;
                              }

                              setEditMediaDrafts((prev) => ({
                                ...prev,
                                [post.id]: mergeUploadedMediaItems(prev[post.id] ?? draftMedia, next),
                              }));

                              toast.success('Evidence uploaded');
                            }}
                            onUploadError={(error) => {
                              setEditUploadingByPost((prev) => ({
                                ...prev,
                                [post.id]: false,
                              }));

                              toast.error(
                                error.message ||
                                  'Upload failed. You can add a media URL manually below.',
                              );
                            }}
                          />

                          <div className='flex flex-col gap-2 sm:flex-row'>
                            <Input
                              value={editManualMediaUrl}
                              onChange={(event) =>
                                setEditManualMediaUrls((prev) => ({
                                  ...prev,
                                  [post.id]: event.target.value,
                                }))
                              }
                              placeholder='Or paste a public media URL'
                            />
                            <Button
                              type='button'
                              variant='outline'
                              className='min-h-10 sm:min-w-32'
                              onClick={() => handleAddManualMediaUrlToEdit(post.id)}
                            >
                              Add URL
                            </Button>
                          </div>

                          {draftMedia.length > 0 ? (
                            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                              {draftMedia.map((media) => (
                                <div
                                  key={`${post.id}-${media.fileKey ?? media.url}`}
                                  className='relative overflow-hidden rounded-xl border border-border/60'
                                >
                                  {renderCommunityMediaPreview({
                                    url: media.url,
                                    mediaType: media.mediaType ?? 'IMAGE',
                                  })}
                                  <span className='absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white'>
                                    {normalizeMediaType(media.mediaType)}
                                  </span>
                                  <Button
                                    type='button'
                                    size='icon'
                                    variant='secondary'
                                    className='absolute right-1 top-1 size-7'
                                    onClick={() => {
                                      setEditMediaDrafts((prev) => ({
                                        ...prev,
                                        [post.id]: removeUploadedMediaItem(
                                          prev[post.id] ?? draftMedia,
                                          media,
                                        ),
                                      }));
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
                            checked={draft.isAnonymous}
                            onChange={(event) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [post.id]: {
                                  ...draft,
                                  isAnonymous: event.target.checked,
                                },
                              }))
                            }
                            className='size-4 rounded border border-input accent-primary'
                          />
                          Keep this post anonymous
                        </label>

                        <p className='text-xs text-muted-foreground'>
                          Updating title, body, platform, or media resets verification and clears pending review queue items.
                        </p>

                        <div className='flex flex-wrap gap-2'>
                          <Button
                            type='button'
                            className='min-h-10 w-full sm:w-auto'
                            disabled={updatePost.isPending || isEditMediaUploading}
                            onClick={() => void handleSaveEdit(post.id)}
                          >
                            {isEditMediaUploading ? 'Uploading media...' : 'Save Updates'}
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            className='min-h-10 w-full sm:w-auto'
                            onClick={() => handleCancelEdit(post.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className='text-sm leading-relaxed text-foreground/90'>{post.body}</p>

                        {post.media.length > 0 ? (
                          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                            {post.media.map((media) => (
                              <a
                                key={media.id}
                                href={media.url}
                                target='_blank'
                                rel='noreferrer'
                                className='overflow-hidden rounded-xl border border-border/60'
                              >
                                {renderCommunityMediaPreview(media)}
                              </a>
                            ))}
                          </div>
                        ) : null}

                        <div className='grid gap-2 text-xs text-muted-foreground sm:grid-cols-3'>
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

                        <div className='flex flex-wrap gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='min-h-10 w-full sm:w-auto'
                            disabled={updatePost.isPending}
                            onClick={() => handleEditStart(post)}
                          >
                            <PencilLine className='size-4' />
                            Edit Post
                          </Button>

                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='min-h-10 w-full sm:w-auto'
                            disabled={updatePost.isPending}
                            onClick={() => void handleToggleAnonymous(post)}
                          >
                            <UserRoundPen className='size-4' />
                            {post.isAnonymous ? 'Switch To Public' : 'Switch To Anonymous'}
                          </Button>

                          <Button
                            type='button'
                            variant='destructive'
                            size='sm'
                            className='min-h-10 w-full sm:w-auto'
                            disabled={deletePost.isPending}
                            onClick={() => void handleDeletePost(post)}
                          >
                            <Trash2 className='size-4' />
                            Delete Post
                          </Button>

                          {canRequestVerification ? (
                            <Button
                              type='button'
                              size='sm'
                              className='min-h-10 w-full sm:w-auto'
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
                              className='min-h-10 w-full sm:w-auto'
                              disabled={requestHumanReview.isPending}
                              onClick={() => requestHumanReview.mutate(post.id)}
                            >
                              Request Human Review
                            </Button>
                          ) : null}
                        </div>
                      </>
                    )}
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
