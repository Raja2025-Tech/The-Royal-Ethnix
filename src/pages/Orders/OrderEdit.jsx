import { useParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { ORDER_FIELDS } from '@/lib/tms';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { ErrorBlock, EmptyBlock } from '@/components/StateBlocks';
import OrderForm from './OrderForm';

export const route = { path: '/orders/:id/edit', layout: 'owner', access: 'authenticated' };

export default function OrderEdit() {
  const { id } = useParams();
  const { data, loading, error, run } = useFetch(async () => {
    const res = await sdk.table('orders_c').select(ORDER_FIELDS).get(id);
    return { order: res.data };
  }, [id]);
  const order = data?.order;

  return (
    <div>
      <PageHeader
        title={order ? `Edit ${order.Name}` : 'Edit order'}
        back={{ to: `/orders/${id}`, label: 'Back to Order' }}
      />
      <PageBody>
        {loading && data === undefined && <DetailSkeleton />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!loading && !error && !order && (
          <EmptyBlock icon="SearchX" title="Order not found" text="It may have been deleted." />
        )}
        {order && <OrderForm record={order} />}
      </PageBody>
    </div>
  );
}
