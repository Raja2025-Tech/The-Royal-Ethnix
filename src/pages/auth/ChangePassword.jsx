import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader } from '@/components/PageHeader';
import FormField from '@/components/FormField';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const route = {
  path: '/change-password',
  layout: 'owner',
  access: 'authenticated',
};

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (next !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await sdk.session.changePassword(current, next);
      toast.success('Password changed');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error(err?.message || 'Could not change the password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Change password" description="Use at least 6 characters." />
      <PageBody>
        <form onSubmit={submit} className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
          <FormField label="Current password" required>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </FormField>
          <FormField label="New password" required>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </FormField>
          <FormField label="Confirm new password" required>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </FormField>
          <Button type="submit" disabled={saving}>
            {saving && <AppIcon name="LoaderCircle" size={16} className="animate-spin" />}
            Change password
          </Button>
        </form>
      </PageBody>
    </div>
  );
}
