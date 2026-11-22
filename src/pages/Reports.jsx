import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { aggregateMany, monthStartStr } from '@/lib/agg';
import { NON_EXPENSE_HEADS, money, unwrapList } from '@/lib/tms';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/FormField';
import { ErrorBlock } from '@/components/StateBlocks';
import { StatsSkeleton } from '@/components/PageSkeleton';

import { eq, gte, ne } from '@/services/query';

export const route = { path: '/reports', layout: 'owner', access: "profile === 'Owner_c' || profile === 'Manager_c'" };
export const nav = {
  icon: 'ChartColumn',
  label: 'Reports',
  section: 'Money',
  profiles: ['Owner_c', 'Manager_c'],
  order: 100,
};

const chartTip = {
  cursor: { fill: 'var(--accent)' },
  contentStyle: { background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12 },
};

function ChartCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 font-heading text-lg font-semibold">{title}</h2>
      <div className="h-64">{children}</div>
    </section>
  );
}

export default function Reports() {
  const month = monthStartStr();

  const { data, loading, error, run } = useFetch(async () => {
    const [cats, karigars, outRows] = await Promise.all([
      sdk.table('categories_c').select(['Name']).orderBy('Name').page(1, 50).fetch().then(unwrapList),
      sdk.table('karigars_c').select(['Name']).orderBy('Name').page(1, 50).fetch().then(unwrapList),
      sdk
        .table('cashbook_c')
        .select(['Name', 'category_c', 'amount_c', 'entry_date_c'])
        .where(eq('kind_c', 'Out'))
        .page(1, 500)
        .fetch()
        .then(unwrapList),
    ]);
    const bills = await aggregateMany('orders_c', [
      { id: 'billed', field: 'total_c', fn: 'Sum', where: ne('status_c', 'Cancelled') },
      { id: 'collAll', field: 'paid_c', fn: 'Sum', where: ne('status_c', 'Cancelled') },
      { id: 'collMonth', field: 'paid_c', fn: 'Sum', where: gte('order_date_c', month) },
      { id: 'cash', field: 'cash_c', fn: 'Sum', where: ne('status_c', 'Cancelled') },
      { id: 'card', field: 'card_c', fn: 'Sum', where: ne('status_c', 'Cancelled') },
      { id: 'upi', field: 'upi_c', fn: 'Sum', where: ne('status_c', 'Cancelled') },
    ]);
    const kpay = await aggregateMany('karigar_payments_c', [
      { id: 'kAll', field: 'amount_c', fn: 'Sum' },
      { id: 'kMonth', field: 'amount_c', fn: 'Sum', where: gte('paid_on_c', month) },
    ]);
    const work = await aggregateMany('order_items_c', [
      ...cats.map((c) => ({ id: `cat_${c.Id}`, where: eq('category_c', c.Id) })),
      ...karigars.flatMap((k) => [
        { id: `kn_${k.Id}`, where: eq('karigar_c', k.Id) },
        { id: `kw_${k.Id}`, field: 'wage_c', fn: 'Sum', where: eq('karigar_c', k.Id) },
      ]),
    ]);
    const expenseRows = outRows.filter((r) => !NON_EXPENSE_HEADS.includes(r.category_c));
    const byHead = {};
    expenseRows.forEach((r) => {
      const k = r.category_c || 'General';
      byHead[k] = (byHead[k] ?? 0) + (Number(r.amount_c) || 0);
    });
    const expAll = expenseRows.reduce((s, r) => s + (Number(r.amount_c) || 0), 0);
    const expMonth = expenseRows
      .filter((r) => (r.entry_date_c ?? '') >= month)
      .reduce((s, r) => s + (Number(r.amount_c) || 0), 0);
    return { cats, karigars, ...bills, ...kpay, work, byHead, expAll, expMonth };
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title="Reports" />
        <PageBody>
          <ErrorBlock message={error.message} onRetry={run} />
        </PageBody>
      </div>
    );
  }

  const d = data;
  const netMonth = d ? d.collMonth - d.expMonth - d.kMonth : 0;
  const netAll = d ? d.collAll - d.expAll - d.kAll : 0;
  const modeChart = d
    ? [
        { name: 'Cash', amount: d.cash },
        { name: 'Card', amount: d.card },
        { name: 'UPI', amount: d.upi },
      ]
    : [];
  const headChart = d ? Object.entries(d.byHead).map(([name, amount]) => ({ name, amount })) : [];
  const catChart = d ? d.cats.map((c) => ({ name: c.Name, count: d.work[`cat_${c.Id}`] ?? 0 })).filter((c) => c.count > 0) : [];

  return (
    <div>
      <PageHeader title="Reports" description="Profit, collections by payment mode, spending and workshop performance." />
      <PageBody>
        {loading && d === undefined && <StatsSkeleton count={4} />}
        {d && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Collected this month" value={money(d.collMonth)} tone="text-success" hint="Bills dated this month" />
              <StatCard label="Expenses this month" value={money(d.expMonth)} hint="From the cashbook" />
              <StatCard label="Karigar paid this month" value={money(d.kMonth)} />
              <StatCard
                label="Net profit this month"
                value={money(netMonth)}
                tone={netMonth >= 0 ? 'text-success' : 'text-destructive'}
                hint="Collected minus expenses and karigar pay"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total billed" value={money(d.billed)} />
              <StatCard label="Collected all time" value={money(d.collAll)} />
              <StatCard label="Expenses all time" value={money(d.expAll)} />
              <StatCard
                label="Net profit all time"
                value={money(netAll)}
                tone={netAll >= 0 ? 'text-success' : 'text-destructive'}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Collections by payment mode">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modeChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <Tooltip {...chartTip} formatter={(v) => money(v)} />
                    <Bar dataKey="amount" name="Collected" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Expenses by head">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={headChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <Tooltip {...chartTip} formatter={(v) => money(v)} />
                    <Bar dataKey="amount" name="Spent" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <ChartCard title="Garments by category">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip {...chartTip} />
                  <Bar dataKey="count" name="Garments" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-heading text-lg font-semibold">Karigar summary</h2>
              </div>
              <div className="divide-y divide-border">
                {d.karigars.map((k) => (
                  <Link
                    key={k.Id}
                    to={`/karigars/${k.Id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-accent/50"
                  >
                    <p className="font-medium">{k.Name}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.work[`kn_${k.Id}`]} garments · Wages booked {money(d.work[`kw_${k.Id}`])}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </PageBody>
    </div>
  );
}
