import { Prisma } from '@/generated/prisma/client';
import db from '@/lib/db';
import { Context } from 'hono';

import { runCommunityAiReview } from './ai-reviewer';

type SessionUser = {
  id: string;
  role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
  email: string;
  name: string;
};

type ListSort = 'hot' | 'new' | 'verified';

type PublicAuthor = {
  id: string;
  fullName: string;
  role: string;
};

type CommunityMediaKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

type PostMediaInput = {
  url: string;
  fileKey?: string;
  mediaType?: CommunityMediaKind;
};

const ANONYMOUS_AUTHOR: PublicAuthor = {
  id: 'anonymous',
  fullName: 'Anonymous User',
  role: 'WORKER',
};

const REPORT_THRESHOLD_FOR_AI_QUEUE = 3;
const AI_PASS_THRESHOLD = 0.65;
const MAX_MEDIA_ITEMS_PER_POST = 8;

const listInclude = {
  author: {
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  },
  platform: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  media: {
    select: {
      id: true,
      url: true,
      fileKey: true,
      mediaType: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
    take: MAX_MEDIA_ITEMS_PER_POST,
  },
  comments: {
    select: {
      id: true,
      content: true,
      isAnonymous: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
    take: 3,
  },
  _count: {
    select: {
      comments: true,
      votes: true,
      reports: true,
    },
  },
} satisfies Prisma.CommunityPostInclude;

const detailInclude = {
  author: {
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  },
  platform: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  media: {
    select: {
      id: true,
      url: true,
      fileKey: true,
      mediaType: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  comments: {
    select: {
      id: true,
      content: true,
      isAnonymous: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
    take: 60,
  },
  _count: {
    select: {
      comments: true,
      votes: true,
      reports: true,
    },
  },
} satisfies Prisma.CommunityPostInclude;

type ListPost = Prisma.CommunityPostGetPayload<{ include: typeof listInclude }>;
type DetailPost = Prisma.CommunityPostGetPayload<{ include: typeof detailInclude }>;

function getUser(c: Context): SessionUser | null {
  const user = c.var.user as SessionUser | undefined;
  if (!user?.id) {
    return null;
  }

  return user;
}

function isModerator(user: SessionUser): boolean {
  return user.role === 'ADVOCATE' || user.role === 'VERIFIER';
}

function isWorker(user: SessionUser): boolean {
  return user.role === 'WORKER';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isVerifiedStatus(status: string): boolean {
  return status === 'AI_VERIFIED' || status === 'HUMAN_VERIFIED';
}

function makePublicAuthor(author: ListPost['author'] | DetailPost['author'] | null): PublicAuthor {
  if (!author) {
    return ANONYMOUS_AUTHOR;
  }

  return {
    id: author.id,
    fullName: author.fullName,
    role: author.role,
  };
}

function serializeListPost(post: ListPost) {
  const author = post.isAnonymous ? ANONYMOUS_AUTHOR : makePublicAuthor(post.author);

  return {
    id: post.id,
    title: post.title,
    body: post.body,
    author,
    authorId: post.authorId,
    isAnonymous: post.isAnonymous,
    platform: post.platform,
    verificationStatus: post.verificationStatus,
    verificationRequestedAt: post.verificationRequestedAt,
    trustScore: post.trustScore ? Number(post.trustScore) : null,
    upvoteCount: post.upvoteCount,
    commentCount: post.commentCount,
    reportCount: post.reportCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    media: post.media,
    commentsPreview: post.comments.map((comment) => ({
      ...comment,
      author: comment.isAnonymous
        ? ANONYMOUS_AUTHOR
        : makePublicAuthor(comment.author),
    })),
    counts: {
      comments: post._count.comments,
      upvotes: post._count.votes,
      reports: post._count.reports,
    },
  };
}

function serializeDetailPost(post: DetailPost) {
  const author = post.isAnonymous ? ANONYMOUS_AUTHOR : makePublicAuthor(post.author);

  return {
    id: post.id,
    title: post.title,
    body: post.body,
    author,
    authorId: post.authorId,
    isAnonymous: post.isAnonymous,
    platform: post.platform,
    verificationStatus: post.verificationStatus,
    verificationRequestedAt: post.verificationRequestedAt,
    trustScore: post.trustScore ? Number(post.trustScore) : null,
    upvoteCount: post.upvoteCount,
    commentCount: post.commentCount,
    reportCount: post.reportCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    media: post.media,
    comments: post.comments.map((comment) => ({
      ...comment,
      author: comment.isAnonymous
        ? ANONYMOUS_AUTHOR
        : makePublicAuthor(comment.author),
    })),
    counts: {
      comments: post._count.comments,
      upvotes: post._count.votes,
      reports: post._count.reports,
    },
  };
}

function computeFeedScore(post: {
  createdAt: Date;
  upvoteCount: number;
  commentCount: number;
  verificationStatus: string;
  reportCount: number;
}): number {
  const ageHours = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
  const todayBoost = ageHours <= 24 ? 6 : 0;
  const upvoteSignal = post.upvoteCount * 3;
  const commentSignal = post.commentCount * 1;
  const verificationBoost = isVerifiedStatus(post.verificationStatus) ? 10 : 0;
  const reportPenalty = post.reportCount * 2;
  const timeDecay = Math.floor(ageHours / 12);

  return upvoteSignal + commentSignal + verificationBoost + todayBoost - reportPenalty - timeDecay;
}

function computeMockTrustScore(post: {
  upvoteCount: number;
  reportCount: number;
  commentCount: number;
  mediaCount: number;
}): number {
  const raw =
    0.45 +
    post.upvoteCount * 0.03 +
    post.commentCount * 0.02 +
    post.mediaCount * 0.06 -
    post.reportCount * 0.12;

  return clamp(raw, 0.01, 0.99);
}

function normalizeMediaInput(media: PostMediaInput[] | undefined): Array<{
  url: string;
  fileKey?: string;
  mediaType: CommunityMediaKind;
}> {
  if (!media?.length) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: Array<{
    url: string;
    fileKey?: string;
    mediaType: CommunityMediaKind;
  }> = [];

  for (const item of media) {
    const url = item.url.trim();
    if (!url) {
      continue;
    }

    const fileKey = item.fileKey?.trim() || undefined;
    const mediaType = item.mediaType ?? 'IMAGE';
    const dedupeKey = fileKey ? `file:${fileKey}` : `url:${url}`;

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push({
      url,
      fileKey,
      mediaType,
    });

    if (normalized.length >= MAX_MEDIA_ITEMS_PER_POST) {
      break;
    }
  }

  return normalized;
}

function mapCommunityMediaSchemaError(error: unknown): string | null {
  const topLevelMessage = error instanceof Error ? error.message : '';
  const cause =
    error && typeof error === 'object' && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined;

  const causeCode =
    cause && typeof cause === 'object' && 'code' in cause
      ? (cause as { code?: unknown }).code
      : undefined;
  const causeMessage =
    cause && typeof cause === 'object' && 'message' in cause
      ? (cause as { message?: unknown }).message
      : undefined;

  const combined = `${topLevelMessage} ${
    typeof causeMessage === 'string' ? causeMessage : ''
  }`.toLowerCase();

  const isMissingTypeError = causeCode === '42704' || combined.includes('does not exist');

  if (isMissingTypeError && combined.includes('communitymediatype')) {
    return 'Database schema for community media is out of sync. Run "pnpm prisma db push --accept-data-loss" and restart the server.';
  }

  return null;
}

async function ensurePendingQueueItem(params: {
  postId: string;
  reason: 'USER_REQUEST' | 'MULTIPLE_REPORTS' | 'TRUST_SCORE_LOW';
  triggeredByUserId?: string;
  note?: string;
}) {
  const existing = await db.communityPostReviewQueue.findFirst({
    where: {
      postId: params.postId,
      reason: params.reason,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const queueItem = await db.communityPostReviewQueue.create({
    data: {
      postId: params.postId,
      reason: params.reason,
      triggeredByUserId: params.triggeredByUserId,
      note: params.note,
      status: 'PENDING',
    },
    select: { id: true },
  });

  return queueItem.id;
}

// ─── GET /api/community/platforms ───────────────────────────────────────────
export const listPlatforms = async () => {
  const platforms = await db.platform.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return new Response(JSON.stringify({ data: platforms }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// ─── GET /api/community/posts ────────────────────────────────────────────────
export const listPosts = async (c: Context) => {
  const query = (c.req as unknown as { valid: (target: 'query') => unknown }).valid('query') as {
    sort: ListSort;
    platformId?: string;
    limit: number;
    offset: number;
  };

  const where: Prisma.CommunityPostWhereInput = {};

  if (query.platformId) {
    where.platformId = query.platformId;
  }

  if (query.sort === 'verified') {
    where.verificationStatus = {
      in: ['AI_VERIFIED', 'HUMAN_VERIFIED'],
    };
  }

  if (query.sort === 'hot') {
    const warmSet = await db.communityPost.findMany({
      where,
      include: listInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.max(120, query.limit * 6),
    });

    const ranked = warmSet
      .map((post) => ({
        post,
        score: computeFeedScore(post),
      }))
      .sort((a, b) => b.score - a.score || b.post.createdAt.getTime() - a.post.createdAt.getTime());

    const sliced = ranked.slice(query.offset, query.offset + query.limit).map((entry) => serializeListPost(entry.post));

    return c.json({
      data: sliced,
      meta: {
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
        total: ranked.length,
        hasMore: query.offset + query.limit < ranked.length,
      },
    });
  }

  const orderBy: Prisma.CommunityPostOrderByWithRelationInput[] =
    query.sort === 'verified'
      ? [{ upvoteCount: 'desc' }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }];

  const [posts, total] = await Promise.all([
    db.communityPost.findMany({
      where,
      include: listInclude,
      orderBy,
      skip: query.offset,
      take: query.limit,
    }),
    db.communityPost.count({ where }),
  ]);

  return c.json({
    data: posts.map(serializeListPost),
    meta: {
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      total,
      hasMore: query.offset + query.limit < total,
    },
  });
};

// ─── GET /api/community/posts/mine ─────────────────────────────────────────
export const listMyPosts = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can access personal community posts' }, 403);
  }

  const query = (c.req as unknown as { valid: (target: 'query') => unknown }).valid('query') as {
    limit: number;
    offset: number;
  };

  const where: Prisma.CommunityPostWhereInput = {
    authorId: user.id,
  };

  const [posts, total] = await Promise.all([
    db.communityPost.findMany({
      where,
      include: listInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip: query.offset,
      take: query.limit,
    }),
    db.communityPost.count({ where }),
  ]);

  return c.json({
    data: posts.map(serializeListPost),
    meta: {
      sort: 'new' as const,
      limit: query.limit,
      offset: query.offset,
      total,
      hasMore: query.offset + query.limit < total,
    },
  });
};

// ─── GET /api/community/posts/:id ───────────────────────────────────────────
export const getPost = async (c: Context) => {
  const id = c.req.param('id');

  if (!id) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const post = await db.communityPost.findUnique({
    where: { id },
    include: detailInclude,
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  return c.json({ data: serializeDetailPost(post) });
};

// ─── POST /api/community/posts ───────────────────────────────────────────────
export const createPost = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can create community posts' }, 403);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    title: string;
    body: string;
    platformId?: string;
    isAnonymous?: boolean;
    media?: PostMediaInput[];
  };

  const normalizedMedia = normalizeMediaInput(body.media);

  if (body.platformId) {
    const platformExists = await db.platform.findUnique({
      where: { id: body.platformId },
      select: { id: true },
    });

    if (!platformExists) {
      return c.json({ error: 'Platform not found' }, 404);
    }
  }

  let created: DetailPost;

  try {
    created = await db.communityPost.create({
      data: {
        authorId: user.id,
        platformId: body.platformId ?? null,
        title: body.title.trim(),
        body: body.body.trim(),
        isAnonymous: Boolean(body.isAnonymous),
        media: normalizedMedia.length
          ? {
              create: normalizedMedia.map((item) => ({
                url: item.url,
                fileKey: item.fileKey,
                mediaType: item.mediaType,
              })),
            }
          : undefined,
      },
      include: detailInclude,
    });
  } catch (error) {
    const schemaError = mapCommunityMediaSchemaError(error);

    if (schemaError) {
      return c.json({ error: schemaError }, 500);
    }

    console.error('Community post create failed', {
      userId: user.id,
      error,
    });

    return c.json({ error: 'Failed to create post' }, 500);
  }

  return c.json({ data: serializeDetailPost(created) }, 201);
};

// ─── PATCH /api/community/posts/:id ────────────────────────────────────────
export const updatePost = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can edit community posts' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    title?: string;
    body?: string;
    platformId?: string | null;
    isAnonymous?: boolean;
    media?: PostMediaInput[];
  };

  const platformIdProvided = 'platformId' in body;
  const anonymityProvided = 'isAnonymous' in body;
  const mediaProvided = 'media' in body;

  if (platformIdProvided && body.platformId) {
    const platformExists = await db.platform.findUnique({
      where: { id: body.platformId },
      select: { id: true },
    });

    if (!platformExists) {
      return c.json({ error: 'Platform not found' }, 404);
    }
  }

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      title: true,
      body: true,
      platformId: true,
      isAnonymous: true,
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (post.authorId !== user.id) {
    return c.json({ error: 'Only the post author can edit this post' }, 403);
  }

  const nextTitle = body.title?.trim();
  const nextBody = body.body?.trim();
  const nextPlatformId = platformIdProvided ? body.platformId ?? null : post.platformId;
  const nextAnonymous = anonymityProvided ? Boolean(body.isAnonymous) : post.isAnonymous;
  const normalizedMedia = mediaProvided ? normalizeMediaInput(body.media) : undefined;

  const didTitleChange = nextTitle !== undefined && nextTitle !== post.title;
  const didBodyChange = nextBody !== undefined && nextBody !== post.body;
  const didPlatformChange = platformIdProvided && nextPlatformId !== post.platformId;
  const didAnonymityChange = anonymityProvided && nextAnonymous !== post.isAnonymous;
  const didMediaChange = mediaProvided;

  if (
    !didTitleChange &&
    !didBodyChange &&
    !didPlatformChange &&
    !didAnonymityChange &&
    !didMediaChange
  ) {
    const unchanged = await db.communityPost.findUnique({
      where: { id: postId },
      include: detailInclude,
    });

    if (!unchanged) {
      return c.json({ error: 'Post not found' }, 404);
    }

    return c.json({ data: serializeDetailPost(unchanged) });
  }

  const contentChanged =
    didTitleChange ||
    didBodyChange ||
    didPlatformChange ||
    didMediaChange;

  let updated: DetailPost;

  try {
    updated = await db.$transaction(async (tx) => {
      if (mediaProvided) {
        await tx.communityPostMedia.deleteMany({
          where: { postId },
        });
      }

      const updateData: Prisma.CommunityPostUpdateInput = {};

      if (nextTitle !== undefined) {
        updateData.title = nextTitle;
      }

      if (nextBody !== undefined) {
        updateData.body = nextBody;
      }

      if (platformIdProvided) {
        updateData.platform = nextPlatformId
          ? {
              connect: {
                id: nextPlatformId,
              },
            }
          : {
              disconnect: true,
            };
      }

      if (anonymityProvided) {
        updateData.isAnonymous = nextAnonymous;
      }

      if (mediaProvided && normalizedMedia && normalizedMedia.length > 0) {
        updateData.media = {
          create: normalizedMedia.map((item) => ({
            url: item.url,
            fileKey: item.fileKey,
            mediaType: item.mediaType,
          })),
        };
      }

      if (contentChanged) {
        updateData.verificationStatus = 'UNVERIFIED';
        updateData.trustScore = null;
        updateData.verificationRequestedAt = null;
      }

      const nextPost = await tx.communityPost.update({
        where: { id: postId },
        data: updateData,
        include: detailInclude,
      });

      if (contentChanged) {
        await tx.communityPostReviewQueue.updateMany({
          where: {
            postId,
            status: 'PENDING',
          },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            note: 'Auto-closed because the post content was edited by the author',
          },
        });
      }

      return nextPost;
    });
  } catch (error) {
    const schemaError = mapCommunityMediaSchemaError(error);

    if (schemaError) {
      return c.json({ error: schemaError }, 500);
    }

    console.error('Community post update failed', {
      postId,
      userId: user.id,
      error,
    });

    return c.json({ error: 'Failed to update post' }, 500);
  }

  return c.json({ data: serializeDetailPost(updated) });
};

// ─── DELETE /api/community/posts/:id ───────────────────────────────────────
export const deletePost = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can delete community posts' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (post.authorId !== user.id) {
    return c.json({ error: 'Only the post author can delete this post' }, 403);
  }

  await db.$transaction(async (tx) => {
    await tx.communityPost.delete({
      where: { id: postId },
    });
  });

  return c.json({
    data: {
      id: postId,
      deleted: true,
    },
  });
};

// ─── POST /api/community/posts/:id/upvote ───────────────────────────────────
export const toggleUpvote = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can vote on community posts' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          upvoteCount: true,
        },
      });

      if (!post) {
        return { notFound: true as const };
      }

      const existingVote = await tx.communityPostVote.findUnique({
        where: {
          postId_userId: {
            postId,
            userId: user.id,
          },
        },
      });

      if (existingVote) {
        const nextCount = Math.max(post.upvoteCount - 1, 0);

        await tx.communityPostVote.delete({
          where: {
            postId_userId: {
              postId,
              userId: user.id,
            },
          },
        });

        const updated = await tx.communityPost.update({
          where: { id: postId },
          data: { upvoteCount: nextCount },
          select: {
            upvoteCount: true,
          },
        });

        return {
          notFound: false as const,
          upvoted: false,
          upvoteCount: updated.upvoteCount,
        };
      }

      await tx.communityPostVote.create({
        data: {
          postId,
          userId: user.id,
          voteType: 'UPVOTE',
        },
      });

      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: {
          upvoteCount: {
            increment: 1,
          },
        },
        select: {
          upvoteCount: true,
        },
      });

      return {
        notFound: false as const,
        upvoted: true,
        upvoteCount: updated.upvoteCount,
      };
    });

    if (result.notFound) {
      return c.json({ error: 'Post not found' }, 404);
    }

    return c.json(result);
  } catch {
    return c.json({ error: 'Failed to toggle upvote' }, 500);
  }
};

// ─── POST /api/community/posts/:id/comments ─────────────────────────────────
export const createComment = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can comment on community posts' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    content: string;
    isAnonymous?: boolean;
  };

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.communityPostComment.create({
      data: {
        postId,
        authorId: user.id,
        content: body.content.trim(),
        isAnonymous: Boolean(body.isAnonymous),
      },
      select: {
        id: true,
        content: true,
        isAnonymous: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    await tx.communityPost.update({
      where: { id: postId },
      data: {
        commentCount: {
          increment: 1,
        },
      },
      select: { id: true },
    });

    return created;
  });

  return c.json(
    {
      data: {
        ...comment,
        author: comment.isAnonymous
          ? ANONYMOUS_AUTHOR
          : makePublicAuthor(comment.author),
      },
    },
    201,
  );
};

// ─── POST /api/community/posts/:id/reports ──────────────────────────────────
export const reportPost = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can report community posts' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    reason: string;
  };

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      reportCount: true,
      verificationStatus: true,
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const duplicateReport = await db.communityPostReport.findUnique({
    where: {
      postId_userId: {
        postId,
        userId: user.id,
      },
    },
    select: { id: true },
  });

  if (duplicateReport) {
    return c.json({ error: 'You already reported this post' }, 409);
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.communityPostReport.create({
      data: {
        postId,
        userId: user.id,
        reason: body.reason.trim(),
      },
    });

    return tx.communityPost.update({
      where: { id: postId },
      data: {
        reportCount: {
          increment: 1,
        },
      },
      select: {
        reportCount: true,
      },
    });
  });

  const queuedForAi = updated.reportCount >= REPORT_THRESHOLD_FOR_AI_QUEUE;

  if (queuedForAi) {
    await ensurePendingQueueItem({
      postId,
      reason: 'MULTIPLE_REPORTS',
      triggeredByUserId: user.id,
      note: `Auto-queued after reaching ${updated.reportCount} reports`,
    });

    if (post.verificationStatus === 'UNVERIFIED' || post.verificationStatus === 'HUMAN_UNVERIFIED') {
      await db.communityPost.update({
        where: { id: postId },
        data: {
          verificationStatus: 'PENDING_AI_REVIEW',
          verificationRequestedAt: new Date(),
        },
      });
    }
  }

  return c.json({
    data: {
      reportCount: updated.reportCount,
      queuedForAi,
    },
  });
};

// ─── POST /api/community/posts/:id/request-verification ─────────────────────
export const requestVerification = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can request verification' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      verificationStatus: true,
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (post.authorId !== user.id) {
    return c.json({ error: 'Only the post author can request verification' }, 403);
  }

  if (
    post.verificationStatus !== 'UNVERIFIED' &&
    post.verificationStatus !== 'HUMAN_UNVERIFIED'
  ) {
    return c.json({ error: 'Verification cannot be requested in the current state' }, 409);
  }

  await ensurePendingQueueItem({
    postId,
    reason: 'USER_REQUEST',
    triggeredByUserId: user.id,
    note: 'Author requested verification',
  });

  const updated = await db.communityPost.update({
    where: { id: postId },
    data: {
      verificationStatus: 'PENDING_AI_REVIEW',
      verificationRequestedAt: new Date(),
    },
    select: {
      id: true,
      verificationStatus: true,
      verificationRequestedAt: true,
    },
  });

  return c.json({ data: updated });
};

// ─── POST /api/community/posts/:id/request-human-review ─────────────────────
export const requestHumanReview = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isWorker(user)) {
    return c.json({ error: 'Only workers can request human review' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      verificationStatus: true,
      trustScore: true,
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (post.authorId !== user.id) {
    return c.json({ error: 'Only the post author can request human review' }, 403);
  }

  const trustScore = post.trustScore ? Number(post.trustScore) : null;
  const isLowTrust = trustScore !== null && trustScore < AI_PASS_THRESHOLD;

  if (
    post.verificationStatus !== 'AI_UNVERIFIED_LOW_TRUST' &&
    !isLowTrust
  ) {
    return c.json(
      {
        error:
          'Human review can only be requested after low-trust AI outcome',
      },
      409,
    );
  }

  await ensurePendingQueueItem({
    postId,
    reason: 'TRUST_SCORE_LOW',
    triggeredByUserId: user.id,
    note: 'Author requested human review after low-trust AI assessment',
  });

  const updated = await db.communityPost.update({
    where: { id: postId },
    data: {
      verificationStatus: 'PENDING_HUMAN_REVIEW',
    },
    select: {
      id: true,
      verificationStatus: true,
      trustScore: true,
    },
  });

  return c.json({
    data: {
      ...updated,
      trustScore: updated.trustScore ? Number(updated.trustScore) : null,
    },
  });
};

// ─── GET /api/community/moderation/queue ────────────────────────────────────
export const getModerationQueue = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isModerator(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const queue = await db.communityPostReviewQueue.findMany({
    where: {
      status: 'PENDING',
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 200,
    include: {
      post: {
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          platform: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          media: {
            select: {
              id: true,
              url: true,
              mediaType: true,
            },
            take: 1,
          },
        },
      },
      triggeredBy: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  return c.json({
    data: queue.map((item) => ({
      id: item.id,
      reason: item.reason,
      status: item.status,
      note: item.note,
      createdAt: item.createdAt,
      triggeredBy: item.triggeredBy,
      post: {
        id: item.post.id,
        title: item.post.title,
        body: item.post.body,
        author:
          item.post.isAnonymous
            ? ANONYMOUS_AUTHOR
            : makePublicAuthor(item.post.author),
        verificationStatus: item.post.verificationStatus,
        trustScore: item.post.trustScore ? Number(item.post.trustScore) : null,
        upvoteCount: item.post.upvoteCount,
        commentCount: item.post.commentCount,
        reportCount: item.post.reportCount,
        platform: item.post.platform,
        mediaPreview: item.post.media[0] ?? null,
      },
    })),
  });
};

// ─── PATCH /api/community/moderation/posts/:id/ai-review ───────────────────
export const runAiReview = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isModerator(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    note?: string;
    includeRawResponse?: boolean;
  };

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      verificationStatus: true,
      upvoteCount: true,
      commentCount: true,
      reportCount: true,
      platform: {
        select: {
          name: true,
          slug: true,
        },
      },
      media: {
        select: {
          id: true,
          url: true,
          mediaType: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: MAX_MEDIA_ITEMS_PER_POST,
      },
      comments: {
        select: {
          id: true,
          content: true,
          isAnonymous: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      },
      reports: {
        select: {
          reason: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      },
      reviewQueue: {
        where: {
          status: 'PENDING',
        },
        select: {
          reason: true,
        },
      },
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  let aiReviewRun: Awaited<ReturnType<typeof runCommunityAiReview>>;

  try {
    aiReviewRun = await runCommunityAiReview(
      {
        postId: post.id,
        title: post.title,
        body: post.body,
        createdAt: post.createdAt.toISOString(),
        platform: post.platform,
        upvoteCount: post.upvoteCount,
        commentCount: post.commentCount,
        reportCount: post.reportCount,
        media: post.media,
        recentComments: post.comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          isAnonymous: comment.isAnonymous,
          createdAt: comment.createdAt.toISOString(),
        })),
        reportReasons: post.reports.map((report) => report.reason),
        pendingQueueReasons: post.reviewQueue.map((item) => item.reason),
        moderatorNote: body.note?.trim() || undefined,
      },
      {
        includeRawResponse: Boolean(body.includeRawResponse),
      },
    );
  } catch (error) {
    console.error('Community AI review failed', {
      postId,
      reviewerId: user.id,
      error,
    });

    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to run AI review';

    return c.json({ error: message }, 502);
  }

  const trustScore = clamp(aiReviewRun.decision.trustScore, 0.01, 0.99);
  const nextStatus = aiReviewRun.decision.verdict;

  const resolvedNote = [
    `AI review completed with ${(trustScore * 100).toFixed(0)}% trust via ${aiReviewRun.model}.`,
    aiReviewRun.decision.summary,
    body.note?.trim() ? `Moderator note: ${body.note.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  await db.$transaction(async (tx) => {
    await tx.communityPost.update({
      where: { id: postId },
      data: {
        verificationStatus: nextStatus,
        trustScore,
      },
    });

    await tx.communityPostReviewQueue.updateMany({
      where: {
        postId,
        status: 'PENDING',
        reason: {
          in: ['USER_REQUEST', 'MULTIPLE_REPORTS'],
        },
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        note: resolvedNote,
      },
    });
  });

  if (nextStatus === 'AI_UNVERIFIED_LOW_TRUST') {
    await ensurePendingQueueItem({
      postId,
      reason: 'TRUST_SCORE_LOW',
      triggeredByUserId: user.id,
      note: [
        `AI reviewer recommendation: ${aiReviewRun.decision.recommendation}.`,
        aiReviewRun.decision.summary,
      ].join(' '),
    });
  }

  return c.json({
    data: {
      id: postId,
      verificationStatus: nextStatus,
      trustScore,
      aiReview: {
        provider: aiReviewRun.provider,
        model: aiReviewRun.model,
        promptVersion: aiReviewRun.promptVersion,
        latencyMs: aiReviewRun.latencyMs,
        trustScore,
        verdict: aiReviewRun.decision.verdict,
        confidence: aiReviewRun.decision.confidence,
        recommendation: aiReviewRun.decision.recommendation,
        summary: aiReviewRun.decision.summary,
        reasons: aiReviewRun.decision.reasons,
        riskFlags: aiReviewRun.decision.riskFlags,
        usage: aiReviewRun.usage,
        ...(body.includeRawResponse
          ? {
              rawResponse: aiReviewRun.rawResponse ?? null,
            }
          : {}),
      },
    },
  });
};

// ─── PATCH /api/community/moderation/posts/:id/mock-ai-review ───────────────
export const runMockAiReview = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isModerator(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    trustScore?: number;
    note?: string;
  };

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      upvoteCount: true,
      commentCount: true,
      reportCount: true,
      media: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const trustScore =
    typeof body.trustScore === 'number'
      ? clamp(body.trustScore, 0.01, 0.99)
      : computeMockTrustScore({
          upvoteCount: post.upvoteCount,
          commentCount: post.commentCount,
          reportCount: post.reportCount,
          mediaCount: post.media.length,
        });

  const nextStatus =
    trustScore >= AI_PASS_THRESHOLD
      ? 'AI_VERIFIED'
      : 'AI_UNVERIFIED_LOW_TRUST';

  await db.$transaction(async (tx) => {
    await tx.communityPost.update({
      where: { id: postId },
      data: {
        verificationStatus: nextStatus,
        trustScore,
      },
    });

    await tx.communityPostReviewQueue.updateMany({
      where: {
        postId,
        status: 'PENDING',
        reason: {
          in: ['USER_REQUEST', 'MULTIPLE_REPORTS'],
        },
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        note: body.note ?? `Mock AI review completed by ${user.role.toLowerCase()}`,
      },
    });
  });

  if (nextStatus === 'AI_UNVERIFIED_LOW_TRUST') {
    await ensurePendingQueueItem({
      postId,
      reason: 'TRUST_SCORE_LOW',
      triggeredByUserId: user.id,
      note: 'Low trust-score outcome requires human review',
    });
  }

  return c.json({
    data: {
      id: postId,
      verificationStatus: nextStatus,
      trustScore,
    },
  });
};

// ─── PATCH /api/community/moderation/posts/:id/human-review ─────────────────
export const submitHumanReview = async (c: Context) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!isModerator(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const postId = c.req.param('id');

  if (!postId) {
    return c.json({ error: 'Post id is required' }, 400);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    verdict: 'VERIFIED' | 'UNVERIFIED';
    note?: string;
  };

  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      trustScore: true,
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const nextStatus =
    body.verdict === 'VERIFIED'
      ? 'HUMAN_VERIFIED'
      : 'HUMAN_UNVERIFIED';

  await db.$transaction(async (tx) => {
    await tx.communityPost.update({
      where: { id: postId },
      data: {
        verificationStatus: nextStatus,
      },
    });

    await tx.communityPostReviewQueue.updateMany({
      where: {
        postId,
        status: 'PENDING',
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        note: body.note ?? `Human review completed by ${user.role.toLowerCase()}`,
      },
    });
  });

  return c.json({
    data: {
      id: postId,
      verificationStatus: nextStatus,
      trustScore: post.trustScore ? Number(post.trustScore) : null,
    },
  });
};
