import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import {
  CUSTOMER_FIELDS,
  ORDER_FIELDS,
  fmtDate,
  money,
  orderDue,
  orderStatusStyles,
  writeOk,
} from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass, headerGhostClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDelete from '@/components/ConfirmDelete';
import { InfoRow, StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import CustomerDialog from './CustomerDialog';

import { eq } from '@/services/query';

export const route = { path: '/customers/:id', layout: 'owner', access: 'authenticated' };

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'customers_c');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, run } = useFetch(async () => {
    const [cRes, oRes] = await Promise.all([
      sdk.table('customers_c').select(CUSTOMER_FIELDS).get(id),
      sdk.table('orders_c').select(ORDER_FIELDS).where(eq('customer_c', id)).orderByDesc('CreatedOn').page(1, 50).fetch(),
    ]);
    if (!oRes.success) throw new Error(oRes.message);
    return { customer: cRes.data, orders: oRes.data };
  }, [id]);

  const customer = data?.customer;
  const orders = data?.orders ?? [];

  async function remove() {
    if (orders.length) {
      toast.error('This customer has orders. Delete or reassign them first.');
      setDeleteOpen(false);
      return;
    }
    setDeleting(true);
    try {
      const res = await sdk.table('customers_c').remove(id);
      if (!writeOk(res)) return;
      toast.success('Customer deleted');
      navigate('/customers');
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data === undefined) {
    return (
      <div>
        <PageHeader title="Customer" back={{ to: '/customers', label: 'Back to Customers' }} />
        <PageBody>
          <DetailSkeleton />
        </PageBody>
      </div>
    );
  }
  if (error || !customer) {
    return (
      <div>
        <PageHeader title="Customer" back={{ to: '/customers', label: 'Back to Customers' }} />
        <PageBody>
          {error ? (
            <ErrorBlock message={error.message} onRetry={run} />
          ) : (
            <EmptyBlock icon="SearchX" title="Customer not found" text="They may have been deleted." />
          )}
        </PageBody>
      </div>
    );
  }

  const billed = orders.reduce((s, o) => s + (Number(o.total_c) || 0), 0);
  const due = orders.reduce((s, o) => s + orderDue(o), 0);

  return (
    <div>
      <PageHeader
        title={customer.Name}
        description={customer.phone_c || 'No phone number'}
        back={{ to: '/customers', label: 'Back to Customers' }}
        actions={
          <>
            {access.canUpdate && (
              <Button variant="outline" className={headerGhostClass} onClick={() => setEditOpen(true)}>
                <AppIcon name="Pencil" size={16} /> Edit
              </Button>
            )}
            {access.canDelete && (
              <Button variant="outline" className={headerGhostClass} onClick={() => setDeleteOpen(true)}>
                <AppIcon name="Trash2" size={16} /> Delete
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Orders" value={orders.length} />
          <StatCard label="Total billed" value={money(billed)} />
          <StatCard label="Balance due" value={money(due)} tone={due > 0 ? 'text-destructive' : undefined} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <section className="h-fit rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Profile</h2>
            <dl className="mt-2">
              <InfoRow label="Phone">
                {customer.phone_c ? (
                  <a href={`tel:${customer.phone_c}`} className="text-primary hover:underline">
                    {customer.phone_c}
                  </a>
                ) : null}
              </InfoRow>
              <InfoRow label="Source">{customer.source_c}</InfoRow>
              <InfoRow label="Birthday">{customer.birthday_c ? fmtDate(customer.birthday_c) : null}</InfoRow>
              <InfoRow label="Address">{customer.address_c}</InfoRow>
              <InfoRow label="Customer since">{fmtDate(customer.CreatedOn)}</InfoRow>
            </dl>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{customer.notes_c || 'No notes.'}</p>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Order history</h2>
              <Button size="sm" className={ctaClass} asChild>
                <Link to="/orders/new">New order</Link>
              </Button>
            </div>
            {orders.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No orders yet for this customer.</p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {orders.map((o) => (
                  <Link
                    key={o.Id}
                    to={`/orders/${o.Id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">{o.Name}</p>
                      <p className="text-xs text-muted-foreground">
                        Delivery {fmtDate(o.delivery_date_c)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{money(o.total_c)}</span>
                      <StatusBadge styles={orderStatusStyles} value={o.status_c} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </PageBody>
      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} record={customer} onSaved={run} />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${customer.Name}?`}
        description="Customers with orders cannot be deleted. This cannot be undone."
        onConfirm={remove}
        busy={deleting}
      />
    </div>
  );
}
