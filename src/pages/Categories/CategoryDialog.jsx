import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { ITEM_KINDS, toNumber, writeOk } from '@/lib/tms';
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
    kind_c: record?.kind_c ?? 'Top Wear',
    default_wage_c: record?.default_wage_c ?? '',
    notes_c: record?.notes_c ?? '',
  };
}

export default function CategoryDialog({ open, onOpenChange, record, onSaved }) {
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
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim(),
        kind_c: form.kind_c,
        default_wage_c: toNumber(form.default_wage_c) ?? 0,
        notes_c: form.notes_c || null,
      };
      const res = isEdit
        ? await sdk.table('categories_c').update({ Id: record.Id, ...payload })
        : await sdk.table('categories_c').create(payload);
      if (!writeOk(res)) return;
      toast.success(isEdit ? 'Category updated' : 'Category added');
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
          <DialogTitle>{isEdit ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>Add custom garment types here. They appear in the order form.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <FormField label="Category name" required>
            <Input value={form.Name} onChange={(e) => set('Name', e.target.value)} placeholder="Achkan" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Wear type">
              <PickSelect value={form.kind_c} onChange={(v) => set('kind_c', v)} options={ITEM_KINDS} />
            </FormField>
            <FormField label="Default wage (INR)" hint="Pre-fills the karigar wage.">
              <Input
                type="number"
                min="0"
                value={form.default_wage_c}
                onChange={(e) => set('default_wage_c', e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          </div>
          <FormField label="Notes">
            <Textarea
              rows={2}
              value={form.notes_c}
              onChange={(e) => set('notes_c', e.target.value)}
              placeholder="Construction notes for the workshop…"
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
                'Save category'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
