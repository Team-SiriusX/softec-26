// FairGig scaffold — implement logic here
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { toast } from 'sonner';

type ResponseType = InferResponseType<typeof client.api.certificates.$post>;
type RequestType = InferRequestType<
  typeof client.api.certificates.$post
> extends { json: infer J }
  ? J
  : never;

export const useCreateCertificate = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.certificates.$post({ json });

      if (!response.ok) {
        throw new Error('Failed to create certificate');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CERTIFICATES] });
      toast.success('Certificate created successfully');
    },
    onError: () => {
      toast.error('Failed to create certificate');
    },
  });
};
