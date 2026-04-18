'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function SignUpPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending && session?.user) {
      router.replace('/');
    }
  }, [isPending, router, session]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: '/',
      });

      if (result.error) {
        toast.error(result.error.message ?? 'Unable to create account');
        return;
      }

      toast.success('Account created successfully');
      router.replace('/');
      router.refresh();
    } catch {
      toast.error('Unable to create account right now');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className='mx-auto flex min-h-dvh w-full max-w-md items-center px-4'>
      <Card className='w-full'>
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Create your account with basic email authentication.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                type='text'
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder='Jane Doe'
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder='you@example.com'
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder='••••••••'
                required
                minLength={8}
              />
            </div>

            <Button type='submit' className='w-full' disabled={submitting}>
              {submitting ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>

          <p className='mt-4 text-sm text-muted-foreground'>
            Already have an account?{' '}
            <Link className='text-primary underline' href='/auth/sign-in'>
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
