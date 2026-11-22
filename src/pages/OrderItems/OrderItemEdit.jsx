import { useParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { ITEM_FIELDS } from '@/lib/tms';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { ErrorBlock, EmptyBlock } from '@/components/StateBlocks';
import { DetailSkeleton } from '@/components/PageSkeleton';
import ItemForm from './ItemForm';

export const route = { path: '/order-items/:id/edit', layout: 'owner', access: 'authenticated' };

export default function OrderItemEdit() {
  const { id } = useParams();
  const { data, loading, error, run } = useFetch(async () => {
    const res = await sdk.table('order_items_c').select(ITEM_FIELDS).get(id);
    return { item: res.data };
  }, [id]);
  const item = data?.item;

  return (
    <div>
      <PageHeader
        title={item ? `Edit ${item.Name}` : 'Edit garment'}
        back={{ to: `/order-items/${id}`, label: 'Back to Garment' }}
      />
      <PageBody>
        {loading && data === undefined && <DetailSkeleton />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!loading && !error && !item && (
          <EmptyBlock icon="SearchX" title="Garment not found" text="It may have been deleted." />
        )}
        {item && <ItemForm record={item} />}
      </PageBody>
    </div>
  );
}
