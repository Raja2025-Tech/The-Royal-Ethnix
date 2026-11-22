import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import {
  ORDER_FIELDS,
  ORDER_STATUSES,
  cadStyles,
  daysLabel,
  daysLeft,
  daysTone,
  fmtDate,
  money,
  orderDue,
  orderStatusStyles,
  priorityStyles,
  unwrapList,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import PickSelect from '@/components/PickSelect';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { eq, isIn, or, contains, and } from '@/services/query';

export const route = { path: '/orders', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'ClipboardList',
  label: 'Orders',
  section: 'Production',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 30,
  count: { table: 'orders_c', where: null },
};

const PAGE_SIZE = 20;
const FILTERS = ['Open', 'All', ...ORDER_STATUSES];
const SORTS = { delivery: 'Delivery date', recent: 'Newest first', total: 'Highest bill' };

function DeliveryCell({ order }) {
  const n = order.status_c === 'Delivered' ? null : daysLeft(order.delivery_date_c);
  return (
    <div>
      <p className="text-sm">{fmtDate(order.delivery_date_c)}</p>
      {n !== null && <p className={cn('text-xs font-medium', daysTone(n))}>{daysLabel(n)}</p>}
    </div>
  );
}

function ProcessAction({ order }) {
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/orders/${order.Id}?tab=process`);
      }}
    >
      <AppIcon name="Workflow" size={14} /> Order process
    </Button>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'orders_c');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Open');
  const [sort, setSort] = useState('delivery');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, filter, sort]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (search.trim()) f.push(or(contains('Name', search.trim()), contains('bill_no_c', search.trim())));
    if (filter === 'Open') f.push(isIn('status_c', ['Draft', 'Active', 'Ready']));
    else if (filter !== 'All') f.push(eq('status_c', filter));
    let q = sdk.table('orders_c').select(ORDER_FIELDS);
    if (f.length) q = q.where(and(...f));
    if (sort === 'delivery') q = q.orderBy('delivery_date_c');
    else if (sort === 'total') q = q.orderByDesc('total_c');
    else q = q.orderByDesc('CreatedOn');
    return q.page(page, PAGE_SIZE).fetch().then((r) => ({ rows: unwrapList(r), total: r.total ?? 0 }));
  }, [search, filter, sort, page]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const firstLoad = loading && data === undefined;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every custom order from booking to delivery."
        actions={
          access.canCreate && (
            <Button className={ctaClass} asChild>
              <Link to="/orders/new">
                <AppIcon name="Plus" size={16} /> Create order
              </Link>
            </Button>
          )
        }
      />
      <PageBody>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by bill number…"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-96">
            <PickSelect value={filter} onChange={setFilter} options={FILTERS} />
            <PickSelect value={sort} onChange={setSort} options={Object.keys(SORTS)} labels={SORTS} />
          </div>
        </div>

        {firstLoad && <ListSkeleton rows={8} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock
            icon="ClipboardList"
            title="No orders found"
            text="Try another filter, or create a new order for a customer."
            action={
              access.canCreate && (
                <Button asChild>
                  <Link to="/orders/new">Create order</Link>
                </Button>
              )
            }
          />
        )}

        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('transition-opacity', loading && 'pointer-events-none opacity-60')}>
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill no</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead className="text-right">Bill / Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CAD</TableHead>
                    <TableHead className="text-right">Process</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow key={o.Id} className="cursor-pointer" onClick={() => navigate(`/orders/${o.Id}`)}>
                      <TableCell>
                        <p className="font-medium">{o.bill_no_c || o.Name}</p>
                      </TableCell>
                      <TableCell>
                        <p>{o.customer_c?.Name ?? '—'}</p>
                        {o.priority_c && o.priority_c !== 'Normal' && (
                          <StatusBadge styles={priorityStyles} value={o.priority_c} />
                        )}
                      </TableCell>
                      <TableCell>
                        <DeliveryCell order={o} />
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-medium">{money(o.total_c)}</p>
                        <p className={cn('text-xs', orderDue(o) > 0 ? 'text-destructive' : 'text-success')}>
                          {orderDue(o) > 0 ? `Due ${money(orderDue(o))}` : 'Settled'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge styles={orderStatusStyles} value={o.status_c} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge styles={cadStyles} value={o.cad_pattern_c} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ProcessAction order={o} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {rows.map((o) => (
                <div
                  key={o.Id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/orders/${o.Id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/orders/${o.Id}`)}
                  className="cursor-pointer space-y-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{o.bill_no_c || o.Name}</p>
                    </div>
                    <StatusBadge styles={orderStatusStyles} value={o.status_c} />
                  </div>
                  <p className="text-sm">{o.customer_c?.Name ?? '—'}</p>
                  <div className="flex items-end justify-between">
                    <DeliveryCell order={o} />
                    <div className="text-right">
                      <p className="text-sm font-medium">{money(o.total_c)}</p>
                      <p className={cn('text-xs', orderDue(o) > 0 ? 'text-destructive' : 'text-success')}>
                        {orderDue(o) > 0 ? `Due ${money(orderDue(o))}` : 'Settled'}
                      </p>
                    </div>
                  </div>
                  <ProcessAction order={o} />
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {total} order{total === 1 ? '' : 's'}
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
    </div>
  );
}
