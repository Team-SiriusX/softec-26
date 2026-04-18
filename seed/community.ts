import 'dotenv/config';

import db from '@/lib/db';
import {
  CommunityPostVerificationStatus,
  CommunityReviewQueueReason,
  CommunityReviewQueueStatus,
  CommunityVoteType,
  Role,
} from '@/generated/prisma/enums';

const SEED_PREFIX = '[seed-community-v1]';
const DEMO_WORKER_EMAIL = 'test@gmail.com';
const DEMO_ADVOCATE_EMAIL = 'demo.advocate@seed.fairgig.local';

type VerificationStatus =
  (typeof CommunityPostVerificationStatus)[keyof typeof CommunityPostVerificationStatus];
type QueueReason =
  (typeof CommunityReviewQueueReason)[keyof typeof CommunityReviewQueueReason];
type QueueStatus =
  (typeof CommunityReviewQueueStatus)[keyof typeof CommunityReviewQueueStatus];

type SeedUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

type SeedBlueprint = {
  key: string;
  title: string;
  body: string;
  authorId: string;
  platformId: string | null;
  isAnonymous: boolean;
  verificationStatus: VerificationStatus;
  trustScore: number | null;
  verificationRequestedAt: Date | null;
  createdAt: Date;
  mediaUrls: string[];
  upvoteUserIds: string[];
  comments: Array<{
    authorId: string;
    content: string;
    isAnonymous?: boolean;
  }>;
  reports: Array<{
    userId: string;
    reason: string;
  }>;
  queueItems: Array<{
    reason: QueueReason;
    status: QueueStatus;
    triggeredByUserId?: string;
    note?: string;
    resolvedAt?: Date | null;
  }>;
};

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function pickDistinct(
  candidates: SeedUser[],
  count: number,
  excluded: string[] = [],
): SeedUser[] {
  const blocked = new Set(excluded);
  const chosen: SeedUser[] = [];

  for (const user of candidates) {
    if (blocked.has(user.id)) {
      continue;
    }

    chosen.push(user);
    blocked.add(user.id);

    if (chosen.length >= count) {
      break;
    }
  }

  return chosen;
}

async function syncPostCounters(postId: string): Promise<void> {
  const [upvoteCount, commentCount, reportCount] = await Promise.all([
    db.communityPostVote.count({ where: { postId } }),
    db.communityPostComment.count({ where: { postId } }),
    db.communityPostReport.count({ where: { postId } }),
  ]);

  await db.communityPost.update({
    where: { id: postId },
    data: {
      upvoteCount,
      commentCount,
      reportCount,
    },
  });
}

async function main() {
  const workers = await db.user.findMany({
    where: { role: Role.WORKER },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (workers.length < 5) {
    throw new Error('Not enough workers found. Run `pnpm seed` first.');
  }

  const reviewers = await db.user.findMany({
    where: { role: { in: [Role.ADVOCATE, Role.VERIFIER] } },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (reviewers.length === 0) {
    throw new Error('No advocate or verifier found. Run `pnpm seed` first.');
  }

  const preferredWorker =
    workers.find((user) => user.email.toLowerCase() === DEMO_WORKER_EMAIL) ??
    workers[0];

  const preferredAdvocate =
    reviewers.find((user) => user.email.toLowerCase() === DEMO_ADVOCATE_EMAIL) ??
    reviewers[0];

  const bySlug = new Map(
    (
      await db.platform.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
        },
      })
    ).map((platform) => [platform.slug, platform]),
  );

  const careemId = bySlug.get('careem')?.id ?? null;
  const uberId = bySlug.get('uber')?.id ?? null;
  const foodpandaId = bySlug.get('foodpanda')?.id ?? null;
  const bykeaId = bySlug.get('bykea')?.id ?? null;

  await db.communityPost.deleteMany({
    where: {
      OR: [
        { title: { startsWith: SEED_PREFIX } },
        { body: { contains: SEED_PREFIX } },
      ],
    },
  });

  const workerPool = workers;

  const postAUpvoters = pickDistinct(workerPool, 3, [preferredWorker.id]).map(
    (user) => user.id,
  );
  const postBUpvoters = pickDistinct(workerPool, 5, [workers[1].id]).map(
    (user) => user.id,
  );
  const postCUpvoters = pickDistinct(workerPool, 2, [preferredWorker.id]).map(
    (user) => user.id,
  );
  const postDUpvoters = pickDistinct(workerPool, 6, [workers[2].id]).map(
    (user) => user.id,
  );
  const postEUpvoters = pickDistinct(workerPool, 4, [workers[3].id]).map(
    (user) => user.id,
  );
  const postFUpvoters = pickDistinct(workerPool, 2, [preferredWorker.id]).map(
    (user) => user.id,
  );

  const postBReporters = pickDistinct(workerPool, 3, [workers[1].id]).map(
    (user) => user.id,
  );
  const postCReporters = pickDistinct(workerPool, 2, [preferredWorker.id]).map(
    (user) => user.id,
  );

  const now = new Date();

  const blueprints: SeedBlueprint[] = [
    {
      key: 'fresh-unverified',
      title: `${SEED_PREFIX} Commission drop after app update`,
      body:
        `${SEED_PREFIX} Last week my average payout per hour was around PKR 620. ` +
        'After the latest update, the same hours and distance are giving me around PKR 460. ' +
        'I have attached screenshots from two shifts and want the community to compare patterns.',
      authorId: preferredWorker.id,
      platformId: careemId,
      isAnonymous: false,
      verificationStatus: CommunityPostVerificationStatus.UNVERIFIED,
      trustScore: null,
      verificationRequestedAt: null,
      createdAt: hoursAgo(4),
      mediaUrls: [
        'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1280&q=80',
      ],
      upvoteUserIds: postAUpvoters,
      comments: [
        {
          authorId: workers[1].id,
          content: 'Same issue in Gulberg this week, especially in peak hours.',
        },
        {
          authorId: workers[2].id,
          content: 'Please include route distance if possible, that helps compare better.',
        },
      ],
      reports: [],
      queueItems: [],
    },
    {
      key: 'auto-ai-queue',
      title: `${SEED_PREFIX} Completed rides not reflected in payout`,
      body:
        `${SEED_PREFIX} Three completed rides are missing from my payout summary. ` +
        'Trip history shows completed but settlement does not include the amounts. ' +
        'Posting this because others reported a similar mismatch.',
      authorId: workers[1].id,
      platformId: uberId,
      isAnonymous: true,
      verificationStatus: CommunityPostVerificationStatus.PENDING_AI_REVIEW,
      trustScore: null,
      verificationRequestedAt: hoursAgo(18),
      createdAt: hoursAgo(20),
      mediaUrls: [
        'https://images.unsplash.com/photo-1494415859740-21e878dd929d?auto=format&fit=crop&w=1280&q=80',
      ],
      upvoteUserIds: postBUpvoters,
      comments: [
        {
          authorId: workers[3].id,
          content: 'I can confirm payout lag happened for me too yesterday.',
        },
        {
          authorId: workers[4].id,
          content: 'Support ticket reply was generic, no specific timeline given.',
        },
      ],
      reports: postBReporters.map((userId, index) => ({
        userId,
        reason: `Potentially inaccurate payout claim #${index + 1}`,
      })),
      queueItems: [
        {
          reason: CommunityReviewQueueReason.MULTIPLE_REPORTS,
          status: CommunityReviewQueueStatus.PENDING,
          triggeredByUserId: postBReporters[0],
          note: 'Auto-queued after repeated reports from workers',
        },
      ],
    },
    {
      key: 'ai-low-trust',
      title: `${SEED_PREFIX} AI marked this claim as low trust`,
      body:
        `${SEED_PREFIX} I requested verification and got a low-trust result. ` +
        'Numbers in the screenshots and transaction history are close but not exact. ' +
        'I will request human review from the board action next.',
      authorId: preferredWorker.id,
      platformId: foodpandaId,
      isAnonymous: false,
      verificationStatus: CommunityPostVerificationStatus.AI_UNVERIFIED_LOW_TRUST,
      trustScore: 0.41,
      verificationRequestedAt: hoursAgo(36),
      createdAt: hoursAgo(40),
      mediaUrls: [
        'https://images.unsplash.com/photo-1516383607781-913a19294fd1?auto=format&fit=crop&w=1280&q=80',
      ],
      upvoteUserIds: postCUpvoters,
      comments: [
        {
          authorId: workers[5].id,
          content: 'Try adding full settlement screenshot so advocate can compare line items.',
        },
      ],
      reports: postCReporters.map((userId, index) => ({
        userId,
        reason: `Conflicting details report #${index + 1}`,
      })),
      queueItems: [],
    },
    {
      key: 'pending-human',
      title: `${SEED_PREFIX} Awaiting human review after low trust`,
      body:
        `${SEED_PREFIX} AI score came low even though shift logs and receipts exist. ` +
        'Human review has been requested and this post should appear in advocate queue.',
      authorId: workers[2].id,
      platformId: bykeaId,
      isAnonymous: false,
      verificationStatus: CommunityPostVerificationStatus.PENDING_HUMAN_REVIEW,
      trustScore: 0.39,
      verificationRequestedAt: hoursAgo(28),
      createdAt: hoursAgo(30),
      mediaUrls: [
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1280&q=80',
      ],
      upvoteUserIds: postDUpvoters,
      comments: [
        {
          authorId: workers[6].id,
          content: 'This should be reviewed by advocate, evidence looks complete.',
        },
      ],
      reports: [],
      queueItems: [
        {
          reason: CommunityReviewQueueReason.TRUST_SCORE_LOW,
          status: CommunityReviewQueueStatus.PENDING,
          triggeredByUserId: workers[2].id,
          note: 'Author requested human review after low-trust outcome',
        },
      ],
    },
    {
      key: 'human-verified',
      title: `${SEED_PREFIX} Human review verified this payout dispute`,
      body:
        `${SEED_PREFIX} Advocate reviewed screenshots, raw shift logs, and support ticket thread. ` +
        'The claim was confirmed and marked as verified for community visibility.',
      authorId: workers[3].id,
      platformId: careemId,
      isAnonymous: false,
      verificationStatus: CommunityPostVerificationStatus.HUMAN_VERIFIED,
      trustScore: 0.83,
      verificationRequestedAt: hoursAgo(70),
      createdAt: hoursAgo(72),
      mediaUrls: [
        'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1280&q=80',
      ],
      upvoteUserIds: postEUpvoters,
      comments: [
        {
          authorId: workers[7].id,
          content: 'Thanks for sharing, this helps others file stronger evidence.',
        },
      ],
      reports: [],
      queueItems: [
        {
          reason: CommunityReviewQueueReason.TRUST_SCORE_LOW,
          status: CommunityReviewQueueStatus.RESOLVED,
          triggeredByUserId: workers[3].id,
          note: 'Resolved by advocate as verified',
          resolvedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        },
      ],
    },
    {
      key: 'human-unverified',
      title: `${SEED_PREFIX} Human review marked this claim unverified`,
      body:
        `${SEED_PREFIX} Evidence was incomplete and key screenshot timestamps did not match. ` +
        'Advocate completed review and marked the claim as unverified.',
      authorId: preferredWorker.id,
      platformId: uberId,
      isAnonymous: false,
      verificationStatus: CommunityPostVerificationStatus.HUMAN_UNVERIFIED,
      trustScore: 0.26,
      verificationRequestedAt: hoursAgo(55),
      createdAt: hoursAgo(58),
      mediaUrls: [
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1280&q=80',
      ],
      upvoteUserIds: postFUpvoters,
      comments: [
        {
          authorId: workers[8].id,
          content: 'This one needs stronger proof before escalation.',
        },
      ],
      reports: [],
      queueItems: [
        {
          reason: CommunityReviewQueueReason.TRUST_SCORE_LOW,
          status: CommunityReviewQueueStatus.RESOLVED,
          triggeredByUserId: preferredAdvocate.id,
          note: 'Resolved by advocate as unverified',
          resolvedAt: new Date(now.getTime() - 9 * 60 * 60 * 1000),
        },
      ],
    },
  ];

  for (const blueprint of blueprints) {
    const post = await db.communityPost.create({
      data: {
        authorId: blueprint.authorId,
        platformId: blueprint.platformId,
        title: blueprint.title,
        body: blueprint.body,
        isAnonymous: blueprint.isAnonymous,
        verificationStatus: blueprint.verificationStatus,
        trustScore: blueprint.trustScore,
        verificationRequestedAt: blueprint.verificationRequestedAt,
        createdAt: blueprint.createdAt,
        media:
          blueprint.mediaUrls.length > 0
            ? {
                create: blueprint.mediaUrls.map((url, index) => ({
                  url,
                  fileKey: `seed/community/${blueprint.key}/${index + 1}`,
                  mediaType: 'IMAGE',
                })),
              }
            : undefined,
      },
      select: { id: true },
    });

    const upvoteUserIds = unique(blueprint.upvoteUserIds).filter(
      (userId) => userId !== blueprint.authorId,
    );

    for (const userId of upvoteUserIds) {
      await db.communityPostVote.create({
        data: {
          postId: post.id,
          userId,
          voteType: CommunityVoteType.UPVOTE,
        },
      });
    }

    for (const comment of blueprint.comments) {
      await db.communityPostComment.create({
        data: {
          postId: post.id,
          authorId: comment.authorId,
          content: comment.content,
          isAnonymous: Boolean(comment.isAnonymous),
        },
      });
    }

    const reportRows = unique(blueprint.reports.map((report) => report.userId)).map(
      (userId, index) => ({
        userId,
        reason:
          blueprint.reports.find((report) => report.userId === userId)?.reason ??
          `Seed community report #${index + 1}`,
      }),
    );

    for (const report of reportRows) {
      await db.communityPostReport.create({
        data: {
          postId: post.id,
          userId: report.userId,
          reason: report.reason,
        },
      });
    }

    for (const queueItem of blueprint.queueItems) {
      await db.communityPostReviewQueue.create({
        data: {
          postId: post.id,
          triggeredByUserId: queueItem.triggeredByUserId,
          reason: queueItem.reason,
          status: queueItem.status,
          note: queueItem.note,
          resolvedAt: queueItem.resolvedAt,
        },
      });
    }

    await syncPostCounters(post.id);
  }

  const seededPosts = await db.communityPost.findMany({
    where: {
      title: { startsWith: SEED_PREFIX },
    },
    select: {
      id: true,
      title: true,
      verificationStatus: true,
      upvoteCount: true,
      commentCount: true,
      reportCount: true,
      trustScore: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const pendingQueueCount = await db.communityPostReviewQueue.count({
    where: { status: CommunityReviewQueueStatus.PENDING },
  });

  const statusBreakdown = await db.communityPost.groupBy({
    by: ['verificationStatus'],
    where: {
      title: { startsWith: SEED_PREFIX },
    },
    _count: { _all: true },
  });

  console.log('Community seed complete');
  console.log(`Seeded posts: ${seededPosts.length}`);
  console.log(`Pending queue items: ${pendingQueueCount}`);
  console.log('Status breakdown:', statusBreakdown);
  console.log(
    'Demo user credentials:',
    JSON.stringify(
      {
        worker: { email: DEMO_WORKER_EMAIL, password: '12345678' },
        advocate: { email: DEMO_ADVOCATE_EMAIL, password: '12345678' },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Community seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
