import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import {
  ITEM_STATUS_LABEL,
  ORDER_FIELDS,
  daysLabel,
  daysLeft,
  daysTone,
  fmtDate,
  itemStatusStyles,
  karigarNames,
  money,
  orderDue,
  orderStatusStyles,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Pipeline from '@/components/Pipeline';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { or, contains, isIn } from '@/services/query';

export const route = { path: '/track', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'ScanSearch',
  label: 'Track Order',
  section: 'Overview',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 20,
};

const ITEM_SELECT = ['Name', 'order_c', 'status_c', 'kind_c', 'karigar_c', 'karigar2_c', 'karigar3_c', 'handwork_c'];

export default function Track() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const [input, setInput] = useState(q);

  const { data, loading, error, run } = useFetch(async () => {
    if (!q) return { orders: [], items: [], phones: {} };
    const phoneQ = q.replace(/[\s-]/g, '');
    const [byOrder, custs] = await Promise.all([
      sdk.table('orders_c').select(ORDER_FIELDS).where(or(contains('bill_no_c', q), contains('Name', q))).page(1, 20).fetch(),
      sdk.table('customers_c').select(['Name', 'phone_c']).where(or(contains('phone_c', phoneQ), contains('Name', q))).page(1, 20).fetch(),
    ]);
    if (!byOrder.success) throw new Error(byOrder.message);
    const phones = {};
    (custs.data ?? []).forEach((c) => {
      phones[c.Id] = c.phone_c;
    });
    let byCust = [];
    const ids = Object.keys(phones);
    if (ids.length) {
      const r = await sdk.table('orders_c').select(ORDER_FIELDS).where(isIn('customer_c', ids)).page(1, 40).fetch();
      byCust = r.data ?? [];
    }
    const seen = new Set();
    const orders = [...byOrder.data, ...byCust].filter((o) => {
      if (seen.has(o.Id)) return false;
      seen.add(o.Id);
      return true;
    });
    let items = [];
    if (orders.length) {
      const r = await sdk.table('order_items_c').select(ITEM_SELECT).where(isIn('order_c', orders.map((o) => o.Id))).page(1, 100).fetch();
      items = r.data ?? [];
    }
    if (!Object.keys(phones).length || orders.some((o) => !phones[o.customer_c?.Id])) {
      const missing = orders.map((o) => o.customer_c?.Id).filter((id) => id && !phones[id]);
      if (missing.length) {
        const r = await sdk.table('customers_c').select(['Name', 'phone_c']).where(isIn('Id', missing)).page(1, 40).fetch();
        (r.data ?? []).forEach((c) => {
          phones[c.Id] = c.phone_c;
        });
      }
    }
    return { orders, items, phones };
  }, [q]);

  const orders = data?.orders ?? [];
  const items = data?.items ?? [];
  const phones = data?.phones ?? {};

  function submit(e) {
    e.preventDefault();
    setParams(input.trim() ? { q: input.trim() } : {});
  }

  return (
    <div>
      <PageHeader
        title="Track Order"
        description="Find any order by bill number, customer phone or name."
      />
      <PageBody>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <AppIcon name="Search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="AT/0255/2627 or 98300 11201"
              className="h-12 pl-10 text-base"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" className="h-12">
            Track status
          </Button>
        </form>

        {!q && (
          <EmptyBlock
            icon="ScanSearch"
            title="Search by bill number or phone"
            text="Type a bill number or a customer's phone number to see every order and the stage of each garment."
          />
        )}
        {q && loading && data === undefined && <ListSkeleton rows={3} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {q && !loading && !error && orders.length === 0 && (
          <EmptyBlock icon="SearchX" title={`No orders match "${q}"`} text="Check the bill number or try the last digits of the phone." />
        )}

        <div aria-busy={loading} className={cn('space-y-4', loading && data !== undefined && 'opacity-60')}>
          {orders.map((o) => {
            const its = items.filter((i) => String(i.order_c?.Id) === String(o.Id));
            const n = o.status_c === 'Delivered' ? null : daysLeft(o.delivery_date_c);
            const phone = phones[o.customer_c?.Id];
            return (
              <article key={o.Id} className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/orders/${o.Id}`} className="font-heading text-xl font-semibold hover:underline">
                      Bill {o.bill_no_c || o.Name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {o.customer_c?.Name}
                      {phone ? ` · ${phone}` : ''}
                    </p>
                  </div>
                  <StatusBadge styles={orderStatusStyles} value={o.status_c} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Delivery</p>
                    <p className="font-medium">{fmtDate(o.delivery_date_c)}</p>
                    {n !== null && <p className={cn('text-xs font-medium', daysTone(n))}>{daysLabel(n)}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trial</p>
                    <p className="font-medium">{fmtDate(o.trial_date_c)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance due</p>
                    <p className={cn('font-medium', orderDue(o) > 0 ? 'text-destructive' : 'text-success')}>
                      {money(orderDue(o))}
                    </p>
                  </div>
                </div>
                {its.length === 0 ? (
                  <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                    No garments added yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {its.map((i) => (
                      <div key={i.Id} className="space-y-2 rounded-xl bg-muted/60 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link to={`/order-items/${i.Id}`} className="text-sm font-medium hover:underline">
                            {i.Name}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{karigarNames(i, 'No karigar')}</span>
                            <StatusBadge styles={itemStatusStyles} value={i.status_c} label={ITEM_STATUS_LABEL[i.status_c]} />
                          </div>
                        </div>
                        <Pipeline status={i.status_c} handwork={i.handwork_c} />
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </PageBody>
    </div>
  );
}
