import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getFieldAccess, getTableAccess } from '@/services/userPermissions';
import {
  itemMeasureFields,
  ITEM_FIELDS,
  itemKarigars,
  stagesFor,
  ITEM_STATUS_LABEL,
  daysLabel,
  daysLeft,
  daysTone,
  fmtDate,
  itemStatusStyles,
  kindStyles,
  lookupId,
  handoverState,
  handoverStyles,
  money,
  syncOrderStatus,
  writeOk,
} from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, headerGhostClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Pipeline from '@/components/Pipeline';
import PickSelect from '@/components/PickSelect';
import FilePicker from '@/components/FilePicker';
import ConfirmDelete from '@/components/ConfirmDelete';
import HandoverDialog from '@/pages/Handover/HandoverDialog';
import { openJobCard, openLabels } from '@/lib/statement';
import { InfoRow } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';

export const route = { path: '/order-items/:id', layout: 'owner', access: 'authenticated' };

export default function OrderItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'order_items_c');
  const wageHidden = getFieldAccess(profile, 'order_items_c', 'wage_c').hidden;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [handover, setHandover] = useState(null);

  const { data, loading, error, run } = useFetch(async () => {
    const res = await sdk.table('order_items_c').select(ITEM_FIELDS).get(id);
    return { item: res.data };
  }, [id]);
  const item = data?.item;

  async function changeStage(status) {
    setMoving(true);
    try {
      const res = await sdk.table('order_items_c').update({ Id: id, status_c: status });
      if (!writeOk(res)) return;
      await syncOrderStatus(lookupId(item.order_c));
      toast.success(`Moved to ${ITEM_STATUS_LABEL[status]}`);
      run();
    } finally {
      setMoving(false);
    }
  }

  async function resetHandover() {
    const res = await sdk.table('order_items_c').update({
      Id: id,
      fabric_given_on_c: null,
      fabric_qty_c: null,
      fabric_note_c: null,
      received_on_c: null,
      received_note_c: null,
    });
    if (!writeOk(res)) return;
    toast.success('Handover reset');
    run();
  }

  async function remove() {
    setDeleting(true);
    try {
      const orderId = lookupId(item.order_c);
      const res = await sdk.table('order_items_c').remove(id);
      if (!writeOk(res)) return;
      await syncOrderStatus(orderId);
      toast.success('Garment deleted');
      navigate(`/orders/${orderId}?tab=process`);
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data === undefined) {
    return (
      <div>
        <PageHeader title="Garment" back={{ to: '/order-items', label: 'Back to Work Queue' }} />
        <PageBody>
          <DetailSkeleton />
        </PageBody>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div>
        <PageHeader title="Garment" back={{ to: '/order-items', label: 'Back to Work Queue' }} />
        <PageBody>
          {error ? (
            <ErrorBlock message={error.message} onRetry={run} />
          ) : (
            <EmptyBlock icon="SearchX" title="Garment not found" text="It may have been deleted." />
          )}
        </PageBody>
      </div>
    );
  }

  const fields = itemMeasureFields(item.kind_c, item.category_c?.Name);
  const dl = item.status_c === 'Delivered' ? null : daysLeft(item.due_date_c);
  const orderId = lookupId(item.order_c);
  const hState = handoverState(item);
  const canHandover = access.canUpdate && profile !== 'Karigar_c';

  return (
    <div>
      <PageHeader
        title={item.Name}
        description={`${item.category_c?.Name ?? ''} · Bill ${item.order_c?.Name ?? ''}`}
        back={{ to: `/orders/${orderId}?tab=process`, label: 'Back to Order process' }}
        actions={
          <>
            {item.karigar_c && (
              <Button variant="outline" className={headerGhostClass} onClick={() => openJobCard(item)}>
                <AppIcon name="Printer" size={16} /> Job card
              </Button>
            )}
            <Button
              variant="outline"
              className={headerGhostClass}
              onClick={() => openLabels({ bill: item.order_c?.Name ?? '', items: [item] })}
            >
              <AppIcon name="Barcode" size={16} /> Label
            </Button>
            {access.canUpdate && (
              <Button variant="outline" className={headerGhostClass} asChild>
                <Link to={`/order-items/${id}/edit`}>
                  <AppIcon name="Pencil" size={16} /> Edit
                </Link>
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
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">Production stage</h2>
            <div className="w-48">
              <PickSelect
                value={item.status_c}
                onChange={changeStage}
                options={stagesFor(item)}
                labels={ITEM_STATUS_LABEL}
                disabled={!access.canUpdate || moving}
              />
            </div>
          </div>
          <Pipeline status={item.status_c} handwork={item.handwork_c} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Garment details</h2>
            <dl className="mt-2">
              <InfoRow label="Wear type"><StatusBadge styles={kindStyles} value={item.kind_c} /></InfoRow>
              <InfoRow label="Category">{item.category_c?.Name}</InfoRow>
              <InfoRow label="Stage"><StatusBadge styles={itemStatusStyles} value={item.status_c} label={ITEM_STATUS_LABEL[item.status_c]} /></InfoRow>
              <InfoRow label="Bill">
                <Link to={`/orders/${orderId}`} className="text-primary hover:underline">
                  {item.order_c?.Name}
                </Link>
              </InfoRow>
              {item.kind_c === 'Top Wear' && <InfoRow label="Sleeve type">{item.sleeve_type_c}</InfoRow>}
              <InfoRow label="Fabric">{item.fabric_c}</InfoRow>
              <InfoRow label="Quantity">{item.qty_c ?? 1}</InfoRow>
              {item.size_c && <InfoRow label="Size">{item.size_c}</InfoRow>}
              {item.karigar_note_c && <InfoRow label="Karigar note">{item.karigar_note_c}</InfoRow>}
            </dl>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{item.design_c || 'No design notes.'}</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Karigar</h2>
            <dl className="mt-2">
              {itemKarigars(item).length === 0 && <InfoRow label="Assigned to">{null}</InfoRow>}
              {itemKarigars(item).map((k, n) => (
                <InfoRow key={k.slot} label={n === 0 ? 'Assigned to' : `Karigar ${n + 1}`}>
                  <Link to={`/karigars/${k.id}`} className="text-primary hover:underline">
                    {k.name}
                  </Link>
                  {!wageHidden && <span className="ml-2 text-muted-foreground">{money(k.wage)}</span>}
                </InfoRow>
              ))}
              <InfoRow label="Handwork">{item.handwork_c ? 'Required' : 'Not required'}</InfoRow>
              <InfoRow label="Due date">{fmtDate(item.due_date_c)}</InfoRow>
              <InfoRow label="Time left">
                <span className={daysTone(dl)}>{dl === null ? '—' : daysLabel(dl)}</span>
              </InfoRow>
            </dl>
          </section>
        </div>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Fabric and handover</h2>
              <p className="text-sm text-muted-foreground">Fabric given to the karigar and the garment received back.</p>
            </div>
            <StatusBadge styles={handoverStyles} value={hState} />
          </div>
          <dl>
            <InfoRow label="Fabric given on">
              {item.fabric_given_on_c ? `${fmtDate(item.fabric_given_on_c)} · ${item.fabric_qty_c ?? '—'} m` : null}
            </InfoRow>
            <InfoRow label="Fabric note">{item.fabric_note_c}</InfoRow>
            <InfoRow label="Received on">{item.received_on_c ? fmtDate(item.received_on_c) : null}</InfoRow>
            <InfoRow label="Receipt note">{item.received_note_c}</InfoRow>
          </dl>
          {canHandover && (
            <div className="flex flex-wrap gap-2">
              {hState === 'Not issued' && (
                <Button disabled={!item.karigar_c} onClick={() => setHandover('give')}>
                  <AppIcon name="ArrowUpFromLine" size={16} /> Give fabric to karigar
                </Button>
              )}
              {hState === 'With karigar' && (
                <Button onClick={() => setHandover('receive')}>
                  <AppIcon name="ArrowDownToLine" size={16} /> Receive garment
                </Button>
              )}
              {hState !== 'Not issued' && (
                <Button variant="ghost" onClick={resetHandover}>
                  Reset handover
                </Button>
              )}
              {!item.karigar_c && <p className="self-center text-sm text-muted-foreground">Assign a karigar first.</p>}
            </div>
          )}
        </section>

        <section hidden={fields.length === 0} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">Measurements (inches)</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fields.map((f) => (
              <div key={f.key} className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">{f.label.replace(' (optional)', '')}</p>
                <p className="font-heading text-xl font-semibold">{item[f.key] ?? '—'}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-lg font-semibold">Item image</h2>
          <FilePicker value={item.photos_c ?? []} onChange={() => {}} readOnly />
          <h2 className="mb-3 mt-5 font-heading text-lg font-semibold">Fabric image</h2>
          <FilePicker value={item.fabric_photos_c ?? []} onChange={() => {}} readOnly />
        </section>
      </PageBody>

      <HandoverDialog
        open={Boolean(handover)}
        onOpenChange={(o) => !o && setHandover(null)}
        item={item}
        mode={handover ?? 'give'}
        onSaved={run}
      />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${item.Name}?`}
        description="This garment and its measurements will be removed from the order."
        onConfirm={remove}
        busy={deleting}
      />
    </div>
  );
}
