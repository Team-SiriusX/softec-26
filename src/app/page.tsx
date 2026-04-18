import { currentUser } from '@/lib/current-user';

export default async function Home() {
  const user = await currentUser();

  return (
    <main>
      <p>{user ? 'authenticated' : 'unauthenticated'}</p>
    </main>
  );
}
