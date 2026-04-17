import { Button } from '@/components/ui/button';
import { useDeleteSample } from '../_api/delete-sample';

const DeleteSample = () => {
  const { mutate, isPending } = useDeleteSample();

  return (
    <Button
      disabled={isPending}
      onClick={() => mutate({ param: { id: 'SAMPLE-ID' } })}
    >
      Delete Sample
    </Button>
  );
};

export default DeleteSample;
