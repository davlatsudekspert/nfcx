import { useLocalSearchParams } from 'expo-router';

import { ProductDetailScreen } from '@/features/profile/ProductDetailScreen';

export default function ProductRoute() {
  const { companyId, itemId } = useLocalSearchParams<{ companyId: string; itemId: string }>();
  return <ProductDetailScreen companyId={companyId ?? ''} itemId={itemId ?? ''} />;
}
