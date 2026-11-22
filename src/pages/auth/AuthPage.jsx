import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { sdk } from '@/services/sdk';
import { setUser } from '@/store/userSlice';
import { GENERIC_AUTH } from '@/config/app.config';
import AppIcon from '@/components/AppIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthLayout from './AuthLayout';

const DEMO_LOGINS = [
  ['Admin', 'owner@demo.app'],
  ['Manager', 'manager@demo.app'],
  ['Counter Staff', 'staff@demo.app'],
  ['CAD Master', 'cad@demo.app'],
  ['Karigar', 'karigar@demo.app'],
];

export default function AuthPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || GENERIC_AUTH.redirectAfterAuth || '/';

  const [setup, setSetup] = useState(false);
  const [checking, setChecking] = useState(sdk.usingFirebase);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // First run with Firebase: no owner yet, so this page creates the owner account.
  useEffect(() => {
    if (!sdk.usingFirebase) return;
    sdk.session
      .needsSetup()
      .then(setSetup)
      .catch(() => setSetup(false))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (setup) {
        if (!name.trim()) throw new Error('Enter your name');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        if (password !== confirm) throw new Error('Passwords do not match');
        const u = await sdk.session.setupOwner({ name: name.trim(), email, password });
        dispatch(setUser(u));
        navigate('/', { replace: true });
        return;
      }
      const result = await sdk.session.login({ email, password });
      if (!result.ok) throw new Error(result.error?.message || 'Sign in failed');
      dispatch(setUser(result.value));
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <AuthLayout title="The Royal Ethnix" description="Loading…">
        <div className="flex justify-center py-6">
          <AppIcon name="LoaderCircle" size={24} className="animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={setup ? 'Create the owner account' : GENERIC_AUTH.loginTitle}
      description={
        setup
          ? 'First time setup. This account becomes the Admin and can add the rest of the team.'
          : GENERIC_AUTH.loginDescription
      }
    >
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        {setup && (
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Subhasish" autoComplete="name" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {!setup && (
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={setup ? 'new-password' : 'current-password'}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              <AppIcon name={show ? 'EyeOff' : 'Eye'} size={16} />
            </button>
          </div>
        </div>
        {setup && (
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        )}
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <AppIcon name="LoaderCircle" size={16} className="animate-spin" />}
          {setup ? 'Create owner account' : 'Sign in'}
        </Button>
      </form>

      {!sdk.usingFirebase && (
        <div className="mt-4 space-y-2 rounded-2xl border border-dashed border-border p-4 text-sm">
          <p className="font-medium">Demo mode</p>
          <p className="text-xs text-muted-foreground">
            Data is saved only in this browser. Connect Firebase (see README) for shared data. Password for all demo
            logins: <span className="font-semibold">demo1234</span>
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {DEMO_LOGINS.map(([label, mail]) => (
              <Button
                key={mail}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEmail(mail);
                  setPassword('demo1234');
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
