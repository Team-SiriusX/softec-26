import Link from 'next/link';
import { Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function PendingApprovalPage() {
  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_10%_10%,rgba(250,204,21,0.12),transparent_35%),radial-gradient(circle_at_88%_4%,rgba(56,189,248,0.1),transparent_40%)] px-4 py-12 md:px-8'>
      <div className='mx-auto flex w-full max-w-2xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='space-y-4'>
            <Badge variant='outline' className='w-fit'>
              Approval Required
            </Badge>
            <CardTitle className='flex items-center gap-2 text-3xl tracking-tight'>
              <Clock3 className='size-7 text-amber-500' />
              Account Pending Review
            </CardTitle>
            <CardDescription className='text-base'>
              Your account was created successfully, but verifier and advocate roles require approval by an approved advocate account.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              Please check back later. Once approved, you will be able to access your dashboard immediately after signing in.
            </p>
            <div className='flex flex-wrap gap-2'>
              <Link href='/auth/sign-in' className={cn(buttonVariants({ variant: 'default' }))}>
                Go To Sign In
              </Link>
              <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
                Return Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
