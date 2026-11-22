import { useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import { aggregateMany } from '@/lib/agg';
import { CASHBOOK_FIELDS, fmtDate, isoDays, money, todayStr, unwrapList, writeOk } from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass, headerGhostClass } from '@/components/PageHeader';
import { StatCard } from '@/components/FormField';
import ConfirmDelete from '@/components/ConfirmDelete';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton, StatsSkeleton } from '@/components/PageSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { openCashbookClosing } from '@/lib/statement';
import CashbookDialog from './CashbookDialog';

import { eq, ne, lt, and } from '@/services/query';

export const route = { path: '/cashbook', layout: 'owner', access: "profile === 'Owner_c' || profile === 'Staff_c' || profile === 'Manager_c'" };
export const nav = {
  icon: 'BookOpen',
  label: 'Daily Cashbook',
  section: 'Overview',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 5,
};

export default function Cashbook() {
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'cashbook_c');
  const [date, setDate] = useState(todayStr());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [presetKind, setPresetKind] = useState('In');
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  // Karigar payments in the cashbook are for Admin and Manager only.
  const hideKarigar = profile === 'Staff_c';

  const { data, loading, error, run } = useFetch(async () => {
    const extra = hideKarigar ? [ne('category_c', 'Karigar')] : [];
    const [rows, before] = await Promise.all([
      sdk
        .table('cashbook_c')
        .select(CASHBOOK_FIELDS)
        .where(and(eq('entry_date_c', date), ...extra))
        .orderBy('CreatedOn')
        .page(1, 200)
        .fetch()
        .then(unwrapList),
      aggregateMany('cashbook_c', [
        { id: 'in', field: 'amount_c', fn: 'Sum', where: and(eq('kind_c', 'In'), lt('entry_date_c', date), ...extra) },
        { id: 'out', field: 'amount_c', fn: 'Sum', where: and(eq('kind_c', 'Out'), lt('entry_date_c', date), ...extra) },
      ]),
    ]);
    return { rows, opening: before.in - before.out };
  }, [date, hideKarigar]);

  const rows = data?.rows ?? [];
  const totalIn = rows.filter((r) => r.kind_c === 'In').reduce((s, r) => s + (Number(r.amount_c) || 0), 0);
  const totalOut = rows.filter((r) => r.kind_c === 'Out').reduce((s, r) => s + (Number(r.amount_c) || 0), 0);
  const opening = data?.opening ?? 0;
  const closing = opening + totalIn - totalOut;
  const firstLoad = loading && data === undefined;
  const isToday = date === todayStr();

  function openNew(kind) {
    setEditing(null);
    setPresetKind(kind);
    setDialogOpen(true);
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await sdk.table('cashbook_c').remove(removing.Id);
      if (res.success === false && !writeOk(res)) return;
      setRemoving(null);
      run();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Daily Cashbook"
        description="Opening balance, every cash in and out, and the closing balance for the day."
        actions={
          <>
            <Button
              variant="outline"
              className={headerGhostClass}
              disabled={!data}
              onClick={() => openCashbookClosing({ date, opening, rows, totalIn, totalOut, closing })}
            >
              <AppIcon name="Printer" size={16} /> Print closing
            </Button>
            {access.canCreate && (
            <>
              <Button className={ctaClass} onClick={() => openNew('In')}>
                <AppIcon name="ArrowDownToLine" size={16} /> Cash in
              </Button>
              <Button variant="outline" className={headerGhostClass} onClick={() => openNew('Out')}>
                <AppIcon name="ArrowUpFromLine" size={16} /> Cash out
              </Button>
            </>
            )}
          </>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setDate(isoDays(date, -1))}>
            <AppIcon name="ChevronLeft" size={16} />
          </Button>
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
          <Button variant="outline" size="icon" aria-label="Next day" onClick={() => setDate(isoDays(date, 1))}>
            <AppIcon name="ChevronRight" size={16} />
          </Button>
          {!isToday && (
            <Button variant="ghost" onClick={() => setDate(todayStr())}>
              Today
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">{fmtDate(date)}</span>
        </div>

        {firstLoad && <StatsSkeleton count={4} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Opening balance" value={money(opening)} />
            <StatCard label="Cash in" value={money(totalIn)} tone="text-success" />
            <StatCard label="Cash out" value={money(totalOut)} tone="text-destructive" />
            <StatCard label="Closing balance" value={money(closing)} tone={closing < 0 ? 'text-destructive' : undefined} />
          </div>
        )}

        {firstLoad && <ListSkeleton rows={5} />}
        {data && rows.length === 0 && (
          <EmptyBlock
            icon="BookOpen"
            title="No entries for this day"
            text="Add cash in and cash out entries to build the day's book."
            action={access.canCreate && <Button onClick={() => openNew('In')}>Add cash in</Button>}
          />
        )}
        {rows.length > 0 && (
          <div aria-busy={loading} className={cn('divide-y divide-border rounded-2xl border border-border bg-card', loading && 'opacity-60')}>
            {rows.map((r) => (
              <div key={r.Id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.Name}</p>
                  <p className="text-xs text-muted-foreground">{String(r.note_c || '').replace(/\s*\[order:[^\]]+\]/, '') || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.category_c ?? 'General'}</Badge>
                  <span className={cn('w-24 text-right font-semibold', r.kind_c === 'In' ? 'text-success' : 'text-destructive')}>
                    {r.kind_c === 'In' ? '+' : '−'}
                    {money(r.amount_c)}
                  </span>
                  {access.canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(r);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {access.canDelete && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(r)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>

      <CashbookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editing}
        presetKind={presetKind}
        presetDate={date}
        onSaved={run}
      />
      <ConfirmDelete
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this entry?"
        description="The day's closing balance will change."
        onConfirm={confirmRemove}
        busy={busy}
      />
    </div>
  );
}
