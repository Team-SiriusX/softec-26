import { currentUser } from '@/lib/current-user';
import { redirect } from 'next/navigation';

import ProfileEditor, {
  type WorkerProfileEditorUser,
} from './_components/profile-editor';

export default async function WorkerProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

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

  return <ProfileEditor initialUser={initialUser} />;
}