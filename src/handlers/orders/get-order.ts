import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../../lib/dynamodb';
import { unauthorized, ok, notFound, forbidden, internalError } from '../../lib/response';
import { getAuth } from '../../lib/auth';
import { withCors } from '../../common/cors';

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

    const result = await dynamo.send(
      new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } })
    );
    if (!result.Item) return notFound('La orden no se pudo encontrar');

    if (result.Item.userId !== callerId) {
      return forbidden('Solo puedes ver las órdenes que hayas generado tú');
    }

    return ok({ order: result.Item });
  } catch (error) {
    console.error('Error en get order', error);
    return internalError();
  }
}

export const getOrder = withCors(handler);
