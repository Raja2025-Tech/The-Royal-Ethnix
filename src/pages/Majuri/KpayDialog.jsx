import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { KARIGAR_PAY_TYPES, lookupId, toNumber, todayStr, writeOk } from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import LookupPicker from '@/components/LookupPicker';
import PickSelect from '@/components/PickSelect';
import FormField from '@/components/FormField';
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

function initialForm(record, fixedKarigarId, fixedKarigarName) {
  return {
    Name: record?.Name ?? (fixedKarigarName ? `Majuri – ${fixedKarigarName.split(' ')[0]}` : ''),
    karigar_c: lookupId(record?.karigar_c) ?? fixedKarigarId ?? null,
    amount_c: record?.amount_c ?? '',
    type_c: record?.type_c ?? 'Majuri',
    paid_on_c: record?.paid_on_c ?? todayStr(),
    note_c: record?.note_c ?? '',
    bill_c: record?.bill_c ?? '',
    cashbook: !record,
  };
}

export default function KpayDialog({ open, onOpenChange, record, fixedKarigarId, fixedKarigarName, onSaved }) {
  const [form, setForm] = useState(() => initialForm(record, fixedKarigarId, fixedKarigarName));
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(record);

  useEffect(() => {
    if (open) setForm(initialForm(record, fixedKarigarId, fixedKarigarName));
  }, [open, record, fixedKarigarId, fixedKarigarName]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e) {
    e.preventDefault();
    const amount = toNumber(form.amount_c);
    if (!form.Name.trim() || !form.karigar_c || !amount || amount <= 0) {
      toast.error('Reference, karigar and a valid amount are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim(),
        karigar_c: form.karigar_c,
        amount_c: amount,
        type_c: form.type_c,
        paid_on_c: form.paid_on_c || null,
        note_c: form.note_c || null,
        bill_c: form.bill_c.trim() || null,
      };
      const res = isEdit
        ? await sdk.table('karigar_payments_c').update({ Id: record.Id, ...payload })
        : await sdk.table('karigar_payments_c').create(payload);
      if (!writeOk(res)) return;
      if (!isEdit && form.cashbook) {
        await sdk.table('cashbook_c').create({
          Name: form.Name.trim(),
          kind_c: 'Out',
          category_c: 'Karigar',
          amount_c: amount,
          entry_date_c: form.paid_on_c || todayStr(),
          note_c: form.note_c || null,
        });
      }
      toast.success(isEdit ? 'Payment updated' : 'Payment recorded');
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit karigar payment' : 'Pay karigar'}</DialogTitle>
          <DialogDescription>Advance, majuri settlement or bonus.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Reference" required>
              <Input value={form.Name} onChange={(e) => set('Name', e.target.value)} placeholder="Majuri – Rafique" />
            </FormField>
            <FormField label="Amount (INR)" required>
              <Input
                type="number"
                min="0"
                value={form.amount_c}
                onChange={(e) => set('amount_c', e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          </div>
          {!fixedKarigarId && (
            <FormField label="Karigar" required>
              <LookupPicker
                table="karigars_c"
                searchField="Name"
                value={form.karigar_c}
                onChange={(id) => set('karigar_c', id)}
                placeholder="Select karigar…"
              />
            </FormField>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Payment type">
              <PickSelect value={form.type_c} onChange={(v) => set('type_c', v)} options={KARIGAR_PAY_TYPES} />
            </FormField>
            <FormField label="Paid on">
              <Input type="date" value={form.paid_on_c} onChange={(e) => set('paid_on_c', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Bill number (optional)" hint="Lets the karigar filter payments bill wise.">
            <Input value={form.bill_c} onChange={(e) => set('bill_c', e.target.value)} placeholder="AT/0255/2627" />
          </FormField>
          <FormField label="Note">
            <Textarea
              rows={2}
              value={form.note_c}
              onChange={(e) => set('note_c', e.target.value)}
              placeholder="Weekly settlement, festival advance…"
            />
          </FormField>
          {!isEdit && (
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Also enter in today's cashbook</p>
                <p className="text-xs text-muted-foreground">Adds a cash out entry under Karigar.</p>
              </div>
              <Switch checked={form.cashbook} onCheckedChange={(v) => set('cashbook', v)} />
            </div>
          )}
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
                'Save payment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
