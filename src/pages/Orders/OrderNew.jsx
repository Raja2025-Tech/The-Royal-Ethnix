import { PageBody, PageHeader } from '@/components/PageHeader';
import OrderForm from './OrderForm';

export const route = { path: '/orders/new', layout: 'owner', access: 'authenticated' };

export default function OrderNew() {
  return (
    <div>
      <PageHeader
        title="Create order"
        description="Enter the bill number and payment split, then add garments, measurements and karigars in Order process."
        back={{ to: '/orders', label: 'Back to Orders' }}
      />
      <PageBody>
        <OrderForm />
      </PageBody>
    </div>
  );
}
