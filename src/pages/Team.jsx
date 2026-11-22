import { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { PROFILES } from '@/services/userPermissions';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import FormField from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const route = { path: '/team', layout: 'owner', access: "profile === 'Owner_c'" };
export const nav = {
  icon: 'UsersRound',
  label: 'Team',
  section: 'Setup',
  profiles: ['Owner_c'],
  order: 120,
};

const PROFILE_KEYS = Object.keys(PROFILES);
const PROFILE_LABELS = Object.fromEntries(PROFILE_KEYS.map((k) => [k, PROFILES[k].label]));
const EMPTY = { name: '', email: '', password: '', profile: 'Staff_c' };

export default function Team() {
  const me = useSelector((s) => s.user.user);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);

  const { data, loading, error, run } = useFetch(() => sdk.users.list(), []);
  const users = [...(data ?? [])].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || String(a.name).localeCompare(String(b.name)));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function add(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Enter name and email');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await sdk.users.add({ ...form, name: form.name.trim(), email: form.email.trim() });
      toast.success(`${form.name} added. Share the email and password with them.`);
      setOpen(false);
      setForm(EMPTY);
      run();
    } catch (err) {
      toast.error(err?.message || 'Could not add the user');
    } finally {
      setSaving(false);
    }
  }

  async function change(u, changes, message) {
    setBusy(u.Id);
    try {
      await sdk.users.update(u.Id, changes);
      toast.success(message);
      run();
    } catch (err) {
      toast.error(err?.message || 'Could not update');
    } finally {
      setBusy(null);
    }
  }

  async function reset(u) {
    setBusy(u.Id);
    try {
      toast.success(await sdk.users.resetPassword(u.email));
    } catch (err) {
      toast.error(err?.message || 'Could not reset the password');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="Add staff logins and choose what each person can do. A karigar login must also be linked on the Karigar page."
        actions={
          <Button className={ctaClass} onClick={() => setOpen(true)}>
            <AppIcon name="UserPlus" size={16} /> Add member
          </Button>
        }
      />
      <PageBody>
        {loading && data === undefined && <ListSkeleton rows={4} />}
        {error && <ErrorBlock message={error} onRetry={run} />}
        {data && users.length === 0 && <EmptyBlock icon="UsersRound" title="No team members" text="Add your first staff member." />}
        {users.length > 0 && (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {users.map((u) => {
              const self = u.Id === me?.Id;
              const active = u.active !== false;
              return (
                <div key={u.Id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {u.name || u.email} {self && <span className="text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!active && <Badge variant="outline">Disabled</Badge>}
                    <div className="w-44">
                      <PickSelect
                        value={u.profile}
                        onChange={(v) => v !== u.profile && change(u, { profile: v }, `Role changed to ${PROFILE_LABELS[v]}`)}
                        options={PROFILE_KEYS}
                        labels={PROFILE_LABELS}
                        disabled={self || busy === u.Id}
                      />
                    </div>
                    <Button variant="ghost" size="sm" disabled={busy === u.Id} onClick={() => reset(u)}>
                      Reset password
                    </Button>
                    {!self && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={active ? 'text-destructive' : undefined}
                        disabled={busy === u.Id}
                        onClick={() => change(u, { active: !active }, active ? 'Login disabled' : 'Login enabled')}
                      >
                        {active ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[calc(100vw-2rem)] sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>They sign in with this email and password. They can change the password later.</DialogDescription>
          </DialogHeader>
          <form onSubmit={add} className="grid gap-4">
            <FormField label="Name" required>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Rahul Das" />
            </FormField>
            <FormField label="Email" required>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="rahul@example.com" />
            </FormField>
            <FormField label="Password" required hint="At least 6 characters.">
              <Input value={form.password} onChange={(e) => set('password', e.target.value)} />
            </FormField>
            <FormField label="Role">
              <PickSelect value={form.profile} onChange={(v) => set('profile', v)} options={PROFILE_KEYS} labels={PROFILE_LABELS} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <AppIcon name="LoaderCircle" size={16} className="animate-spin" />}
                Add member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
