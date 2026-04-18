'use client';

import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type SignInFormData = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (response.error) {
        setError(
          response.error.message ||
            'Sign-in failed. Please check your credentials.',
        );
      } else {
        // Role-based redirect is handled by proxy middleware after auth cookies are set.
        router.push('/');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='bg-background grid min-h-screen w-full lg:grid-cols-2'>
      <section className='relative hidden overflow-hidden lg:flex lg:items-end lg:justify-start'>
        <div
          className='absolute inset-0'
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,0.52), rgba(0,0,0,0.62)), url('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className='relative z-10 max-w-xl px-12 pb-16 text-white'>
          <p className='mb-4 text-xs font-semibold tracking-[0.24em] uppercase text-white/80'>
            FAIRGIG ACCESS
          </p>
          <h1 className='text-4xl leading-tight font-black xl:text-5xl'>
            Secure access to verified earnings and worker advocacy intelligence.
          </h1>
        </div>
      </section>

      <section className='flex items-center justify-center px-4 py-12 sm:px-8 lg:px-12'>
        <div className='w-full max-w-md'>
          <Link href='/' className='mb-8 inline-flex items-center gap-3'>
            <Image
              src='/logo2.png'
              alt='FairGig logo'
              width={44}
              height={44}
              className='rounded-md object-cover'
              priority
            />
            <span className='text-2xl font-bold tracking-tight text-slate-900'>
              FairGig
            </span>
          </Link>

          <div className='mb-8'>
            <h2 className='mb-2 text-3xl font-black text-slate-900'>Welcome back</h2>
            <p className='text-sm text-slate-600'>
              Sign in to continue with wage verification and case workflows.
            </p>
          </div>

          {error && (
            <div className='mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4'>
              <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-600' />
              <p className='text-sm font-medium text-red-900'>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>
            <FieldGroup>
              <FieldLabel htmlFor='email' className='font-medium text-slate-700'>
                Your email
              </FieldLabel>
              <Controller
                name='email'
                control={control}
                render={({ field }) => (
                  <>
                    <Input
                      {...field}
                      id='email'
                      type='email'
                      placeholder='hello@fairgig.app'
                      className='h-12 rounded-xl border border-slate-300 bg-white px-4 text-base'
                      aria-invalid={!!errors.email}
                      disabled={isLoading}
                    />
                    {errors.email && <FieldError errors={[errors.email]} />}
                  </>
                )}
              />
            </FieldGroup>

            <FieldGroup>
              <div className='mb-2 flex items-center justify-between'>
                <FieldLabel htmlFor='password' className='m-0 font-medium text-slate-700'>
                  Password
                </FieldLabel>
                <Link
                  href='/auth/forget-password'
                  className='text-primary text-xs font-semibold hover:underline'
                >
                  Forgot password?
                </Link>
              </div>
              <Controller
                name='password'
                control={control}
                render={({ field }) => (
                  <>
                    <Input
                      {...field}
                      id='password'
                      type='password'
                      placeholder='Enter your password'
                      className='h-12 rounded-xl border border-slate-300 bg-white px-4 text-base'
                      aria-invalid={!!errors.password}
                      disabled={isLoading}
                    />
                    {errors.password && <FieldError errors={[errors.password]} />}
                  </>
                )}
              />
            </FieldGroup>

            <Button
              type='submit'
              disabled={isLoading}
              className='bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-full rounded-xl text-base font-semibold'
            >
              {isLoading ? (
                <>
                  <Spinner className='mr-2 h-4 w-4' />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            <div className='pt-1 text-center'>
              <p className='text-sm text-slate-600'>
                Don&apos;t have an account?{' '}
                <Link
                  href='/auth/sign-up'
                  className='font-semibold text-slate-900 hover:text-primary'
                >
                  Create one now
                </Link>
              </p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
