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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  role: z.enum(['WORKER', 'VERIFIER', 'ADVOCATE']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

const roles = [
  {
    value: 'WORKER',
    label: 'Gig Worker',
    description: 'Log your earnings, get verified, and prove your income',
  },
  {
    value: 'VERIFIER',
    label: 'Verifier',
    description: 'Review worker screenshots and verify earnings claims',
  },
  {
    value: 'ADVOCATE',
    label: 'Advocate / Analyst',
    description: 'Analyze patterns and help workers understand their rights',
  },
];

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'role'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'WORKER',
    },
  });

  const { control, handleSubmit, formState: { errors }, watch } = form;
  const selectedRole = watch('role');

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.fullName,
        data: {
          role: data.role,
        },
      });

      if (response.error) {
        setError(response.error.message || 'Sign-up failed. Please try again.');
      } else {
        // Redirect based on role
        if (data.role === 'WORKER') {
          router.push('/worker/onboarding/profile');
        } else if (data.role === 'VERIFIER') {
          router.push('/verifier/dashboard');
        } else {
          router.push('/advocate/dashboard');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Sign-up error:', err);
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
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={handleSubmit(() => setStep('role'))} className="space-y-5">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Create your account</h2>

              {/* Full Name Field */}
              <FieldGroup>
                <FieldLabel htmlFor="fullName" className="text-slate-700 font-medium">
                  Full Name
                </FieldLabel>
                <Controller
                  name="fullName"
                  control={control}
                  render={({ field }: { field: any }) => (
                    <>
                      <Input
                        {...field}
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        className="text-base"
                        aria-invalid={!!errors.fullName}
                      />
                      {errors.fullName && (
                        <FieldError errors={[errors.fullName]} />
                      )}
                    </>
                  )}
                />
              </FieldGroup>

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
                <FieldLabel htmlFor="password" className="text-slate-700 font-medium">
                  Password
                </FieldLabel>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }: { field: any }) => (
                    <>
                      <Input
                        {...field}
                        id="password"
                        type="password"
                        placeholder="At least 8 characters"
                        className="text-base"
                        aria-invalid={!!errors.password}
                      />
                      {errors.password && (
                        <FieldError errors={[errors.password]} />
                      )}
                    </>
                  )}
                />
              </FieldGroup>

              {/* Confirm Password Field */}
              <FieldGroup>
                <FieldLabel htmlFor="confirmPassword" className="text-slate-700 font-medium">
                  Confirm Password
                </FieldLabel>
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field }: { field: any }) => (
                    <>
                      <Input
                        {...field}
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        className="text-base"
                        aria-invalid={!!errors.confirmPassword}
                      />
                      {errors.confirmPassword && (
                        <FieldError errors={[errors.confirmPassword]} />
                      )}
                    </>
                  )}
                />
              </FieldGroup>

              {/* Navigation */}
              <Button
                type="submit"
                className="w-full mt-6 py-6 text-base font-semibold"
                size="lg"
              >
                Continue
              </Button>

              <div className="text-center">
                <p className="text-slate-600 text-sm">
                  Already have an account?{' '}
                  <Link href="/auth/sign-in" className="font-semibold text-blue-600 hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 'role' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">What's your role?</h2>
                <p className="text-slate-600 text-sm mb-6">
                  Choose the role that best describes you. You can change this later.
                </p>
              </div>

              {/* Role Selection */}
              <Controller
                name="role"
                control={control}
                render={({ field }: { field: any }) => (
                  <RadioGroup value={field.value} onValueChange={field.onChange}>
                    <div className="space-y-3">
                      {roles.map((role) => (
                        <label
                          key={role.value}
                          className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedRole === role.value
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <RadioGroupItem value={role.value} id={role.value} className="mt-0.5" />
                          <div className="ml-3 flex-1">
                            <p className="font-semibold text-slate-900">{role.label}</p>
                            <p className="text-sm text-slate-600">{role.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                )}
              />

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 py-6 text-base font-semibold"
                  onClick={() => setStep('details')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-6 text-base font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
