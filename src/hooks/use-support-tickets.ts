'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import {
  SupportTicketCategory,
  SupportTicketListResponse,
  SupportTicketPriority,
  SupportTicketStatsResponse,
  SupportTicketStatus,
} from '@/lib/support-ticket';

type SupportTicketFilters = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  category?: SupportTicketCategory;
  workerId?: string;
  assignedAdvocateId?: string;
  limit?: number;
  offset?: number;
};

type CreateSupportTicketPayload = {
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
};

type UpdateSupportTicketPayload = {
  id: string;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedAdvocateId?: string | null;
  advocateNote?: string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function useGetSupportTickets(filters: SupportTicketFilters = {}, enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.SUPPORT_TICKETS, filters],
    enabled,
    queryFn: async () => {
      const query: Record<string, string> = {};

      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.category) query.category = filters.category;
      if (filters.workerId) query.workerId = filters.workerId;
      if (filters.assignedAdvocateId) query.assignedAdvocateId = filters.assignedAdvocateId;
      if (typeof filters.limit === 'number') query.limit = String(filters.limit);
      if (typeof filters.offset === 'number') query.offset = String(filters.offset);

      const response = await client.api.support.$get({ query });

      if (!response.ok) {
        throw new Error('Failed to fetch support tickets');
      }

      return (await response.json()) as SupportTicketListResponse;
    },
  });
}

export function useGetSupportTicketStats(enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.SUPPORT_TICKET_STATS],
    enabled,
    queryFn: async () => {
      const response = await client.api.support.stats.$get();

      if (!response.ok) {
        throw new Error('Failed to fetch support ticket stats');
      }

      return (await response.json()) as SupportTicketStatsResponse;
    },
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSupportTicketPayload) => {
      const response = await client.api.support.$post({ json: payload });

      if (!response.ok) {
        throw new Error('Failed to create support ticket');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPORT_TICKETS] });
      toast.success('Support ticket submitted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to submit support ticket'));
    },
  });
}

export function useUpdateSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateSupportTicketPayload) => {
      const response = await (
        client.api.support[':id'].$patch as unknown as (args: {
          param: { id: string };
          json: Omit<UpdateSupportTicketPayload, 'id'>;
        }) => Promise<Response>
      )({
        param: { id },
        json,
      });

      if (!response.ok) {
        throw new Error('Failed to update support ticket');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPORT_TICKETS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPORT_TICKET_DETAIL] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SUPPORT_TICKET_STATS] });
      toast.success('Support ticket updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to update support ticket'));
    },
  });
}
