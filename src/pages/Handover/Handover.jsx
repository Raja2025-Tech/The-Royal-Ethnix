import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import {
  ITEM_FIELDS,
  ITEM_STATUS_LABEL,
  daysLabel,
  daysLeft,
  daysTone,
  fabricLabel,
  fmtDate,
  itemStatusStyles,
  karigarNames,
  kindStyles,
  unwrapList,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import LookupPicker from '@/components/LookupPicker';
import { PageBody, PageHeader } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import HandoverDialog from './HandoverDialog';

import { eq } from '@/services/query';
import { or as orF } from '@/services/query';

export const route = { path: '/handover', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'ArrowLeftRight',
  label: 'Karigar Handover',
  section: 'Production',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 45,
};

const TABS = [
  { key: 'give', label: 'To give' },
  { key: 'with', label: 'With karigar' },
  { key: 'recv', label: 'Received' },
];

export default function Handover() {
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'order_items_c');
  const [tab, setTab] = useState('with');
  const [karigar, setKarigar] = useState(null);
  const [dlg, setDlg] = useState({ open: false, item: null, mode: 'give' });

  const { data, loading, error, run } = useFetch(() => {
    let q = sdk.table('order_items_c').select(ITEM_FIELDS);
    if (karigar) {
      q = q.where(orF(eq('karigar_c', karigar), eq('karigar2_c', karigar), eq('karigar3_c', karigar)));
    }
    return q.orderBy('due_date_c').page(1, 200).fetch().then(unwrapList);
  }, [karigar]);

  const items = data ?? [];
  const live = items.filter((i) => i.status_c !== 'Delivered');
  const lists = {
    give: live.filter((i) => i.karigar_c && !i.fabric_given_on_c && !i.received_on_c),
    with: live.filter((i) => i.fabric_given_on_c && !i.received_on_c),
    recv: items
      .filter((i) => i.received_on_c)
      .sort((a, b) => String(b.received_on_c).localeCompare(String(a.received_on_c))),
  };
  const rows = lists[tab];
  const firstLoad = loading && data === undefined;

  const holding = {};
  lists.with.forEach((i) => {
    const k = karigarNames(i, 'No karigar');
    holding[k] = holding[k] || { pieces: 0, meters: 0, cm: 0 };
    holding[k].pieces += 1;
    if (i.fabric_unit_c === 'CM') holding[k].cm += Number(i.fabric_qty_c) || 0;
    else holding[k].meters += Number(i.fabric_qty_c) || 0;
  });

  const open = (item, mode) => setDlg({ open: true, item, mode });

  return (
    <div>
      <PageHeader
        title="Karigar Handover"
        description="Track fabric given to each karigar and the garments received back."
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_18rem]">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key)}>
                {t.label} ({lists[t.key].length})
              </Button>
            ))}
          </div>
          <LookupPicker
            table="karigars_c"
            searchField="Name"
            value={karigar}
            onChange={setKarigar}
            placeholder="All karigars"
            clearable
          />
        </div>

        {tab === 'with' && Object.keys(holding).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(holding).map(([name, h]) => (
              <span key={name} className="rounded-full border border-border bg-card px-3 py-1 text-xs">
                <span className="font-medium">{name}</span> · {h.pieces} pc · {h.meters.toFixed(1)} m
                {h.cm > 0 ? ` + ${h.cm.toFixed(0)} cm` : ''} fabric
              </span>
            ))}
          </div>
        )}

        {firstLoad && <ListSkeleton rows={6} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock
            icon="ArrowLeftRight"
            title="Nothing here"
            text={
              tab === 'give'
                ? 'Every assigned garment already has fabric handed over.'
                : tab === 'with'
                  ? 'No fabric is currently with any karigar.'
                  : 'No garments have been received back yet.'
            }
          />
        )}

        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('space-y-3 transition-opacity', loading && 'opacity-60')}>
            {rows.map((it) => {
              const dl = daysLeft(it.due_date_c);
              const held = it.fabric_given_on_c ? -daysLeft(it.fabric_given_on_c) : null;
              return (
                <div key={it.Id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <Link to={`/order-items/${it.Id}`} className="truncate font-medium hover:underline">
                      {it.Name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge styles={kindStyles} value={it.kind_c} />
                      <span>Bill {it.order_c?.Name ?? '—'}</span>
                      <span>· {karigarNames(it, 'No karigar')}</span>
                      <StatusBadge styles={itemStatusStyles} value={it.status_c} label={ITEM_STATUS_LABEL[it.status_c]} />
                    </div>
                    {it.fabric_c && <p className="mt-1 text-xs text-muted-foreground">{it.fabric_c}</p>}
                  </div>
                  <div className="text-sm md:w-48">
                    {tab === 'give' && (
                      <>
                        <p className="text-xs text-muted-foreground">Karigar due</p>
                        <p>{fmtDate(it.due_date_c)}</p>
                        {dl !== null && <p className={cn('text-xs font-medium', daysTone(dl))}>{daysLabel(dl)}</p>}
                      </>
                    )}
                    {tab === 'with' && (
                      <>
                        <p className="text-xs text-muted-foreground">Given {fmtDate(it.fabric_given_on_c)}</p>
                        <p>
                          {fabricLabel(it) || '—'} · {held}d with karigar
                        </p>
                        {dl !== null && <p className={cn('text-xs font-medium', daysTone(dl))}>Due {daysLabel(dl)}</p>}
                      </>
                    )}
                    {tab === 'recv' && (
                      <>
                        <p className="text-xs text-muted-foreground">Received</p>
                        <p>{fmtDate(it.received_on_c)}</p>
                        <p className="text-xs text-muted-foreground">{fabricLabel(it) || '—'} given</p>
                      </>
                    )}
                  </div>
                  <div className="md:w-44 md:text-right">
                    {access.canUpdate && tab === 'give' && (
                      <Button size="sm" onClick={() => open(it, 'give')}>
                        <AppIcon name="ArrowUpFromLine" size={14} /> Give fabric
                      </Button>
                    )}
                    {access.canUpdate && tab === 'with' && (
                      <Button size="sm" variant="outline" onClick={() => open(it, 'receive')}>
                        <AppIcon name="ArrowDownToLine" size={14} /> Receive garment
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>

      <HandoverDialog
        open={dlg.open}
        onOpenChange={(o) => setDlg((d) => ({ ...d, open: o }))}
        item={dlg.item}
        mode={dlg.mode}
        onSaved={run}
      />
    </div>
  );
}
