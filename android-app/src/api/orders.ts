import { api } from './client';
import type { Order } from './types';

export const ordersApi = {
  list: () => api.get<{ orders: Order[] }>('/api/orders'),
  get: (id: number) => api.get<Order>(`/api/orders/${id}`),
};
