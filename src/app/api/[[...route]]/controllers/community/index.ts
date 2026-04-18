import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createComment,
  createPost,
  deletePost,
  getModerationQueue,
  getPost,
  listMyPosts,
  listPlatforms,
  listPosts,
  reportPost,
  runAiReview,
  requestHumanReview,
  requestVerification,
  runMockAiReview,
  submitHumanReview,
  toggleUpvote,
  updatePost,
} from './handlers';

const listPostsQuerySchema = z.object({
  sort: z.enum(['hot', 'new', 'verified']).default('hot'),
  platformId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const listMyPostsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const communityMediaSchema = z.object({
  url: z.string().url(),
  fileKey: z.string().min(1).optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
});

const createPostSchema = z.object({
  title: z.string().trim().min(8).max(160),
  body: z.string().trim().min(20).max(4000),
  platformId: z.string().optional(),
  isAnonymous: z.boolean().optional().default(false),
  media: z.array(communityMediaSchema).max(8).optional(),
});

const updatePostSchema = z
  .object({
    title: z.string().trim().min(8).max(160).optional(),
    body: z.string().trim().min(20).max(4000).optional(),
    platformId: z.string().nullable().optional(),
    isAnonymous: z.boolean().optional(),
    media: z.array(communityMediaSchema).max(8).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable field is required',
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

const aiReviewSchema = z.object({
  note: z.string().trim().min(3).max(500).optional(),
  includeRawResponse: z.boolean().optional().default(false),
});

const humanReviewSchema = z.object({
  verdict: z.enum(['VERIFIED', 'UNVERIFIED']),
  note: z.string().trim().min(3).max(500).optional(),
});

const app = new Hono()
  .get('/platforms', listPlatforms)
  .get('/posts', zValidator('query', listPostsQuerySchema), listPosts)
  .get(
    '/posts/mine',
    authMiddleware,
    zValidator('query', listMyPostsQuerySchema),
    listMyPosts,
  )
  .get('/posts/:id', getPost)
  .post('/posts', authMiddleware, zValidator('json', createPostSchema), createPost)
  .patch('/posts/:id', authMiddleware, zValidator('json', updatePostSchema), updatePost)
  .delete('/posts/:id', authMiddleware, deletePost)
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
    '/moderation/posts/:id/ai-review',
    authMiddleware,
    zValidator('json', aiReviewSchema),
    runAiReview,
  )
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
