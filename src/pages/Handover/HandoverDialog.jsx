import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { FABRIC_UNITS, FABRIC_UNIT_LABEL, karigarNames, toNumber, todayStr, writeOk } from '@/lib/tms';
import PickSelect from '@/components/PickSelect';
import AppIcon from '@/components/AppIcon';
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

export default function HandoverDialog({ open, onOpenChange, item, mode, onSaved }) {
  const give = mode === 'give';
  const [date, setDate] = useState(todayStr());
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('Meter');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayStr());
      setQty(item?.fabric_qty_c ?? '');
      setUnit(item?.fabric_unit_c ?? 'Meter');
      setNote('');
    }
  }, [open, item]);

  async function save(e) {
    e.preventDefault();
    if (!item) return;
    if (!date) {
      toast.error('Pick a date');
      return;
    }
    const meters = toNumber(qty);
    if (give && !(meters > 0)) {
      toast.error('Enter the fabric quantity given');
      return;
    }
    setSaving(true);
    try {
      const payload = give
        ? { Id: item.Id, fabric_given_on_c: date, fabric_qty_c: meters, fabric_unit_c: unit, fabric_note_c: note.trim() || null }
        : { Id: item.Id, received_on_c: date, received_note_c: note.trim() || null };
      const res = await sdk.table('order_items_c').update(payload);
      if (!writeOk(res)) return;
      toast.success(give ? 'Fabric handed to karigar' : 'Garment received from karigar');
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{give ? 'Give fabric to karigar' : 'Receive garment from karigar'}</DialogTitle>
          <DialogDescription>
            {item?.Name} · {item ? karigarNames(item, 'No karigar') : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <FormField label={give ? 'Handed over on' : 'Received on'} required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          {give && (
            <FormField label="Fabric given" required hint={item?.fabric_c ? `Fabric: ${item.fabric_c}` : undefined}>
              <div className="grid grid-cols-[1fr_9rem] gap-2">
                <Input type="text" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="3.5" />
                <PickSelect value={unit} onChange={setUnit} options={FABRIC_UNITS} labels={FABRIC_UNIT_LABEL} />
              </div>
            </FormField>
          )}
          <FormField label="Note">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={give ? 'Lining, buttons and thread also given…' : 'Condition, leftover fabric returned…'}
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
              ) : give ? (
                'Confirm handover'
              ) : (
                'Confirm receipt'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
