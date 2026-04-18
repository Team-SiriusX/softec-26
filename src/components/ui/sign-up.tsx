'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function HextaStudioSignup() {
  const [email, setEmail] = useState('hello@creativestudio.com');
  const [password, setPassword] = useState('');

  const handleCreateAccount = () => {
    console.log('Creating account with:', { email, password });
  };

  const handleLogin = () => {
    console.log('Redirecting to login');
  };

  return (
    <div className='grid min-h-screen lg:grid-cols-2'>
      <div
        className='flex items-center justify-center bg-slate-900 p-12 text-white'
        style={{
          backgroundImage:
            "linear-gradient(140deg, rgba(15,23,42,0.94), rgba(49,46,129,0.85) 58%, rgba(180,83,9,0.8)), url('https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1800&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className='max-w-md'>
          <h1 className='text-4xl leading-tight font-bold md:text-5xl'>
            Build amazing products with our creative team.
          </h1>
        </div>
      </div>

      <div className='flex items-center justify-center bg-slate-50 p-12'>
        <div className='w-full max-w-md'>
          <div className='mb-8 flex items-center gap-3'>
            <Image
              src='/logo2.png'
              alt='FairGig logo'
              width={48}
              height={48}
              className='rounded-md object-cover'
            />
            <span className='text-2xl font-bold text-slate-900'>FairGig</span>
          </div>

          <div className='mb-8'>
            <h2 className='mb-2 text-3xl font-bold text-gray-900'>Join Us Today</h2>
            <p className='text-gray-600'>Welcome to FairGig - Start your journey</p>
          </div>

          <div className='space-y-6'>
            <div>
              <label htmlFor='email' className='mb-2 block text-sm font-medium text-gray-700'>
                Your email
              </label>
              <input
                type='email'
                id='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className='w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500'
                placeholder='hello@creativestudio.com'
              />
            </div>

            <div>
              <label
                htmlFor='password'
                className='mb-2 block text-sm font-medium text-gray-700'
              >
                Create new password
              </label>
              <input
                type='password'
                id='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className='w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500'
                placeholder='Enter your password'
              />
            </div>

            <button
              onClick={handleCreateAccount}
              className='w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white transition-colors duration-200 hover:bg-orange-600'
            >
              Create a new account
            </button>

            <div className='text-center'>
              <span className='text-gray-600'>Already have account? </span>
              <button
                onClick={handleLogin}
                className='font-semibold text-gray-900 transition-colors duration-200 hover:text-orange-500'
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
