import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import { fmtDate, toNumber, todayStr, unwrapList, writeOk, lookupId } from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass, headerGhostClass } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import FormField, { StatCard } from '@/components/FormField';
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

export const route = {
  path: '/stock',
  layout: 'owner',
  access: "profile === 'Owner_c' || profile === 'Staff_c' || profile === 'Manager_c'",
};
export const nav = {
  icon: 'Package',
  label: 'Stock',
  section: 'Production',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 45,
};

const MOVES = ['In', 'Out', 'To Factory', 'To Shop'];
const MOVE_LABEL = { In: 'Stock in', Out: 'Stock out', 'To Factory': 'Shop → Factory', 'To Shop': 'Factory → Shop' };
const UNITS = ['Meter', 'Piece', 'Roll', 'Pair', 'Set'];
const LOCATIONS = ['Shop', 'Factory'];

function effect(m) {
  const q = Number(m.qty_c) || 0;
  if (m.move_c === 'In') return m.location_c === 'Factory' ? { shop: 0, factory: q } : { shop: q, factory: 0 };
  if (m.move_c === 'Out') return m.location_c === 'Factory' ? { shop: 0, factory: -q } : { shop: -q, factory: 0 };
  if (m.move_c === 'To Factory') return { shop: -q, factory: q };
  return { shop: q, factory: -q };
}

function ItemDialog({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ Name: '', unit_c: 'Meter', min_qty_c: '' });
  const [saving, setSaving] = useState(false);
  async function save(e) {
    e.preventDefault();
    if (!form.Name.trim()) {
      toast.error('Item name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await sdk.table('stock_items_c').create({
        Name: form.Name.trim(),
        unit_c: form.unit_c,
        min_qty_c: toNumber(form.min_qty_c) ?? 0,
      });
      if (!writeOk(res)) return;
      toast.success('Stock item added');
      setForm({ Name: '', unit_c: 'Meter', min_qty_c: '' });
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New stock item</DialogTitle>
          <DialogDescription>Fabric, lining, buttons, thread or any material you keep.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <FormField label="Item name" required>
            <Input value={form.Name} onChange={(e) => setForm((f) => ({ ...f, Name: e.target.value }))} placeholder="Lining cloth" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Unit">
              <PickSelect value={form.unit_c} onChange={(v) => setForm((f) => ({ ...f, unit_c: v }))} options={UNITS} />
            </FormField>
            <FormField label="Low stock level">
              <Input type="number" min="0" value={form.min_qty_c} onChange={(e) => setForm((f) => ({ ...f, min_qty_c: e.target.value }))} placeholder="10" />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ open, onOpenChange, items, presetItem, onSaved }) {
  const names = items.map((i) => i.Name);
  const [form, setForm] = useState({ item: '', move_c: 'In', location_c: 'Shop', qty_c: '', move_date_c: todayStr(), bill_c: '', note_c: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const chosen = form.item || presetItem || names[0] || '';
  const needsLocation = form.move_c === 'In' || form.move_c === 'Out';

  async function save(e) {
    e.preventDefault();
    const item = items.find((i) => i.Name === chosen);
    const qty = toNumber(form.qty_c);
    if (!item || !qty || qty <= 0) {
      toast.error('Pick an item and enter a quantity');
      return;
    }
    setSaving(true);
    try {
      const res = await sdk.table('stock_moves_c').create({
        Name: `${MOVE_LABEL[form.move_c]} – ${item.Name}`,
        item_c: item.Id,
        move_c: form.move_c,
        location_c: needsLocation ? form.location_c : form.move_c === 'To Factory' ? 'Shop' : 'Factory',
        qty_c: qty,
        move_date_c: form.move_date_c || todayStr(),
        bill_c: form.bill_c.trim() || null,
        note_c: form.note_c || null,
      });
      if (!writeOk(res)) return;
      toast.success('Stock updated');
      setForm((f) => ({ ...f, qty_c: '', bill_c: '', note_c: '' }));
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Stock movement</DialogTitle>
          <DialogDescription>Stock in or out, and transfers between shop and factory.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <FormField label="Item" required>
            <PickSelect value={chosen} onChange={(v) => set('item', v)} options={names} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Movement">
              <PickSelect value={form.move_c} onChange={(v) => set('move_c', v)} options={MOVES} labels={MOVE_LABEL} />
            </FormField>
            {needsLocation && (
              <FormField label="Location">
                <PickSelect value={form.location_c} onChange={(v) => set('location_c', v)} options={LOCATIONS} />
              </FormField>
            )}
            <FormField label="Quantity" required>
              <Input type="number" min="0" step="0.01" value={form.qty_c} onChange={(e) => set('qty_c', e.target.value)} />
            </FormField>
            <FormField label="Date">
              <Input type="date" value={form.move_date_c} onChange={(e) => set('move_date_c', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Bill number (optional)">
            <Input value={form.bill_c} onChange={(e) => set('bill_c', e.target.value)} placeholder="AT/0255/2627" />
          </FormField>
          <FormField label="Note">
            <Input value={form.note_c} onChange={(e) => set('note_c', e.target.value)} placeholder="Supplier, challan number…" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save movement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Stock() {
  const { profile } = useProfile();
  const itemAccess = getTableAccess(profile, 'stock_items_c');
  const moveAccess = getTableAccess(profile, 'stock_moves_c');
  const [itemOpen, setItemOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [preset, setPreset] = useState('');
  const [filter, setFilter] = useState('All items');

  const { data, loading, error, run } = useFetch(async () => {
    const [items, moves] = await Promise.all([
      sdk.table('stock_items_c').select(['Name', 'unit_c', 'min_qty_c']).orderBy('Name').page(1, 100).fetch().then(unwrapList),
      sdk
        .table('stock_moves_c')
        .select(['Name', 'item_c', 'move_c', 'location_c', 'qty_c', 'move_date_c', 'bill_c', 'note_c', 'CreatedOn'])
        .orderByDesc('move_date_c')
        .page(1, 100)
        .fetch()
        .then(unwrapList),
    ]);
    return { items, moves };
  }, []);

  const items = data?.items ?? [];
  const moves = data?.moves ?? [];

  const balances = useMemo(() => {
    const map = new Map(items.map((i) => [String(i.Id), { shop: 0, factory: 0 }]));
    moves.forEach((m) => {
      const b = map.get(String(lookupId(m.item_c)));
      if (!b) return;
      const e = effect(m);
      b.shop += e.shop;
      b.factory += e.factory;
    });
    return map;
  }, [items, moves]);

  const low = items.filter((i) => {
    const b = balances.get(String(i.Id));
    return b && Number(i.min_qty_c) > 0 && b.shop + b.factory < Number(i.min_qty_c);
  });
  const shown = filter === 'All items' ? moves : moves.filter((m) => m.item_c?.Name === filter);
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Stock in, stock out and what is at the shop and the factory."
        actions={
          <>
            {moveAccess.canCreate && (
              <Button
                className={ctaClass}
                onClick={() => {
                  setPreset('');
                  setMoveOpen(true);
                }}
                disabled={items.length === 0}
              >
                <AppIcon name="ArrowLeftRight" size={16} /> Stock movement
              </Button>
            )}
            {itemAccess.canCreate && (
              <Button variant="outline" className={headerGhostClass} onClick={() => setItemOpen(true)}>
                <AppIcon name="Plus" size={16} /> New item
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {firstLoad && <ListSkeleton rows={5} />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard label="Stock items" value={items.length} />
              <StatCard label="Low stock" value={low.length} tone={low.length ? 'text-destructive' : undefined} />
              <StatCard label="Movements" value={moves.length} hint="Latest 100" />
            </div>

            {items.length === 0 ? (
              <EmptyBlock icon="Package" title="No stock items" text="Add fabric, lining, buttons or thread to start tracking." />
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                {items.map((i) => {
                  const b = balances.get(String(i.Id)) ?? { shop: 0, factory: 0 };
                  const total = b.shop + b.factory;
                  const isLow = Number(i.min_qty_c) > 0 && total < Number(i.min_qty_c);
                  return (
                    <div key={i.Id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {i.Name} {isLow && <Badge variant="destructive">Low</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">Unit: {i.unit_c}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Shop <b>{b.shop}</b></span>
                        <span>Factory <b>{b.factory}</b></span>
                        <span className={cn('font-semibold', isLow && 'text-destructive')}>Total {total}</span>
                        {moveAccess.canCreate && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPreset(i.Name);
                              setMoveOpen(true);
                            }}
                          >
                            Move
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold">Movement log</h2>
                <div className="w-52">
                  <PickSelect value={filter} onChange={setFilter} options={['All items', ...items.map((i) => i.Name)]} />
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No movements yet.</p>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                  {shown.map((m) => (
                    <div key={m.Id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{m.item_c?.Name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(m.move_date_c)}
                          {m.bill_c ? ` · Bill ${m.bill_c}` : ''}
                          {m.note_c ? ` · ${m.note_c}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{MOVE_LABEL[m.move_c]}</Badge>
                        <span className="w-16 text-right font-semibold">{m.qty_c}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </PageBody>
      <ItemDialog open={itemOpen} onOpenChange={setItemOpen} onSaved={run} />
      <MoveDialog key={`${preset}-${moveOpen}`} open={moveOpen} onOpenChange={setMoveOpen} items={items} presetItem={preset} onSaved={run} />
    </div>
  );
}
