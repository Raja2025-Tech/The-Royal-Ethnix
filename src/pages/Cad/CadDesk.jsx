import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import {
  BOTTOM_FIELDS,
  CAD_STATUSES,
  MEASURE_KEYS,
  TOP_FIELDS,
  cadStyles,
  daysLabel,
  daysLeft,
  daysTone,
  fabricLabel,
  fmtDate,
  kindStyles,
  lookupId,
  priorityStyles,
  todayStr,
  unwrapList,
  writeOk,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import PickSelect from '@/components/PickSelect';
import FilePicker from '@/components/FilePicker';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Input } from '@/components/ui/input';

import { isIn, eq, or, contains, and } from '@/services/query';

export const route = { path: '/cad', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'PenTool',
  label: 'CAD Desk',
  section: 'Production',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 35,
};

// Deliberately no money fields: the CAD Master must not see anything finance related.
const CAD_ORDER_FIELDS = [
  'Name', 'bill_no_c', 'order_date_c', 'trial_date_c', 'delivery_date_c', 'event_date_c',
  'priority_c', 'status_c', 'cad_pattern_c', 'pattern_date_c', 'remark_c',
];
const CAD_ITEM_FIELDS = [
  'Name', 'order_c', 'kind_c', 'category_c', 'status_c', 'due_date_c', 'sleeve_type_c', 'qty_c', 'handwork_c',
  'fabric_c', 'fabric_qty_c', 'fabric_unit_c', 'design_c', 'photos_c', 'fabric_photos_c', 'cad_c', 'cad_date_c', 'CreatedOn', ...MEASURE_KEYS,
];
const STAGE_FILTERS = ['Pending', 'Done', 'Not Required', 'All'];
const OPEN_ORDER = ['Draft', 'Active', 'Ready'];

function measures(item) {
  if (item.kind_c === 'Accessory') return [];
  const fields = item.kind_c === 'Bottom Wear' ? BOTTOM_FIELDS : TOP_FIELDS;
  return fields.filter((f) => item[f.key] !== null && item[f.key] !== undefined && item[f.key] !== '');
}

// Order level CAD status follows its garments: all done or not required means Done.
function orderCad(items) {
  if (!items.length) return 'Pending';
  const stages = items.map((i) => i.cad_c || 'Pending');
  if (stages.every((s) => s === 'Not Required')) return 'Not Required';
  if (stages.every((s) => s !== 'Pending')) return 'Done';
  return 'Pending';
}

export default function CadDesk() {
  const { profile } = useProfile();
  const canEdit = getTableAccess(profile, 'order_items_c').canUpdate;
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('Pending');
  const [busy, setBusy] = useState(null);

  const { data, loading, error, run } = useFetch(async () => {
    const f = [];
    if (stage !== 'All') f.push(eq('cad_c', stage));
    const s = search.trim();
    if (s) {
      const found = await sdk
        .table('orders_c')
        .select(['Name'])
        .where(or(contains('Name', s), contains('bill_no_c', s)))
        .page(1, 50)
        .fetch()
        .then(unwrapList);
      if (!found.length) return { rows: [], orders: [] };
      f.push(isIn('order_c', found.map((o) => o.Id)));
    }
    let q = sdk.table('order_items_c').select(CAD_ITEM_FIELDS);
    if (f.length) q = q.where(and(...f));
    const items = await q.orderBy('due_date_c').page(1, 60).fetch().then(unwrapList);
    const ids = [...new Set(items.map((i) => lookupId(i.order_c)).filter(Boolean))];
    let orders = [];
    if (ids.length) {
      orders = await sdk
        .table('orders_c')
        .select(CAD_ORDER_FIELDS)
        .where(and(isIn('Id', ids), isIn('status_c', OPEN_ORDER)))
        .page(1, 100)
        .fetch()
        .then(unwrapList);
    }
    const open = new Map(orders.map((o) => [String(o.Id), o]));
    const rows = items
      .filter((i) => open.has(String(lookupId(i.order_c))))
      .map((i) => ({ item: i, order: open.get(String(lookupId(i.order_c))) }));
    return { rows, orders };
  }, [stage, search]);

  const rows = data?.rows ?? [];
  const firstLoad = loading && data === undefined;

  async function setCad(item, order, value) {
    if (value === (item.cad_c || 'Pending')) return;
    setBusy(item.Id);
    try {
      const res = await sdk.table('order_items_c').update({
        Id: item.Id,
        cad_c: value,
        cad_date_c: value === 'Done' ? todayStr() : item.cad_date_c || null,
      });
      if (!writeOk(res)) return;
      // Keep the bill-level CAD status in line with all of its garments.
      const all = await sdk
        .table('order_items_c')
        .select(['cad_c'])
        .where(eq('order_c', order.Id))
        .page(1, 100)
        .fetch()
        .then(unwrapList);
      const next = orderCad(all);
      if (next !== order.cad_pattern_c) {
        await sdk.table('orders_c').update({
          Id: order.Id,
          cad_pattern_c: next,
          pattern_date_c: next === 'Done' ? todayStr() : order.pattern_date_c || null,
        });
      }
      toast.success(`${item.Name}: CAD ${value}`);
      run();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader title="CAD Desk" description="Every garment has its own CAD pattern stage. Update it item by item." />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bill number…" className="pl-9" />
          </div>
          <PickSelect value={stage} onChange={setStage} options={STAGE_FILTERS} />
        </div>

        {firstLoad && <ListSkeleton rows={4} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock icon="PenTool" title="No garments here" text="No garment of an open bill matches this CAD stage." />
        )}

        <div aria-busy={loading} className={cn('space-y-3', loading && data !== undefined && 'opacity-60')}>
          {rows.map(({ item: i, order: o }) => {
            const n = daysLeft(o.delivery_date_c);
            const cad = i.cad_c || 'Pending';
            const hasImages = (i.photos_c?.length ?? 0) + (i.fabric_photos_c?.length ?? 0) > 0;
            return (
              <article key={i.Id} className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading text-lg font-semibold">
                      {i.Name}
                      {i.kind_c === 'Accessory' ? ` × ${i.qty_c ?? 1}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <StatusBadge styles={kindStyles} value={i.kind_c} />
                      <span>Bill {o.bill_no_c || o.Name}</span>
                      <span>· Delivery {fmtDate(o.delivery_date_c)}</span>
                      {n !== null && <span className={cn('font-medium', daysTone(n))}>{daysLabel(n)}</span>}
                      {o.priority_c && o.priority_c !== 'Normal' && <StatusBadge styles={priorityStyles} value={o.priority_c} />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge styles={cadStyles} value={cad} />
                    <div className="w-40">
                      <PickSelect
                        value={cad}
                        onChange={(v) => setCad(i, o, v)}
                        options={CAD_STATUSES}
                        disabled={!canEdit || busy === i.Id}
                      />
                    </div>
                  </div>
                </div>
                {i.cad_date_c && <p className="text-xs text-muted-foreground">Pattern date {fmtDate(i.cad_date_c)}</p>}
                {o.remark_c && <p className="rounded-xl bg-muted p-3 text-sm">{o.remark_c}</p>}

                <div className="flex flex-wrap gap-1.5">
                  {measures(i).map((f) => (
                    <span key={f.key} className="rounded-md bg-muted px-2 py-1 text-xs">
                      <span className="text-muted-foreground">{f.label.replace(' (optional)', '')}</span>{' '}
                      <span className="font-semibold">{i[f.key]}</span>
                    </span>
                  ))}
                  {i.kind_c === 'Top Wear' && i.sleeve_type_c && (
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">{i.sleeve_type_c} sleeve</span>
                  )}
                  {i.handwork_c && <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">Handwork</span>}
                </div>
                {(i.fabric_c || i.design_c) && (
                  <p className="text-xs text-muted-foreground">
                    {i.fabric_c}
                    {i.fabric_qty_c ? ` (${fabricLabel(i)})` : ''}
                    {i.fabric_c && i.design_c ? ' · ' : ''}
                    {i.design_c}
                  </p>
                )}
                {hasImages && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium">Images</summary>
                    <div className="mt-2 space-y-2">
                      {(i.photos_c?.length ?? 0) > 0 && <FilePicker value={i.photos_c} onChange={() => {}} readOnly />}
                      {(i.fabric_photos_c?.length ?? 0) > 0 && <FilePicker value={i.fabric_photos_c} onChange={() => {}} readOnly />}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
        {!canEdit && rows.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">Your role can view CAD stages but not change them.</p>
        )}
      </PageBody>
    </div>
  );
}
