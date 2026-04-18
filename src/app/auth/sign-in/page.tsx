'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

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

  const { control, handleSubmit, formState: { errors } } = form;

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (response.error) {
        setError(response.error.message || 'Sign-in failed. Please check your credentials.');
      } else {
        // Get user data to determine role
        const user = response.data?.user;
        const userRole = (user as any)?.role;
        if (userRole === 'WORKER') {
          router.push('/worker/dashboard');
        } else if (userRole === 'VERIFIER') {
          router.push('/verifier/queue');
        } else if (userRole === 'ADVOCATE') {
          router.push('/advocate/dashboard');
        } else {
          router.push('/');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md shadow-lg border border-slate-200">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">FairGig</h1>
            <p className="text-slate-600 text-sm">Fair earnings, verified income</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-900 font-medium text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Sign in to your account</h2>

            {/* Email Field */}
            <FieldGroup>
              <FieldLabel htmlFor="email" className="text-slate-700 font-medium">
                Email Address
              </FieldLabel>
              <Controller
                name="email"
                control={control}
                render={({ field }: { field: any }) => (
                  <>
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="text-base"
                      aria-invalid={!!errors.email}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <FieldError errors={[errors.email]} />
                    )}
                  </>
                )}
              />
            </FieldGroup>

            {/* Password Field */}
            <FieldGroup>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel htmlFor="password" className="text-slate-700 font-medium m-0">
                  Password
                </FieldLabel>
                <Link
                  href="/auth/forget-password"
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Controller
                name="password"
                control={control}
                render={({ field }: { field: any }) => (
                  <>
                    <Input
                      {...field}
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      className="text-base"
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
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-6 text-base font-semibold"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Sign Up Link */}
            <div className="text-center">
              <p className="text-slate-600 text-sm">
                Don't have an account?{' '}
                <Link href="/auth/sign-up" className="font-semibold text-blue-600 hover:underline">
                  Create one now
                </Link>
              </p>
            </div>
          </form>

          {/* Demo Info */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900 text-center">
              <span className="font-semibold">Demo Mode:</span> Use test credentials from onboarding
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
