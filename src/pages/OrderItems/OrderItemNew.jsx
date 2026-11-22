import { useParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { ErrorBlock, EmptyBlock } from '@/components/StateBlocks';
import { DetailSkeleton } from '@/components/PageSkeleton';
import ItemForm from './ItemForm';

export const route = { path: '/orders/:id/add-item', layout: 'owner', access: 'authenticated' };

export default function OrderItemNew() {
  const { id } = useParams();
  const { data, loading, error, run } = useFetch(async () => {
    const res = await sdk.table('orders_c').select(['Name', 'bill_no_c', 'customer_c']).get(id);
    return { order: res.data };
  }, [id]);
  const order = data?.order;

  return (
    <div>
      <PageHeader
        title="Add garment"
        description={order ? `Order ${order.Name} · ${order.customer_c?.Name ?? ''}` : undefined}
        back={{ to: `/orders/${id}?tab=process`, label: 'Back to Order process' }}
      />
      <PageBody>
        {loading && data === undefined && <DetailSkeleton />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!loading && !error && !order && (
          <EmptyBlock icon="SearchX" title="Order not found" text="Pick an order from the list." />
        )}
        {order && <ItemForm orderId={id} />}
      </PageBody>
    </div>
  );
}
