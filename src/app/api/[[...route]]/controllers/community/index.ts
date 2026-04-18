import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createComment,
  createPost,
  getModerationQueue,
  getPost,
  listPlatforms,
  listPosts,
  reportPost,
  requestHumanReview,
  requestVerification,
  runMockAiReview,
  submitHumanReview,
  toggleUpvote,
} from './handlers';

const listPostsQuerySchema = z.object({
  sort: z.enum(['hot', 'new', 'verified']).default('hot'),
  platformId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const createPostSchema = z.object({
  title: z.string().trim().min(8).max(160),
  body: z.string().trim().min(20).max(4000),
  platformId: z.string().optional(),
  isAnonymous: z.boolean().optional().default(false),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        fileKey: z.string().min(1).optional(),
        mediaType: z.string().min(3).max(24).optional(),
      }),
    )
    .max(4)
    .optional(),
});

const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(1000),
  isAnonymous: z.boolean().optional().default(false),
});

const reportPostSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});

const mockAiReviewSchema = z.object({
  trustScore: z.number().min(0).max(1).optional(),
  note: z.string().trim().min(3).max(500).optional(),
});

const humanReviewSchema = z.object({
  verdict: z.enum(['VERIFIED', 'UNVERIFIED']),
  note: z.string().trim().min(3).max(500).optional(),
});

const app = new Hono()
  .get('/platforms', listPlatforms)
  .get('/posts', zValidator('query', listPostsQuerySchema), listPosts)
  .get('/posts/:id', getPost)
  .post('/posts', authMiddleware, zValidator('json', createPostSchema), createPost)
  .post('/posts/:id/upvote', authMiddleware, toggleUpvote)
  .post(
    '/posts/:id/comments',
    authMiddleware,
    zValidator('json', createCommentSchema),
    createComment,
  )
  .post(
    '/posts/:id/reports',
    authMiddleware,
    zValidator('json', reportPostSchema),
    reportPost,
  )
  .post('/posts/:id/request-verification', authMiddleware, requestVerification)
  .post('/posts/:id/request-human-review', authMiddleware, requestHumanReview)
  .get('/moderation/queue', authMiddleware, getModerationQueue)
  .patch(
    '/moderation/posts/:id/mock-ai-review',
    authMiddleware,
    zValidator('json', mockAiReviewSchema),
    runMockAiReview,
  )
  .patch(
    '/moderation/posts/:id/human-review',
    authMiddleware,
    zValidator('json', humanReviewSchema),
    submitHumanReview,
  );

export default app;
