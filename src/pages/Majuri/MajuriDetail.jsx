import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { KPAY_FIELDS, fmtDate, kpayStyles, lookupId, money, writeOk } from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, headerGhostClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDelete from '@/components/ConfirmDelete';
import { InfoRow } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import KpayDialog from './KpayDialog';

export const route = { path: '/majuri/:id', layout: 'owner', access: "profile === 'Owner_c' || profile === 'Manager_c'" };

export default function MajuriDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, run } = useFetch(async () => {
    const res = await sdk.table('karigar_payments_c').select(KPAY_FIELDS).get(id);
    return { payment: res.data };
  }, [id]);
  const payment = data?.payment;

  async function remove() {
    setDeleting(true);
    try {
      const res = await sdk.table('karigar_payments_c').remove(id);
      if (!writeOk(res)) return;
      toast.success('Payment deleted');
      navigate('/majuri');
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data === undefined) {
    return (
      <div>
        <PageHeader title="Karigar payment" back={{ to: '/majuri', label: 'Back to Karigar Majuri' }} />
        <PageBody>
          <DetailSkeleton />
        </PageBody>
      </div>
    );
  }
  if (error || !payment) {
    return (
      <div>
        <PageHeader title="Karigar payment" back={{ to: '/majuri', label: 'Back to Karigar Majuri' }} />
        <PageBody>
          {error ? (
            <ErrorBlock message={error.message} onRetry={run} />
          ) : (
            <EmptyBlock icon="SearchX" title="Payment not found" text="It may have been deleted." />
          )}
        </PageBody>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={payment.Name}
        description={money(payment.amount_c)}
        back={{ to: '/majuri', label: 'Back to Karigar Majuri' }}
        actions={
          profile === 'Owner_c' && (
          <>
            <Button variant="outline" className={headerGhostClass} onClick={() => setEditOpen(true)}>
              <AppIcon name="Pencil" size={16} /> Edit
            </Button>
            <Button variant="outline" className={headerGhostClass} onClick={() => setDeleteOpen(true)}>
              <AppIcon name="Trash2" size={16} /> Delete
            </Button>
          </>
          )
        }
      />
      <PageBody>
        <section className="max-w-xl rounded-2xl border border-border bg-card p-5">
          <dl>
            <InfoRow label="Karigar">
              <Link to={`/karigars/${lookupId(payment.karigar_c)}`} className="text-primary hover:underline">
                {payment.karigar_c?.Name}
              </Link>
            </InfoRow>
            <InfoRow label="Type"><StatusBadge styles={kpayStyles} value={payment.type_c} /></InfoRow>
            <InfoRow label="Amount">{money(payment.amount_c)}</InfoRow>
            <InfoRow label="Paid on">{fmtDate(payment.paid_on_c)}</InfoRow>
          </dl>
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{payment.note_c || 'No note.'}</p>
        </section>
      </PageBody>
      <KpayDialog open={editOpen} onOpenChange={setEditOpen} record={payment} onSaved={run} />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this payment?"
        description="The karigar's ledger balance will change. This cannot be undone."
        onConfirm={remove}
        busy={deleting}
      />
    </div>
  );
}
