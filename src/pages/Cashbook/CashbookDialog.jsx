import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { CASH_IN_HEADS, CASH_OUT_HEADS, toNumber, todayStr, writeOk } from '@/lib/tms';
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
import { cn } from '@/lib/utils';

const KINDS = ['In', 'Out'];
const KIND_LABEL = { In: 'Cash in', Out: 'Cash out' };

function initialForm(record, presetKind, presetDate) {
  const kind = record?.kind_c ?? presetKind ?? 'In';
  return {
    Name: record?.Name ?? '',
    kind_c: kind,
    category_c: record?.category_c ?? (kind === 'In' ? CASH_IN_HEADS[0] : CASH_OUT_HEADS[0]),
    amount_c: record?.amount_c ?? '',
    entry_date_c: record?.entry_date_c ?? presetDate ?? todayStr(),
    note_c: record?.note_c ?? '',
  };
}

export default function CashbookDialog({ open, onOpenChange, record, presetKind, presetDate, onSaved }) {
  const [form, setForm] = useState(() => initialForm(record, presetKind, presetDate));
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(record);

  useEffect(() => {
    if (open) setForm(initialForm(record, presetKind, presetDate));
  }, [open, record, presetKind, presetDate]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const heads = form.kind_c === 'In' ? CASH_IN_HEADS : CASH_OUT_HEADS;

  function changeKind(kind) {
    setForm((f) => ({ ...f, kind_c: kind, category_c: kind === 'In' ? CASH_IN_HEADS[0] : CASH_OUT_HEADS[0] }));
  }

  async function save(e) {
    e.preventDefault();
    const amount = toNumber(form.amount_c);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim() || form.category_c,
        kind_c: form.kind_c,
        category_c: form.category_c.trim() || null,
        amount_c: amount,
        entry_date_c: form.entry_date_c || todayStr(),
        note_c: form.note_c || null,
      };
      const res = isEdit
        ? await sdk.table('cashbook_c').update({ Id: record.Id, ...payload })
        : await sdk.table('cashbook_c').create(payload);
      if (!writeOk(res)) return;
      toast.success(isEdit ? 'Entry updated' : 'Entry added');
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
          <DialogTitle>{isEdit ? 'Edit cashbook entry' : KIND_LABEL[form.kind_c]}</DialogTitle>
          <DialogDescription>Every cash movement of the day goes here.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type">
              <PickSelect value={form.kind_c} onChange={changeKind} options={KINDS} labels={KIND_LABEL} />
            </FormField>
            <FormField label="Amount (INR)" required>
              <Input
                type="number"
                min="0"
                value={form.amount_c}
                onChange={(e) => set('amount_c', e.target.value)}
                placeholder="500"
                autoFocus
              />
            </FormField>
          </div>
          <FormField label="Head">
            <div className="flex flex-wrap gap-2">
              {heads.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => set('category_c', h)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    form.category_c === h ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent',
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Particulars">
              <Input value={form.Name} onChange={(e) => set('Name', e.target.value)} placeholder="Tea and shop supplies" />
            </FormField>
            <FormField label="Date">
              <Input type="date" value={form.entry_date_c} onChange={(e) => set('entry_date_c', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Note">
            <Textarea rows={2} value={form.note_c} onChange={(e) => set('note_c', e.target.value)} placeholder="Bill number, supplier, who took the cash…" />
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
                'Save entry'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
