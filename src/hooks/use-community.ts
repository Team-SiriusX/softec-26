'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import {
  CommunityFeedResponse,
  CommunityFeedSort,
  CommunityPlatformsResponse,
  CommunityPost,
  CommunityPostResponse,
} from '@/lib/community';
import { toast } from 'sonner';

type FeedFilters = {
  sort?: CommunityFeedSort;
  platformId?: string;
  limit?: number;
  offset?: number;
};

type MyPostsFilters = {
  limit?: number;
  offset?: number;
};

type CreatePostPayload = {
  title: string;
  body: string;
  platformId?: string;
  isAnonymous?: boolean;
  media?: Array<{
    url: string;
    fileKey?: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  }>;
};

type CreateCommentPayload = {
  postId: string;
  content: string;
  isAnonymous?: boolean;
};

type UpdatePostPayload = {
  postId: string;
  title?: string;
  body?: string;
  platformId?: string | null;
  isAnonymous?: boolean;
  media?: Array<{
    url: string;
    fileKey?: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  }>;
};

type ReportPayload = {
  postId: string;
  reason: string;
};

type ModerationQueueItem = {
  id: string;
  reason: 'USER_REQUEST' | 'MULTIPLE_REPORTS' | 'TRUST_SCORE_LOW';
  status: 'PENDING' | 'RESOLVED';
  note: string | null;
  createdAt: string;
  triggeredBy: {
    id: string;
    fullName: string;
    role: string;
  } | null;
  post: {
    id: string;
    title: string;
    body: string;
    author: {
      id: string;
      fullName: string;
      role: string;
    };
    verificationStatus: CommunityPost['verificationStatus'];
    trustScore: number | null;
    upvoteCount: number;
    commentCount: number;
    reportCount: number;
    platform: {
      id: string;
      name: string;
      slug: string;
    } | null;
    media: Array<{
      id: string;
      url: string;
      mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    }>;
  };
};

type ModerationQueueResponse = {
  data: ModerationQueueItem[];
};

export type CommunityAiReviewResult = {
  provider: 'openrouter';
  model: string;
  promptVersion: string;
  latencyMs: number;
  trustScore: number;
  verdict: 'AI_VERIFIED' | 'AI_UNVERIFIED_LOW_TRUST';
  confidence: number;
  recommendation: 'VERIFY' | 'ESCALATE_HUMAN' | 'NEED_MORE_EVIDENCE';
  summary: string;
  reasons: string[];
  riskFlags: string[];
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  rawResponse?: unknown;
};

type CommunityAiReviewResponse = {
  data: {
    id: string;
    verificationStatus: CommunityPost['verificationStatus'];
    trustScore: number;
    aiReview: CommunityAiReviewResult;
  };
};

async function parseApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useCommunityPlatforms(enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.COMMUNITY_PLATFORMS],
    enabled,
    queryFn: async () => {
      const response = await fetch('/api/community/platforms', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch platforms');
      }

      return (await response.json()) as CommunityPlatformsResponse;
    },
  });
}

export function useCommunityFeed(filters: FeedFilters = {}) {
  return useQuery({
    queryKey: [QUERY_KEYS.COMMUNITY_POSTS, filters],
    queryFn: async () => {
      const query = new URLSearchParams();

      query.set('sort', filters.sort ?? 'hot');
      query.set('limit', String(filters.limit ?? 30));
      query.set('offset', String(filters.offset ?? 0));

      if (filters.platformId) {
        query.set('platformId', filters.platformId);
      }

      const response = await fetch(`/api/community/posts?${query.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load community feed');
      }

      return (await response.json()) as CommunityFeedResponse;
    },
  });
}

export function useCommunityPost(postId?: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.COMMUNITY_POST_DETAIL, postId],
    enabled: Boolean(postId),
    queryFn: async () => {
      const response = await fetch(`/api/community/posts/${postId}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load post');
      }

      return (await response.json()) as CommunityPostResponse;
    },
  });
}

export function useMyCommunityPosts(filters: MyPostsFilters = {}, enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS, filters],
    enabled,
    queryFn: async () => {
      const query = new URLSearchParams();

      query.set('limit', String(filters.limit ?? 30));
      query.set('offset', String(filters.offset ?? 0));

      const response = await fetch(`/api/community/posts/mine?${query.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to load your posts'));
      }

      return (await response.json()) as CommunityFeedResponse;
    },
  });
}

export function useCreateCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePostPayload) => {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to create post'));
      }

      return (await response.json()) as CommunityPostResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      toast.success('Post published to community feed');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to publish post');
    },
  });
}

export function useToggleCommunityUpvote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/community/posts/${postId}/upvote`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to update upvote'));
      }

      return response.json() as Promise<{
        upvoted: boolean;
        upvoteCount: number;
      }>;
    },
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.COMMUNITY_POST_DETAIL, postId],
      });
    },
  });
}

export function useCreateCommunityComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCommentPayload) => {
      const response = await fetch(`/api/community/posts/${payload.postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: payload.content,
          isAnonymous: payload.isAnonymous,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to add comment'));
      }

      return response.json();
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.COMMUNITY_POST_DETAIL, payload.postId],
      });
    },
  });
}

export function useReportCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReportPayload) => {
      const response = await fetch(`/api/community/posts/${payload.postId}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: payload.reason }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to submit report'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      toast.success('Report submitted');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to report post');
    },
  });
}

export function useRequestPostVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/community/posts/${postId}/request-verification`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(
          await parseApiError(response, 'Could not request verification right now'),
        );
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      toast.success('Verification request sent');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to request verification');
    },
  });
}

export function useRequestHumanReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/community/posts/${postId}/request-human-review`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(
          await parseApiError(response, 'Could not request human review'),
        );
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      toast.success('Human review request added to queue');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to request human review');
    },
  });
}

export function useCommunityModerationQueue(enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE],
    enabled,
    queryFn: async () => {
      const response = await fetch('/api/community/moderation/queue', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load moderation queue');
      }

      return (await response.json()) as ModerationQueueResponse;
    },
  });
}

export function useRunAiReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      postId: string;
      note?: string;
      includeRawResponse?: boolean;
    }) => {
      const response = await fetch(
        `/api/community/moderation/posts/${payload.postId}/ai-review`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            note: payload.note,
            includeRawResponse: payload.includeRawResponse,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to run AI review'));
      }

      return (await response.json()) as CommunityAiReviewResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      toast.success('AI review completed');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to run AI review');
    },
  });
}

export function useRunMockAiReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { postId: string; trustScore?: number; note?: string }) => {
      const response = await fetch(
        `/api/community/moderation/posts/${payload.postId}/mock-ai-review`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trustScore: payload.trustScore,
            note: payload.note,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to run mock AI review'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      toast.success('Mock AI review completed');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to run AI review');
    },
  });
}

export function useUpdateCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdatePostPayload) => {
      const { postId, ...rest } = payload;

      const response = await fetch(`/api/community/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rest),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to update post'));
      }

      return (await response.json()) as CommunityPostResponse;
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.COMMUNITY_POST_DETAIL, payload.postId],
      });
      toast.success('Post updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update post');
    },
  });
}

export function useDeleteCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to delete post'));
      }

      return response.json() as Promise<{
        data: {
          id: string;
          deleted: boolean;
        };
      }>;
    },
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.COMMUNITY_POST_DETAIL, postId],
      });
      toast.success('Post deleted');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete post');
    },
  });
}

export function useSubmitHumanReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      postId: string;
      verdict: 'VERIFIED' | 'UNVERIFIED';
      note?: string;
    }) => {
      const response = await fetch(
        `/api/community/moderation/posts/${payload.postId}/human-review`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            verdict: payload.verdict,
            note: payload.note,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to submit human review'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMMUNITY_MODERATION_QUEUE] });
      toast.success('Human review submitted');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to submit human review');
    },
  });
}
