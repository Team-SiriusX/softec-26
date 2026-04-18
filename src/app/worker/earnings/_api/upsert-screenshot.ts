'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

type RequestType = InferRequestType<typeof client.api.screenshots.$post>;
type ResponseType = InferResponseType<typeof client.api.screenshots.$post>;

export const useUpsertScreenshot = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (payload) => {
      const response = await client.api.screenshots.$post(payload);

      if (!response.ok) {
        throw new Error('Failed to upload screenshot');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFT_DETAIL] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCREENSHOTS] });
      toast.success('Screenshot submitted for review. Status is now pending.');
    },
    onError: () => {
      toast.error('Screenshot upload failed. Please try again.');
    },
  });
};
