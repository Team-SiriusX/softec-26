'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
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
    <div className='flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4 py-12'>
      <Card className='w-full max-w-md border border-slate-200 shadow-lg'>
        <div className='p-8'>
          {/* Header */}
          <div className='mb-8'>
            <h1 className='mb-2 text-3xl font-bold text-slate-900'>FairGig</h1>
            <p className='text-sm text-slate-600'>
              Fair earnings, verified income
            </p>
          </div>

          {error && (
            <div className='mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4'>
              <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-600' />
              <div>
                <p className='text-sm font-medium text-red-900'>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>
            <h2 className='mb-6 text-xl font-semibold text-slate-900'>
              Sign in to your account
            </h2>

            {/* Email Field */}
            <FieldGroup>
              <FieldLabel
                htmlFor='email'
                className='font-medium text-slate-700'
              >
                Email Address
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
                      placeholder='you@example.com'
                      className='text-base'
                      aria-invalid={!!errors.email}
                      disabled={isLoading}
                    />
                    {errors.email && <FieldError errors={[errors.email]} />}
                  </>
                )}
              />
            </FieldGroup>

            {/* Password Field */}
            <FieldGroup>
              <div className='mb-2 flex items-center justify-between'>
                <FieldLabel
                  htmlFor='password'
                  className='m-0 font-medium text-slate-700'
                >
                  Password
                </FieldLabel>
                <Link
                  href='/auth/forget-password'
                  className='text-xs font-medium text-blue-600 hover:underline'
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
                      className='text-base'
                      aria-invalid={!!errors.password}
                      disabled={isLoading}
                    />
                    {errors.password && (
                      <FieldError errors={[errors.password]} />
                    )}
                  </>
                )}
              />
            </FieldGroup>

            {/* Sign In Button */}
            <Button
              type='submit'
              disabled={isLoading}
              className='mt-6 w-full py-6 text-base font-semibold'
              size='lg'
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

            {/* Sign Up Link */}
            <div className='text-center'>
              <p className='text-sm text-slate-600'>
                Don&apos;t have an account?
                <Link
                  href='/auth/sign-up'
                  className='font-semibold text-blue-600 hover:underline'
                >
                  Create one now
                </Link>
              </p>
            </div>
          </form>

          {/* Demo Info */}
          <div className='mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4'>
            <p className='text-center text-xs text-blue-900'>
              <span className='font-semibold'>Demo Mode:</span> Use test
              credentials from onboarding
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
