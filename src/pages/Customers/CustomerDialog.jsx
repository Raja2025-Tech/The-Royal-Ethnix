import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { SOURCES, writeOk } from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import PickSelect from '@/components/PickSelect';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    source_c: record?.source_c ?? 'Walk-in',
    birthday_c: record?.birthday_c ?? '',
    address_c: record?.address_c ?? '',
    notes_c: record?.notes_c ?? '',
  };
}

export default function CustomerDialog({ open, onOpenChange, record, onSaved }) {
  const [form, setForm] = useState(() => initialForm(record));
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(record);

  useEffect(() => {
    if (open) setForm(initialForm(record));
  }, [open, record]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e) {
    e.preventDefault();
    const phone = form.phone_c.replace(/\D/g, '').slice(-10);
    if (phone.length < 10) {
      toast.error('Enter a 10-digit phone number');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim() || phone,
        phone_c: phone,
        source_c: form.source_c,
        birthday_c: form.birthday_c || null,
        address_c: form.address_c.trim() || null,
        notes_c: form.notes_c || null,
      };
      const res = isEdit
        ? await sdk.table('customers_c').update({ Id: record.Id, ...payload })
        : await sdk.table('customers_c').create(payload);
      if (!writeOk(res)) return;
      toast.success(isEdit ? 'Customer updated' : 'Customer added');
      onOpenChange(false);
      onSaved?.(res.data[0]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit customer' : 'New customer'}</DialogTitle>
          <DialogDescription>Phone number is used to track orders.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Customer name (optional)">
              <Input value={form.Name} onChange={(e) => set('Name', e.target.value)} placeholder="Rahul Banerjee" />
            </FormField>
            <FormField label="Phone" required>
              <Input value={form.phone_c} onChange={(e) => set('phone_c', e.target.value)} placeholder="98300 11201" />
            </FormField>
            <FormField label="Source">
              <PickSelect value={form.source_c} onChange={(v) => set('source_c', v)} options={SOURCES} />
            </FormField>
            <FormField label="Birthday">
              <Input type="date" value={form.birthday_c} onChange={(e) => set('birthday_c', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Address">
            <Input value={form.address_c} onChange={(e) => set('address_c', e.target.value)} placeholder="Salt Lake, Kolkata" />
          </FormField>
          <FormField label="Notes">
            <Textarea
              rows={2}
              value={form.notes_c}
              onChange={(e) => set('notes_c', e.target.value)}
              placeholder="Fit preferences, favourite colours…"
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
                'Save customer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
