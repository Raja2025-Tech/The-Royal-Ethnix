import { useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { RATE_STAGES, READY_STAGES, daysLeft, forKarigar, hasKarigar, lookupId, money, unwrapList } from '@/lib/tms';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';

export const route = { path: '/karigar-report', layout: 'owner', access: "profile === 'Owner_c' || profile === 'Manager_c'" };
export const nav = {
  icon: 'ChartColumn',
  label: 'Karigar Report',
  section: 'Production',
  profiles: ['Owner_c', 'Manager_c'],
  order: 46,
};

const OPEN = ['New', 'Fabric', 'Cut', 'Handwork', 'Stitch', 'Ready', 'Dispatched', 'Trial', 'Alter'];

export default function KarigarReport() {
  const { data, loading, error, run } = useFetch(async () => {
    const [karigars, items, payments] = await Promise.all([
      sdk.table('karigars_c').select(['Name', 'specialty_c']).page(1, 100).fetch().then(unwrapList),
      sdk
        .table('order_items_c')
        .select(['karigar_c', 'status_c', 'due_date_c', 'received_on_c', 'fabric_given_on_c', 'wage_c', 'qty_c', 'karigar2_c', 'karigar3_c', 'wage2_c', 'wage3_c'])
        .page(1, 100)
        .fetch()
        .then(unwrapList),
      sdk.table('karigar_payments_c').select(['karigar_c', 'amount_c']).page(1, 100).fetch().then(unwrapList),
    ]);
    return { karigars, items, payments };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.karigars
      .map((k) => {
        const mine = data.items.filter((i) => hasKarigar(i, k.Id)).map((i) => forKarigar(i, k.Id));
        const finished = mine.filter((i) => READY_STAGES.includes(i.status_c));
        const timed = mine.filter((i) => i.received_on_c && i.due_date_c);
        const onTime = timed.filter((i) => i.received_on_c <= i.due_date_c).length;
        const turn = mine.filter((i) => i.received_on_c && i.fabric_given_on_c);
        const avgDays = turn.length
          ? turn.reduce((s, i) => s + differenceInCalendarDays(parseISO(i.received_on_c), parseISO(i.fabric_given_on_c)), 0) / turn.length
          : null;
        const earned = mine.filter((i) => RATE_STAGES.includes(i.status_c)).reduce((s, i) => s + (Number(i.wage_c) || 0), 0);
        const paid = data.payments
          .filter((p) => String(lookupId(p.karigar_c)) === String(k.Id))
          .reduce((s, p) => s + (Number(p.amount_c) || 0), 0);
        return {
          id: k.Id,
          name: k.Name,
          garments: mine.length,
          finished: finished.length,
          active: mine.filter((i) => OPEN.includes(i.status_c)).length,
          alteration: mine.filter((i) => i.status_c === 'Alter').length,
          late: mine.filter((i) => OPEN.includes(i.status_c) && (daysLeft(i.due_date_c) ?? 0) < 0).length,
          onTimePct: timed.length ? Math.round((onTime / timed.length) * 100) : null,
          avgDays,
          earned,
          paid,
        };
      })
      .sort((a, b) => b.garments - a.garments);
  }, [data]);

  const totals = rows.reduce(
    (t, r) => ({ garments: t.garments + r.garments, finished: t.finished + r.finished, alteration: t.alteration + r.alteration, late: t.late + r.late }),
    { garments: 0, finished: 0, alteration: 0, late: 0 },
  );
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader title="Karigar Report" description="Garments, speed, alterations and money for every karigar." />
      <PageBody>
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {firstLoad && <ListSkeleton rows={5} />}
        {data && rows.length === 0 && <EmptyBlock icon="ChartColumn" title="No karigars yet" text="Add karigars and assign garments to see the report." />}
        {data && rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Garments assigned" value={totals.garments} />
              <StatCard label="Finished" value={totals.finished} tone="text-success" />
              <StatCard label="In alteration" value={totals.alteration} tone={totals.alteration ? 'text-warning' : undefined} />
              <StatCard label="Running late" value={totals.late} tone={totals.late ? 'text-destructive' : undefined} />
            </div>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-2 font-heading text-lg font-semibold">Garments by karigar</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12 }} />
                    <Bar dataKey="finished" name="Finished" stackId="a" fill="var(--chart-1)" />
                    <Bar dataKey="active" name="In progress" stackId="a" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-3">Karigar</th>
                    <th className="p-3 text-right">Garments</th>
                    <th className="p-3 text-right">Finished</th>
                    <th className="p-3 text-right">Active</th>
                    <th className="p-3 text-right">Alteration</th>
                    <th className="p-3 text-right">Late</th>
                    <th className="p-3 text-right">On time</th>
                    <th className="p-3 text-right">Avg days</th>
                    <th className="p-3 text-right">Earned</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 font-medium">{r.name}</td>
                      <td className="p-3 text-right">{r.garments}</td>
                      <td className="p-3 text-right">{r.finished}</td>
                      <td className="p-3 text-right">{r.active}</td>
                      <td className="p-3 text-right">{r.alteration}</td>
                      <td className={`p-3 text-right ${r.late ? 'font-semibold text-destructive' : ''}`}>{r.late}</td>
                      <td className="p-3 text-right">{r.onTimePct === null ? '—' : `${r.onTimePct}%`}</td>
                      <td className="p-3 text-right">{r.avgDays === null ? '—' : r.avgDays.toFixed(1)}</td>
                      <td className="p-3 text-right">{money(r.earned)}</td>
                      <td className="p-3 text-right">{money(r.paid)}</td>
                      <td className={`p-3 text-right font-semibold ${r.earned - r.paid > 0 ? 'text-destructive' : ''}`}>{money(r.earned - r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              On time = garment received back on or before its karigar due date. Avg days = fabric given to garment received.
            </p>
          </>
        )}
      </PageBody>
    </div>
  );
}
