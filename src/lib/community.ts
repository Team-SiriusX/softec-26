export type CommunityVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING_AI_REVIEW'
  | 'AI_VERIFIED'
  | 'AI_UNVERIFIED_LOW_TRUST'
  | 'PENDING_HUMAN_REVIEW'
  | 'HUMAN_VERIFIED'
  | 'HUMAN_UNVERIFIED';

export type CommunityFeedSort = 'hot' | 'new' | 'verified';

export type CommunityAuthor = {
  id: string;
  fullName: string;
  role: string;
};

export type CommunityPlatform = {
  id: string;
  name: string;
  slug: string;
};

export type CommunityMedia = {
  id: string;
  url: string;
  fileKey: string | null;
  mediaType: string;
  createdAt: string;
};

export type CommunityComment = {
  id: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt?: string;
  author: CommunityAuthor;
};

export type CommunityPost = {
  id: string;
  title: string;
  body: string;
  author: CommunityAuthor;
  authorId: string;
  isAnonymous: boolean;
  platform: CommunityPlatform | null;
  verificationStatus: CommunityVerificationStatus;
  verificationRequestedAt: string | null;
  trustScore: number | null;
  upvoteCount: number;
  commentCount: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
  media: CommunityMedia[];
  commentsPreview?: CommunityComment[];
  comments?: CommunityComment[];
  counts: {
    comments: number;
    upvotes: number;
    reports: number;
  };
};

export type CommunityFeedResponse = {
  data: CommunityPost[];
  meta: {
    sort: CommunityFeedSort;
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

export type CommunityPostResponse = {
  data: CommunityPost;
};

export type CommunityPlatformsResponse = {
  data: CommunityPlatform[];
};

export const communitySortOptions: Array<{
  value: CommunityFeedSort;
  label: string;
}> = [
  { value: 'hot', label: 'Hot Feed' },
  { value: 'new', label: 'Newest' },
  { value: 'verified', label: 'Verified First' },
];

export const communityVerificationTone: Record<
  CommunityVerificationStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  UNVERIFIED: 'outline',
  PENDING_AI_REVIEW: 'secondary',
  AI_VERIFIED: 'default',
  AI_UNVERIFIED_LOW_TRUST: 'destructive',
  PENDING_HUMAN_REVIEW: 'secondary',
  HUMAN_VERIFIED: 'default',
  HUMAN_UNVERIFIED: 'destructive',
};

export function formatCommunityVerificationStatus(
  status: CommunityVerificationStatus,
): string {
  switch (status) {
    case 'UNVERIFIED':
      return 'Unverified';
    case 'PENDING_AI_REVIEW':
      return 'Pending AI Review';
    case 'AI_VERIFIED':
      return 'AI Verified';
    case 'AI_UNVERIFIED_LOW_TRUST':
      return 'Low Trust (AI)';
    case 'PENDING_HUMAN_REVIEW':
      return 'Pending Human Review';
    case 'HUMAN_VERIFIED':
      return 'Human Verified';
    case 'HUMAN_UNVERIFIED':
      return 'Human Unverified';
    default:
      return status;
  }
}

export function isVerifiedCommunityStatus(
  status: CommunityVerificationStatus,
): boolean {
  return status === 'AI_VERIFIED' || status === 'HUMAN_VERIFIED';
}
