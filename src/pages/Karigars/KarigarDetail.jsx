import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import {
  ITEM_FIELDS,
  ITEM_STATUS_LABEL,
  KARIGAR_FIELDS,
  KPAY_FIELDS,
  SPECIALTY_LABEL,
  activeStyles,
  fmtDate,
  itemStatusStyles,
  karigarEarned,
  forKarigar,
  kpayStyles,
  money,
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
import KarigarDialog from './KarigarDialog';
import KpayDialog from '@/pages/Majuri/KpayDialog';
import { openKarigarStatement } from '@/lib/statement';

import { eq } from '@/services/query';
import { or as q_or } from '@/services/query';

export const route = { path: '/karigars/:id', layout: 'owner', access: 'authenticated' };

export default function KarigarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'karigars_c');
  const payAccess = getTableAccess(profile, 'karigar_payments_c');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const { data, loading, error, run } = useFetch(async () => {
    const kRes = await sdk.table('karigars_c').select(KARIGAR_FIELDS).get(id);
    const iRes = await sdk
      .table('order_items_c')
      .select(ITEM_FIELDS)
      .where(q_or(eq('karigar_c', id), eq('karigar2_c', id), eq('karigar3_c', id)))
      .orderByDesc('CreatedOn')
      .page(1, 50)
      .fetch();
    if (!iRes.success) throw new Error(iRes.message);
    let payments = [];
    if (payAccess.canRead) {
      const pRes = await sdk.table('karigar_payments_c').select(KPAY_FIELDS).where(eq('karigar_c', id)).orderByDesc('paid_on_c').page(1, 50).fetch();
      if (pRes.success) payments = pRes.data;
    }
    return { karigar: kRes.data, items: iRes.data.map((i) => forKarigar(i, id)), payments };
  }, [id]);

  const karigar = data?.karigar;
  const items = data?.items ?? [];
  const payments = data?.payments ?? [];

  async function remove() {
    if (items.length) {
      toast.error('This karigar has garments assigned. Mark them inactive instead of deleting.');
      setDeleteOpen(false);
      return;
    }
    setDeleting(true);
    try {
      const res = await sdk.table('karigars_c').remove(id);
      if (!writeOk(res)) return;
      toast.success('Karigar deleted');
      navigate('/karigars');
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data === undefined) {
    return (
      <div>
        <PageHeader title="Karigar" back={{ to: '/karigars', label: 'Back to Karigars' }} />
        <PageBody>
          <DetailSkeleton />
        </PageBody>
      </div>
    );
  }
  if (error || !karigar) {
    return (
      <div>
        <PageHeader title="Karigar" back={{ to: '/karigars', label: 'Back to Karigars' }} />
        <PageBody>
          {error ? (
            <ErrorBlock message={error.message} onRetry={run} />
          ) : (
            <EmptyBlock icon="SearchX" title="Karigar not found" text="They may have been deleted." />
          )}
        </PageBody>
      </div>
    );
  }

  const earned = karigarEarned(items);
  const paid = payments.reduce((s, p) => s + (Number(p.amount_c) || 0), 0);
  const balance = earned - paid;
  const inProgress = items.filter((i) => i.status_c !== 'Done' && i.status_c !== 'Delivered');

  return (
    <div>
      <PageHeader
        title={karigar.Name}
        description={`${SPECIALTY_LABEL[karigar.specialty_c] ?? ''}${karigar.phone_c ? ` · ${karigar.phone_c}` : ''}`}
        back={{ to: '/karigars', label: 'Back to Karigars' }}
        actions={
          <>
            {payAccess.canRead && (
              <Button
                variant="outline"
                className={headerGhostClass}
                onClick={() => openKarigarStatement({ karigar, payments, items, earned: karigarEarned(items) })}
              >
                <AppIcon name="Download" size={16} /> Statement (PDF)
              </Button>
            )}
            {payAccess.canCreate && (
              <Button className={ctaClass} onClick={() => setPayOpen(true)}>
                <AppIcon name="Wallet" size={16} /> Pay karigar
              </Button>
            )}
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
        {payAccess.canRead && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Majuri earned" value={money(earned)} hint="From Ready for Dispatch onward" />
            <StatCard label="Paid so far" value={money(paid)} tone="text-success" />
            <StatCard
              label={balance >= 0 ? 'Balance payable' : 'Advance given'}
              value={money(Math.abs(balance))}
              tone={balance > 0 ? 'text-destructive' : undefined}
            />
            <StatCard label="In progress" value={inProgress.length} hint="Garments on the bench" />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <section className="h-fit rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Profile</h2>
            <dl className="mt-2">
              <InfoRow label="Status">
                <StatusBadge styles={activeStyles} value={karigar.active_c ? 'Active' : 'Inactive'} />
              </InfoRow>
              <InfoRow label="Specialty">{SPECIALTY_LABEL[karigar.specialty_c]}</InfoRow>
              <InfoRow label="Phone">
                {karigar.phone_c ? (
                  <a href={`tel:${karigar.phone_c}`} className="text-primary hover:underline">
                    {karigar.phone_c}
                  </a>
                ) : null}
              </InfoRow>
              <InfoRow label="Joined">{fmtDate(karigar.joined_c)}</InfoRow>
            </dl>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{karigar.notes_c || 'No notes.'}</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Assigned garments</h2>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No garments assigned yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {items.map((i) => (
                  <Link
                    key={i.Id}
                    to={`/order-items/${i.Id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{i.Name}</p>
                      <p className="text-xs text-muted-foreground">
                        Order {i.order_c?.Name} · Due {fmtDate(i.due_date_c)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {payAccess.canRead && <span className="text-sm">{money(i.wage_c)}</span>}
                      <StatusBadge styles={itemStatusStyles} value={i.status_c} label={ITEM_STATUS_LABEL[i.status_c]} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {payAccess.canRead && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Payment history</h2>
            {payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No payments to this karigar yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {payments.map((p) => (
                  <Link
                    key={p.Id}
                    to={`/majuri/${p.Id}`}
                    className="flex items-center justify-between gap-2 py-3 hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">{p.Name}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.paid_on_c)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge styles={kpayStyles} value={p.type_c} />
                      <span className="font-semibold">{money(p.amount_c)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </PageBody>

      <KarigarDialog open={editOpen} onOpenChange={setEditOpen} record={karigar} onSaved={run} />
      <KpayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        fixedKarigarId={id}
        fixedKarigarName={karigar.Name}
        onSaved={run}
      />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${karigar.Name}?`}
        description="Karigars with assigned garments cannot be deleted. This cannot be undone."
        onConfirm={remove}
        busy={deleting}
      />
    </div>
  );
}
