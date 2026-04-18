export type GrievanceCategory =
  | 'COMMISSION_CHANGE'
  | 'ACCOUNT_DEACTIVATION'
  | 'PAYMENT_DISPUTE'
  | 'UNFAIR_RATING'
  | 'SAFETY_CONCERN'
  | 'OTHER';

export type GrievanceStatus = 'OPEN' | 'TAGGED' | 'ESCALATED' | 'RESOLVED';

export type GrievanceUser = {
  id: string;
  fullName: string;
  role: 'WORKER' | 'VERIFIER' | 'ADVOCATE' | string;
};

export type GrievancePlatform = {
  id: string;
  name: string;
  slug: string;
};

export type GrievanceTag = {
  id: string;
  grievanceId: string;
  advocateId: string;
  tag: string;
  createdAt: string;
};

export type GrievanceEscalation = {
  id: string;
  grievanceId: string;
  advocateId: string;
  note: string | null;
  escalatedAt: string;
  advocate?: GrievanceUser | null;
};

export type GrievanceItem = {
  id: string;
  workerId: string | null;
  platformId: string | null;
  category: GrievanceCategory;
  title: string;
  description: string;
  status: GrievanceStatus;
  isAnonymous: boolean;
  clusterId: string | null;
  createdAt: string;
  updatedAt: string;
  worker?: GrievanceUser | null;
  platform?: GrievancePlatform | null;
  tags: GrievanceTag[];
  escalations: GrievanceEscalation[];
};

export type GrievanceListResponse = {
  grievances: GrievanceItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type GrievanceStatsResponse = {
  total: number;
  openCount: number;
  thisWeekCount: number;
  byStatus: Record<GrievanceStatus, number>;
  byCategory: Record<GrievanceCategory, number>;
};

export const grievanceCategoryOptions: Array<{
  value: GrievanceCategory;
  label: string;
}> = [
  { value: 'COMMISSION_CHANGE', label: 'Commission Change' },
  { value: 'ACCOUNT_DEACTIVATION', label: 'Account Deactivation' },
  { value: 'PAYMENT_DISPUTE', label: 'Payment Dispute' },
  { value: 'UNFAIR_RATING', label: 'Unfair Rating' },
  { value: 'SAFETY_CONCERN', label: 'Safety Concern' },
  { value: 'OTHER', label: 'Other' },
];

export const grievanceStatusOptions: Array<{
  value: GrievanceStatus;
  label: string;
}> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'TAGGED', label: 'Tagged' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export const grievanceStatusTone: Record<
  GrievanceStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  OPEN: 'outline',
  TAGGED: 'secondary',
  ESCALATED: 'destructive',
  RESOLVED: 'default',
};

export function formatGrievanceCategory(category: GrievanceCategory): string {
  const option = grievanceCategoryOptions.find((row) => row.value === category);
  return option?.label ?? category;
}

export function formatGrievanceStatus(status: GrievanceStatus): string {
  const option = grievanceStatusOptions.find((row) => row.value === status);
  return option?.label ?? status;
}

export function makeSameHappenedTag(userId: string): string {
  return `same-happened-${userId.toLowerCase()}`;
}

export function countSameHappened(tags: GrievanceTag[]): number {
  return tags.filter((tag) => tag.tag.startsWith('same-happened-')).length;
}
