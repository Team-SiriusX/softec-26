'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import {
  GrievanceCategory,
  GrievanceListResponse,
  GrievancePlatform,
  GrievanceStatsResponse,
  GrievanceStatus,
} from '@/lib/grievance';
import { client } from '@/lib/hono';
import { toast } from 'sonner';

type GrievanceFilters = {
  platformId?: string;
  category?: GrievanceCategory;
  status?: GrievanceStatus;
  workerId?: string;
  limit?: number;
  offset?: number;
};

type CreateGrievancePayload = {
  platformId: string;
  category: GrievanceCategory;
  description: string;
  isAnonymous?: boolean;
};

type UpdateGrievancePayload = {
  id: string;
  description?: string;
  status?: GrievanceStatus;
  clusterId?: string | null;
};

type TagPayload = {
  id: string;
  tag: string;
};

type RemoveTagPayload = {
  id: string;
  tag: string;
};

type EscalatePayload = {
  id: string;
  note: string;
};

type ResolvePayload = {
  id: string;
  note?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function useGetGrievances(filters: GrievanceFilters = {}, enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.GRIEVANCES_LIST, filters],
    enabled,
    queryFn: async () => {
      const query: Record<string, string> = {};

      if (filters.platformId) query.platformId = filters.platformId;
      if (filters.category) query.category = filters.category;
      if (filters.status) query.status = filters.status;
      if (filters.workerId) query.workerId = filters.workerId;
      if (typeof filters.limit === 'number') query.limit = String(filters.limit);
      if (typeof filters.offset === 'number') query.offset = String(filters.offset);

      const response = await client.api.grievances.$get({ query });

      if (!response.ok) {
        throw new Error('Failed to fetch grievances');
      }

      return (await response.json()) as GrievanceListResponse;
    },
  });
}

export function useGetGrievanceStats(enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.GRIEVANCE_STATS],
    enabled,
    queryFn: async () => {
      const response = await client.api.grievances.stats.$get();

      if (!response.ok) {
        throw new Error('Failed to fetch grievance stats');
      }

      return (await response.json()) as GrievanceStatsResponse;
    },
  });
}

export function useGetGrievancePlatforms(enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.GRIEVANCES, 'platforms'],
    enabled,
    queryFn: async () => {
      const response = await client.api.grievances.platforms.$get();

      if (!response.ok) {
        throw new Error('Failed to fetch platforms');
      }

      return (await response.json()) as GrievancePlatform[];
    },
  });
}

export function useCreateGrievance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateGrievancePayload) => {
      const response = await client.api.grievances.$post({ json: payload });

      if (!response.ok) {
        throw new Error('Failed to create grievance');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCES_LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_STATS] });
      toast.success('Complaint posted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to post complaint'));
    },
  });
}

export function useAddGrievanceTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tag }: TagPayload) => {
      const response = await client.api.grievances[':id'].tags.$post({
        param: { id },
        json: { tag },
      });

      if (!response.ok && response.status !== 409) {
        throw new Error('Failed to add grievance tag');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCES_LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_DETAIL] });
    },
  });
}

export function useRemoveGrievanceTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tag }: RemoveTagPayload) => {
      const response = await client.api.grievances[':id'].tags[':tag'].$delete({
        param: { id, tag },
      });

      if (!response.ok) {
        throw new Error('Failed to remove grievance tag');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCES_LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_DETAIL] });
    },
  });
}

export function useUpdateGrievance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateGrievancePayload) => {
      const response = await client.api.grievances[':id'].$patch({
        param: { id },
        json,
      });

      if (!response.ok) {
        throw new Error('Failed to update grievance');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCES_LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_DETAIL] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_STATS] });
    },
  });
}

export function useEscalateGrievance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: EscalatePayload) => {
      const response = await client.api.grievances[':id'].escalate.$post({
        param: { id },
        json: { note },
      });

      if (!response.ok) {
        throw new Error('Failed to escalate grievance');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCES_LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_DETAIL] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_STATS] });
    },
  });
}

export function useResolveGrievance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: ResolvePayload) => {
      const response = await client.api.grievances[':id'].resolve.$patch({
        param: { id },
        json: note ? { note } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to resolve grievance');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCES_LIST] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_DETAIL] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_STATS] });
    },
  });
}
