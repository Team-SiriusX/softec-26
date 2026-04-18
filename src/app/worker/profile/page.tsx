import { currentUser } from '@/lib/current-user';
import db from '@/lib/db';
import { redirect } from 'next/navigation';

import ProfileEditor, {
  type WorkerProfileEditorUser,
} from './_components/profile-editor';

export default async function WorkerProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const verificationGroups = await db.shiftLog.groupBy({
    by: ['verificationStatus'],
    where: {
      workerId: user.id,
    },
    _count: {
      _all: true,
    },
  });

  const verificationSummary = verificationGroups.reduce(
    (acc, group) => {
      const count = group._count._all;
      acc.total += count;

      if (group.verificationStatus === 'CONFIRMED') {
        acc.confirmed += count;
      }

      if (group.verificationStatus === 'FLAGGED') {
        acc.flagged += count;
      }

      if (group.verificationStatus === 'UNVERIFIABLE') {
        acc.unverifiable += count;
      }

      if (group.verificationStatus === 'PENDING') {
        acc.pending += count;
      }

      return acc;
    },
    {
      total: 0,
      confirmed: 0,
      flagged: 0,
      unverifiable: 0,
      pending: 0,
    },
  );

  const initialUser: WorkerProfileEditorUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    cityZone: user.cityZone,
    category: user.category,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    image: user.image,
  };

  return (
    <ProfileEditor
      initialUser={initialUser}
      verificationSummary={verificationSummary}
    />
  );
}