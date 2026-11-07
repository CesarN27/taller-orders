import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamo } from '../../lib/dynamodb';
import { invokeLambda, productFn } from '../../lib/lambda-invoke';
import { unauthorized, badRequest, created, internalError } from '../../lib/response';
import { getAuth } from '../../lib/auth';
import { withCors } from '../../common/cors';
import { Order, OrderItem } from '../../types/order';

const ORDERS_TABLE = process.env.ORDERS_TABLE as string;

interface ProductInfo {
  productId: string;
  name: string;
  price: number;
  stock: number;
}

// Consulta un producto invocando la lambda getProduct de Products
async function fetchProduct(productId: string): Promise<ProductInfo | null> {
  try {
    const res = await invokeLambda<{ product: ProductInfo }>(
      productFn('getProduct'),
      { pathParameters: { id: productId } }
    );
    if (res.statusCode !== 200) return null;
    return res.body.product;
  } catch (error) {
    console.error('Error al consultar el producto', error);
    return null;
  }
}

// Descuenta stock invocando la lambda updateStock de Products
async function decrementStock(productId: string, quantity: number): Promise<boolean> {
  try {
    const res = await invokeLambda(productFn('updateStock'), {
      pathParameters: { id: productId },
      body: JSON.stringify({ quantity }),
    });
    return res.statusCode === 200;
  } catch (error) {
    console.error('Error al descontar el stock', error);
    return false;
  }
}

async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // 1) quién ordena viene del authorizer
    const auth = getAuth(event);
    if (!auth) return unauthorized();
    const userId = auth.userId;

    // 2) body: { items: [{ productId, quantity }] }
    const body = JSON.parse(event.body || '{}');
    const items: { productId: string; quantity: number }[] = body.items;

    // 3) validar
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('items es requerido para poder hacer la orden');
    }
    for (const item of items) {
      if (
        !item.productId ||
        typeof item.quantity !== 'number' ||
        item.quantity < 1 ||
        !Number.isInteger(item.quantity)
      ) {
        return badRequest('Los items no cumplen con las validaciones para ser ordenados');
      }
    }

    // 4) resolver cada producto y validar stock
    const resolvedItems: OrderItem[] = [];
    for (const item of items) {
      const product = await fetchProduct(item.productId);
      if (!product) return badRequest('El producto ' + item.productId + ' no existe');
      if (product.stock < item.quantity) {
        return badRequest(
          'Stock insuficiente para el producto ' +
            item.productId +
            '. Solo hay ' +
            product.stock +
            ' disponibles'
        );
      }
      resolvedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price, // precio actual del producto
      });
    }

    // 5) total y orden
    const total = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const now = new Date().toISOString();
    const order: Order = {
      orderId: uuidv4(),
      userId,
      items: resolvedItems,
      total,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await dynamo.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));

    // 6) descontar el stock; si algo falla, la orden se cancela
    for (const item of resolvedItems) {
      const done = await decrementStock(item.productId, item.quantity);
      if (!done) {
        console.error('Falló al decrementar el stock para el producto', item.productId);
        await dynamo.send(
          new UpdateCommand({
            TableName: ORDERS_TABLE,
            Key: { orderId: order.orderId },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'cancelled',
              ':updatedAt': new Date().toISOString(),
            },
          })
        );
        return internalError(
          'No se pudo reservar el stock para uno o más productos. La orden ha sido cancelada'
        );
      }
    }

    return created(order);
  } catch (error) {
    console.error('Error en create order', error);
    return internalError();
  }
}

export const createOrder = withCors(handler);
