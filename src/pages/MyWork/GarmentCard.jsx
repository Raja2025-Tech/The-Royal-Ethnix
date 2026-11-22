import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import {
  ITEM_STATUS_LABEL,
  stagesFor,
  fabricLabel,
  RATE_STAGES,
  daysLabel,
  daysLeft,
  daysTone,
  fmtDate,
  handoverState,
  handoverStyles,
  itemMeasureFields,
  itemStatusStyles,
  kindStyles,
  toNumber,
  writeOk,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import StatusBadge from '@/components/StatusBadge';
import Pipeline from '@/components/Pipeline';
import PickSelect from '@/components/PickSelect';
import FilePicker from '@/components/FilePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const NEXT = {
  New: 'Fabric', Fabric: 'Cut', Cut: 'Stitch', Stitch: 'Ready', Ready: 'Dispatched', Dispatched: 'Trial',
  Trial: 'Done', Alter: 'Ready', Handwork: 'Stitch',
};
const FINISHED = ['Done', 'Delivered'];

export const isFinished = (item) => FINISHED.includes(item.status_c);

function RateEditor({ item, onSaved }) {
  const wageKey = item._wageKey ?? 'wage_c';
  const [value, setValue] = useState(item.wage_c ?? '');
  const [saving, setSaving] = useState(false);
  const changed = String(value) !== String(item.wage_c ?? '');

  async function save() {
    const n = toNumber(value);
    if (n === null || n < 0) {
      toast.error('Enter a valid rate');
      return;
    }
    setSaving(true);
    try {
      const res = await sdk.table('order_items_c').update({ Id: item.Id, [wageKey]: n });
      if (!writeOk(res)) return;
      toast.success('Rate saved');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="w-32">
        <p className="mb-1 text-xs text-muted-foreground">My rate (INR)</p>
        <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 1100" />
      </div>
      <Button size="sm" variant="outline" disabled={!changed || saving} onClick={save}>
        Save rate
      </Button>
    </div>
  );
}

function NoteEditor({ item, onSaved }) {
  const [value, setValue] = useState(item.karigar_note_c ?? '');
  const [saving, setSaving] = useState(false);
  const changed = value !== (item.karigar_note_c ?? '');

  async function save() {
    setSaving(true);
    try {
      const res = await sdk.table('order_items_c').update({ Id: item.Id, karigar_note_c: value.trim() || null });
      if (!writeOk(res)) return;
      toast.success('Note saved');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">My note</p>
      <Textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Write a note for this garment…" />
      <Button size="sm" variant="outline" disabled={!changed || saving} onClick={save}>
        Save note
      </Button>
    </div>
  );
}

export default function GarmentCard({ item, onChanged }) {
  const [busy, setBusy] = useState(false);
  const done = isFinished(item);
  const n = done ? null : daysLeft(item.due_date_c);
  const next = item.status_c === 'Cut' && item.handwork_c ? 'Handwork' : NEXT[item.status_c];
  const hState = handoverState(item);
  const fields = itemMeasureFields(item.kind_c, item.category_c?.Name).filter(
    (f) => item[f.key] !== null && item[f.key] !== undefined && item[f.key] !== '',
  );
  const hasImages = (item.photos_c?.length ?? 0) + (item.fabric_photos_c?.length ?? 0) > 0;
  const canRate = RATE_STAGES.includes(item.status_c) && item.status_c !== 'Delivered';

  async function setStage(status) {
    if (status === item.status_c) return;
    setBusy(true);
    try {
      const res = await sdk.table('order_items_c').update({ Id: item.Id, status_c: status });
      if (!writeOk(res)) return;
      toast.success(`${item.Name}: ${ITEM_STATUS_LABEL[status]}`);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold">{item.Name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge styles={kindStyles} value={item.kind_c} />
            <span>{item.category_c?.Name ?? '—'}</span>
            <span>· Bill {item.order_c?.Name ?? '—'}</span>
            {item.kind_c === 'Accessory' && <span>· Qty {item.qty_c ?? 1}</span>}
            {item.size_c && <span>· Size {item.size_c}</span>}
            {item.kind_c === 'Top Wear' && item.sleeve_type_c && <span>· {item.sleeve_type_c} sleeve</span>}
            {item.handwork_c && <span>· Handwork</span>}
            {item.fabric_qty_c ? <span>· Fabric {fabricLabel(item)}</span> : null}
          </div>
        </div>
        <div className="text-right">
          <StatusBadge styles={itemStatusStyles} value={item.status_c} label={ITEM_STATUS_LABEL[item.status_c]} />
          <p className="mt-1 text-sm">{fmtDate(item.due_date_c)}</p>
          {n !== null && <p className={cn('text-xs font-medium', daysTone(n))}>{daysLabel(n)}</p>}
        </div>
      </div>
      <Pipeline status={item.status_c} handwork={item.handwork_c} />
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <span key={f.key} className="rounded-md bg-muted px-2 py-1 text-xs">
            <span className="text-muted-foreground">{f.label.replace(' (optional)', '')}</span>{' '}
            <span className="font-semibold">{item[f.key]}</span>
          </span>
        ))}
        {item.kind_c === 'Top Wear' && item.sleeve_type_c && (
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">{item.sleeve_type_c} sleeve</span>
        )}
      </div>
      {(item.fabric_c || item.design_c) && (
        <p className="text-sm text-muted-foreground">
          {item.fabric_c}
          {item.fabric_c && item.design_c ? ' · ' : ''}
          {item.design_c}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusBadge styles={handoverStyles} value={hState} />
        {item.fabric_given_on_c ? (
          <span>
            Fabric given: <span className="font-semibold text-foreground">{item.fabric_qty_c ?? '—'} m</span> on{' '}
            {fmtDate(item.fabric_given_on_c)}
          </span>
        ) : (
          item.fabric_qty_c && <span>Fabric: {item.fabric_qty_c} m</span>
        )}
        {item.received_on_c && <span>· Received back {fmtDate(item.received_on_c)}</span>}
      </div>
      {hasImages && (
        <details className="rounded-xl bg-muted/50 p-3">
          <summary className="cursor-pointer text-sm font-medium">Item and fabric images</summary>
          <div className="mt-3 space-y-3">
            {(item.photos_c?.length ?? 0) > 0 && <FilePicker value={item.photos_c} onChange={() => {}} readOnly />}
            {(item.fabric_photos_c?.length ?? 0) > 0 && (
              <FilePicker value={item.fabric_photos_c} onChange={() => {}} readOnly />
            )}
          </div>
        </details>
      )}

      <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-2">
        {canRate ? (
          <RateEditor key={`${item.Id}-${item.wage_c}`} item={item} onSaved={onChanged} />
        ) : (
          <p className="self-end text-xs text-muted-foreground">
            {item.status_c === 'Delivered'
              ? `Rate ${item.wage_c ?? 0} (locked)`
              : 'Rate can be written when the garment is Ready for Dispatch.'}
          </p>
        )}
        <NoteEditor key={`${item.Id}-${item.karigar_note_c}`} item={item} onSaved={onChanged} />
      </div>

      {item.status_c !== 'Delivered' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {next && (
            <Button disabled={busy} onClick={() => setStage(next)}>
              <AppIcon name="Check" size={16} /> Mark {ITEM_STATUS_LABEL[next]}
            </Button>
          )}
          {item.status_c === 'Trial' && (
            <Button variant="outline" disabled={busy} onClick={() => setStage('Alter')}>
              Needs alteration
            </Button>
          )}
          <div className="ml-auto w-48">
            <PickSelect
              value={item.status_c}
              onChange={setStage}
              options={stagesFor(item).filter((s) => s !== 'Delivered')}
              labels={ITEM_STATUS_LABEL}
              disabled={busy}
            />
          </div>
        </div>
      )}
    </article>
  );
}
