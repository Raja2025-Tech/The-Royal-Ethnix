import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { SPECIALTIES, SPECIALTY_LABEL, todayStr, writeOk } from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import PickSelect from '@/components/PickSelect';
import FormField from '@/components/FormField';
import PeoplePicker, { toPeopleWrite } from '@/components/PeoplePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function initialForm(record) {
  return {
    Name: record?.Name ?? '',
    phone_c: record?.phone_c ?? '',
    specialty_c: record?.specialty_c ?? 'All',
    joined_c: record?.joined_c ?? todayStr(),
    active_c: record?.active_c ?? true,
    notes_c: record?.notes_c ?? '',
    login_c: record?.login_c ?? [],
  };
}

export default function KarigarDialog({ open, onOpenChange, record, onSaved }) {
  const [form, setForm] = useState(() => initialForm(record));
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(record);

  useEffect(() => {
    if (open) setForm(initialForm(record));
  }, [open, record]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e) {
    e.preventDefault();
    if (!form.Name.trim()) {
      toast.error('Karigar name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim(),
        phone_c: form.phone_c.trim() || null,
        specialty_c: form.specialty_c,
        joined_c: form.joined_c || null,
        active_c: form.active_c,
        notes_c: form.notes_c || null,
        login_c: toPeopleWrite(form.login_c),
      };
      const res = isEdit
        ? await sdk.table('karigars_c').update({ Id: record.Id, ...payload })
        : await sdk.table('karigars_c').create(payload);
      if (!writeOk(res)) return;
      toast.success(isEdit ? 'Karigar updated' : 'Karigar added');
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit karigar' : 'New karigar'}</DialogTitle>
          <DialogDescription>Karigars can be assigned to garments and paid majuri.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Karigar name" required>
              <Input value={form.Name} onChange={(e) => set('Name', e.target.value)} placeholder="Mohammad Rafique" />
            </FormField>
            <FormField label="Phone">
              <Input value={form.phone_c} onChange={(e) => set('phone_c', e.target.value)} placeholder="98304 55120" />
            </FormField>
            <FormField label="Specialty">
              <PickSelect
                value={form.specialty_c}
                onChange={(v) => set('specialty_c', v)}
                options={SPECIALTIES}
                labels={SPECIALTY_LABEL}
              />
            </FormField>
            <FormField label="Joined on">
              <Input type="date" value={form.joined_c} onChange={(e) => set('joined_c', e.target.value)} />
            </FormField>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive karigars are hidden from assignment.</p>
            </div>
            <Switch checked={form.active_c} onCheckedChange={(v) => set('active_c', v)} />
          </div>
          <FormField label="Login account" hint="Link the karigar's app login so they only see their own garments and can update the stage.">
            <PeoplePicker
              multiple={false}
              value={form.login_c}
              onChange={(v) => set('login_c', v)}
              placeholder="Select login user…"
            />
          </FormField>
          <FormField label="Notes">
            <Textarea
              rows={2}
              value={form.notes_c}
              onChange={(e) => set('notes_c', e.target.value)}
              placeholder="Skills, rate agreement, working days…"
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <AppIcon name="LoaderCircle" size={16} className="animate-spin" /> Saving…
                </>
              ) : (
                'Save karigar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
