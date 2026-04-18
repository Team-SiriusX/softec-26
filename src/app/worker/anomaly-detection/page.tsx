import { currentUser } from '@/lib/current-user';
import { redirect } from 'next/navigation';

import AnomalyDetectionPanel from './_components/anomaly-detection-panel';

export default async function WorkerAnomalyDetectionPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  if (user.role !== 'WORKER') {
    redirect('/');
  }

  return <AnomalyDetectionPanel workerId={user.id} />;
}