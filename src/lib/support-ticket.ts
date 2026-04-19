export type SupportTicketStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export type SupportTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SupportTicketCategory =
  | 'ACCOUNT_ACCESS'
  | 'PAYMENT'
  | 'TECHNICAL'
  | 'SAFETY'
  | 'OTHER';

export type SupportTicketActor = {
  id: string;
  fullName: string;
  email: string;
  cityZone?: string | null;
};

export type SupportTicketItem = {
  id: string;
  workerId: string;
  assignedAdvocateId: string | null;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  advocateNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  worker: SupportTicketActor;
  assignedAdvocate: SupportTicketActor | null;
};

export type SupportTicketListResponse = {
  tickets: SupportTicketItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type SupportTicketStatsResponse = {
  total: number;
  openCount: number;
  unassignedOpenCount: number;
  byStatus: Record<SupportTicketStatus, number>;
  byPriority: Record<SupportTicketPriority, number>;
};

export const supportTicketCategoryOptions: Array<{
  value: SupportTicketCategory;
  label: string;
}> = [
  { value: 'ACCOUNT_ACCESS', label: 'Account Access' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'OTHER', label: 'Other' },
];

export const supportTicketPriorityOptions: Array<{
  value: SupportTicketPriority;
  label: string;
}> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const supportTicketStatusOptions: Array<{
  value: SupportTicketStatus;
  label: string;
}> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export const supportTicketStatusTone: Record<
  SupportTicketStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  OPEN: 'outline',
  IN_REVIEW: 'secondary',
  IN_PROGRESS: 'default',
  RESOLVED: 'default',
  CLOSED: 'secondary',
};

export const supportTicketPriorityTone: Record<
  SupportTicketPriority,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'default',
  URGENT: 'destructive',
};

export function formatSupportTicketStatus(status: SupportTicketStatus): string {
  const option = supportTicketStatusOptions.find((row) => row.value === status);
  return option?.label ?? status;
}

export function formatSupportTicketPriority(priority: SupportTicketPriority): string {
  const option = supportTicketPriorityOptions.find((row) => row.value === priority);
  return option?.label ?? priority;
}

export function formatSupportTicketCategory(category: SupportTicketCategory): string {
  const option = supportTicketCategoryOptions.find((row) => row.value === category);
  return option?.label ?? category;
}
