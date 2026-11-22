import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import {
  ITEM_FIELDS,
  OPEN_STAGES,
  ITEM_STATUSES,
  ITEM_STATUS_LABEL,
  karigarNames,
  stagesFor,
  daysLabel,
  daysLeft,
  daysTone,
  fmtDate,
  handoverState,
  handoverStyles,
  kindStyles,
  lookupId,
  syncOrderStatus,
  unwrapList,
  writeOk,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import LookupPicker from '@/components/LookupPicker';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import PickSelect from '@/components/PickSelect';
import FormField from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
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

import { eq, isIn, contains, and } from '@/services/query';
import { or as orF } from '@/services/query';

export const route = { path: '/order-items', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'Scissors',
  label: 'Work Queue',
  section: 'Production',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 40,
  count: { table: 'order_items_c', where: null },
};

const PAGE_SIZE = 20;
const STAGE_FILTERS = ['In progress', 'All', ...ITEM_STATUSES];
const STAGE_LABELS = { 'In progress': 'In progress', All: 'All stages', ...ITEM_STATUS_LABEL };

export default function WorkQueue() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'order_items_c');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('In progress');
  const [karigar, setKarigar] = useState(null);
  const [page, setPage] = useState(1);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickOrder, setPickOrder] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [search, stage, karigar]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (search.trim()) f.push(contains('Name', search.trim()));
    if (stage === 'In progress') f.push(isIn('status_c', OPEN_STAGES));
    else if (stage !== 'All') f.push(eq('status_c', stage));
    if (karigar) {
      f.push(orF(eq('karigar_c', karigar), eq('karigar2_c', karigar), eq('karigar3_c', karigar)));
    }
    let q = sdk.table('order_items_c').select(ITEM_FIELDS);
    if (f.length) q = q.where(and(...f));
    return q
      .orderBy('due_date_c')
      .page(page, PAGE_SIZE)
      .fetch()
      .then((r) => ({ rows: unwrapList(r), total: r.total ?? 0 }));
  }, [search, stage, karigar, page]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const firstLoad = loading && data === undefined;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function move(item, status) {
    if (status === item.status_c) return;
    setBusy(item.Id);
    try {
      const res = await sdk.table('order_items_c').update({ Id: item.Id, status_c: status });
      if (!writeOk(res)) return;
      await syncOrderStatus(lookupId(item.order_c));
      toast.success(`${item.Name}: ${ITEM_STATUS_LABEL[status]}`);
      run();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Work Queue"
        description="Every garment in the workshop, sorted by karigar due date."
        actions={
          access.canCreate && (
            <Button className={ctaClass} onClick={() => setPickOpen(true)}>
              <AppIcon name="Plus" size={16} /> Add garment
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_14rem_16rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search garment…"
              className="pl-9"
            />
          </div>
          <PickSelect value={stage} onChange={setStage} options={STAGE_FILTERS} labels={STAGE_LABELS} />
          <LookupPicker
            table="karigars_c"
            searchField="Name"
            value={karigar}
            onChange={setKarigar}
            placeholder="All karigars"
            clearable
          />
        </div>

        {firstLoad && <ListSkeleton rows={8} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock icon="Scissors" title="Nothing in the queue" text="No garments match these filters." />
        )}

        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('space-y-3 transition-opacity', loading && 'pointer-events-none opacity-60')}>
            {rows.map((it) => {
              const dl = it.status_c === 'Delivered' ? null : daysLeft(it.due_date_c);
              return (
                <div
                  key={it.Id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/order-items/${it.Id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/order-items/${it.Id}`)}
                  className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/50 md:flex-row md:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{it.Name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge styles={kindStyles} value={it.kind_c} />
                      <span>Bill {it.order_c?.Name ?? '—'}</span>
                      <span>· {karigarNames(it, 'No karigar')}</span>
                      {it.kind_c === 'Top Wear' && it.sleeve_type_c && <span>· {it.sleeve_type_c} sleeve</span>}
                      {it.handwork_c && <span>· Handwork</span>}
                      <StatusBadge styles={handoverStyles} value={handoverState(it)} />
                    </div>
                  </div>
                  <div className="text-sm md:w-32 md:text-right">
                    <p>{fmtDate(it.due_date_c)}</p>
                    {dl !== null && <p className={cn('text-xs font-medium', daysTone(dl))}>{daysLabel(dl)}</p>}
                  </div>
                  <div className="md:w-40" onClick={(e) => e.stopPropagation()}>
                    <PickSelect
                      value={it.status_c}
                      onChange={(v) => move(it, v)}
                      options={stagesFor(it)}
                      labels={ITEM_STATUS_LABEL}
                      disabled={!access.canUpdate || busy === it.Id}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
              <span>
                {total} garment{total === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span>
                  {page} / {pages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageBody>

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add garment to a bill</DialogTitle>
            <DialogDescription>Choose the bill this garment belongs to.</DialogDescription>
          </DialogHeader>
          <FormField label="Order" required>
            <LookupPicker
              table="orders_c"
              searchField="Name"
              value={pickOrder}
              onChange={setPickOrder}
              placeholder="Search bill number…"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pickOrder}
              onClick={() => {
                setPickOpen(false);
                navigate(`/orders/${pickOrder}/add-item`);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
