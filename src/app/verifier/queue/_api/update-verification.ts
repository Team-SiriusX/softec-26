// FairGig scaffold — implement logic here
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { toast } from 'sonner';

type ResponseType = InferResponseType<
  (typeof client.api.screenshots)[':id']['verify']['$patch']
>;
type RequestType = InferRequestType<
  (typeof client.api.screenshots)[':id']['verify']['$patch']
>;

export const useUpdateVerification = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.screenshots[':id'].verify.$patch({
        param,
        json,
      });

      if (!response.ok) {
        throw new Error('Failed to update verification');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCREENSHOTS] });
      toast.success('Verification updated successfully');
    },
    onError: () => {
      toast.error('Failed to update verification');
    },
  });
};
