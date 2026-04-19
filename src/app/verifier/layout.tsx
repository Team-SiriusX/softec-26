import { RoleSignOutButton } from '@/components/auth/role-sign-out-button';

export default function VerifierLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div className='fixed top-4 right-4 z-50 md:right-8'>
        <RoleSignOutButton />
      </div>
      {children}
    </>
  );
}