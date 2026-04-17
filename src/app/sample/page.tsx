'use client';

import { useGetSample } from './_api/get-sample';
import CreateSample from './_components/create-sample';
import DeleteSample from './_components/delete-sample';

export default function SamplePage() {
  const { data, isLoading } = useGetSample();

  if (isLoading) {
    return <div>Loading...</div>;
  }
  return (
    <div>
      <p>{JSON.stringify(data)}</p>
      <CreateSample />
      <DeleteSample />
    </div>
  );
}
