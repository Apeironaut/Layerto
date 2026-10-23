import { useState } from 'react';
import type { SignupParams } from '@layerto/types';
import { Alert, AuthLayout } from '@layerto/ui';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export type AuthMode = 'sign-in' | 'sign-up' | 'forgot';

export interface AuthPageProps {
  notice?: string;
  initialMode?: AuthMode;
  onSignIn: (login: string, password: string) => Promise<void>;
  onSignUp: (params: SignupParams) => Promise<void>;
}

const COPY: Record<AuthMode, { title: string; subtitle: string }> = {
  'sign-in': { title: 'Sign in to Layerto', subtitle: 'Use your email or username.' },
  'sign-up': { title: 'Create your account', subtitle: 'Approved accounts start with 50 free calls.' },
  forgot: { title: 'Reset your password', subtitle: "Enter your account's email and we'll send you a link." },
};

/** Sign in, create an account, or ask for a reset link. */
export function AuthPage({ notice, initialMode = 'sign-in', onSignIn, onSignUp }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const switcher = (label: string, target: AuthMode, prompt: string) => (
    <>
      {prompt}{' '}
      <button type="button" onClick={() => setMode(target)} className="font-semibold text-crimson hover:underline underline-offset-2 cursor-pointer">
        {label}
      </button>
    </>
  );
  return (
    <AuthLayout
      title={COPY[mode].title}
      subtitle={COPY[mode].subtitle}
      footer={
        mode === 'sign-in'
          ? switcher('Create one', 'sign-up', "Don't have an account?")
          : mode === 'sign-up'
            ? switcher('Sign in', 'sign-in', 'Already have an account?')
            : undefined
      }
    >
      {notice && mode === 'sign-in' && (
        <div className="mb-4">
          <Alert tone="error">{notice}</Alert>
        </div>
      )}
      {mode === 'sign-in' && <SignInForm onSignIn={onSignIn} onForgot={() => setMode('forgot')} />}
      {mode === 'sign-up' && <SignUpForm onSignUp={onSignUp} />}
      {mode === 'forgot' && <ForgotPasswordForm onBack={() => setMode('sign-in')} />}
    </AuthLayout>
  );
}
