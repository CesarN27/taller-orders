export interface OrderItem {
  productId: string;
  quantity: number;
  price: number; // precio unitario al momento de la compra
}

export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: string; // pending | confirmed | cancelled
  createdAt: string;
  updatedAt: string;
}
