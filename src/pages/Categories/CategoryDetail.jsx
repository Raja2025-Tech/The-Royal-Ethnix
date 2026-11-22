import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import { CATEGORY_FIELDS, kindStyles, money, writeOk } from '@/lib/tms';
import { aggregateMany } from '@/lib/agg';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, headerGhostClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDelete from '@/components/ConfirmDelete';
import { InfoRow } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import CategoryDialog from './CategoryDialog';

import { eq } from '@/services/query';

export const route = { path: '/categories/:id', layout: 'owner', access: 'authenticated' };

export default function CategoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'categories_c');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, run } = useFetch(async () => {
    const res = await sdk.table('categories_c').select(CATEGORY_FIELDS).get(id);
    const used = await aggregateMany('order_items_c', [{ id: 'used', field: 'Id', fn: 'Count', where: eq('category_c', id) }]);
    return { category: res.data, used: used.used };
  }, [id]);
  const category = data?.category;

  async function remove() {
    if (data?.used) {
      toast.error('This category is used by garments on orders and cannot be deleted.');
      setDeleteOpen(false);
      return;
    }
    setDeleting(true);
    try {
      const res = await sdk.table('categories_c').remove(id);
      if (!writeOk(res)) return;
      toast.success('Category deleted');
      navigate('/categories');
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data === undefined) {
    return (
      <div>
        <PageHeader title="Category" back={{ to: '/categories', label: 'Back to Garment Categories' }} />
        <PageBody>
          <DetailSkeleton />
        </PageBody>
      </div>
    );
  }
  if (error || !category) {
    return (
      <div>
        <PageHeader title="Category" back={{ to: '/categories', label: 'Back to Garment Categories' }} />
        <PageBody>
          {error ? (
            <ErrorBlock message={error.message} onRetry={run} />
          ) : (
            <EmptyBlock icon="SearchX" title="Category not found" text="It may have been deleted." />
          )}
        </PageBody>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={category.Name}
        description={`${data.used} garment${data.used === 1 ? '' : 's'} booked in this category`}
        back={{ to: '/categories', label: 'Back to Garment Categories' }}
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
        <section className="max-w-xl rounded-2xl border border-border bg-card p-5">
          <dl>
            <InfoRow label="Wear type"><StatusBadge styles={kindStyles} value={category.kind_c} /></InfoRow>
            <InfoRow label="Default wage">{money(category.default_wage_c)}</InfoRow>
            <InfoRow label="Garments booked">{data.used}</InfoRow>
          </dl>
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{category.notes_c || 'No notes.'}</p>
        </section>
      </PageBody>
      <CategoryDialog open={editOpen} onOpenChange={setEditOpen} record={category} onSaved={run} />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${category.Name}?`}
        description="Categories used by garments cannot be deleted. This cannot be undone."
        onConfirm={remove}
        busy={deleting}
      />
    </div>
  );
}
