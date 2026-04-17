import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { toast } from 'sonner';

type ResponseType = InferResponseType<
  (typeof client.api.sample)[':id']['$delete']
>;
type RequestType = InferRequestType<
  (typeof client.api.sample)[':id']['$delete']
>;

export const useDeleteSample = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param }) => {
      const response = await client.api.sample[':id']['$delete']({
        param,
      });

      if (!response.ok) {
        throw new Error('Failed to delete the sample');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SAMPLE] });
      toast.success('Sample deleted Successfully!');
    },
    onError: () => {
      toast.error('Failed to delete the Sample');
    },
  });

  return mutation;
};
