'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useDeleteShift = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await client.api.shifts[':id'].$delete({
        param: { id: shiftId },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? 'Failed to delete shift');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFT_DETAIL] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ANOMALY] });
      toast.success('Shift log deleted');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete shift');
    },
  });
};
