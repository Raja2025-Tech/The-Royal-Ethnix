import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import AppIcon from '@/components/AppIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthLayout from './AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sdk.session.sendResetLink(email);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send the email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" description="We will email you a link to set a new password." icon="KeyRound">
      {sent ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center text-sm">
          <p>
            If <span className="font-medium">{email}</span> has an account, a reset link is on its way. Check the inbox and spam
            folder.
          </p>
          <Button asChild variant="outline">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <AppIcon name="LoaderCircle" size={16} className="animate-spin" />}
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
