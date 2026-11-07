import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../../lib/dynamodb';
import { getSellerProductIds } from '../../lib/sellers';
import { unauthorized, ok, badRequest, notFound, forbidden, internalError } from '../../lib/response';
import { getAuth } from '../../lib/auth';
import { withCors } from '../../common/cors';
import { Order } from '../../types/order';

const ORDERS_TABLE = process.env.ORDERS_TABLE as string;

async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const orderId = event.pathParameters?.id;
    if (!orderId) return notFound('La orden no se pudo encontrar');

    const auth = getAuth(event);
    if (!auth) return unauthorized();
    const callerId = auth.userId;

    const existing = await dynamo.send(
      new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } })
    );
    if (!existing.Item) return notFound('La orden no se pudo encontrar');

    const order = existing.Item as Order;
    if (order.status !== 'pending') {
      return badRequest('No se puede confirmar una orden con el estatus ' + order.status);
    }

    // solo un vendedor con productos en la orden puede confirmarla
    const sellerProductIds = await getSellerProductIds(callerId);
    const isSeller = order.items.some((item) => sellerProductIds.has(item.productId));
    if (!isSeller) {
      return forbidden('Solo un vendedor con productos en esta orden puede confirmarla');
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { orderId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'confirmed',
          ':updatedAt': new Date().toISOString(),
        },
      })
    );

    return ok({ message: 'Orden confirmada' });
  } catch (error) {
    console.error('Error en confirm order', error);
    return internalError();
  }
}

export const confirmOrder = withCors(handler);
