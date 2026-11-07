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
      return badRequest('No se puede cancelar una orden con el estatus ' + order.status);
    }

    // la cancela quien la hizo, o un vendedor con productos en ella
    const isBuyer = order.userId === callerId;
    let isSeller = false;
    if (!isBuyer) {
      const sellerProductIds = await getSellerProductIds(callerId);
      isSeller = order.items.some((item) => sellerProductIds.has(item.productId));
    }
    if (!isBuyer && !isSeller) {
      return forbidden(
        'Solo puedes cancelar órdenes que tú hiciste u órdenes que contengan productos que tú vendes'
      );
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { orderId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'cancelled',
          ':updatedAt': new Date().toISOString(),
        },
      })
    );

    return ok({ message: 'Orden cancelada' });
  } catch (error) {
    console.error('Error en cancel order', error);
    return internalError();
  }
}

export const cancelOrder = withCors(handler);
