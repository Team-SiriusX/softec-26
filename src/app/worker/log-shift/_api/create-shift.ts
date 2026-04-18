'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { toast } from 'sonner';
import { InferRequestType, InferResponseType } from 'hono';

type ResponseType = InferResponseType<typeof client.api.shifts.$post>;
type RequestType = InferRequestType<
  typeof client.api.shifts.$post
> extends { json: infer J }
  ? J
  : never;

export const useCreateShift = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.shifts.$post({ json });
      if (!response.ok) {
        throw new Error('Failed to log shift');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ANOMALY] });
      toast.success('Shift logged successfully');
    },
    onError: () => {
      toast.error('Failed to log shift. Please try again.');
    },
  });
};
