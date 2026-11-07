import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../../lib/dynamodb';
import { unauthorized, ok, forbidden, internalError } from '../../lib/response';
import { getAuth } from '../../lib/auth';
import { withCors } from '../../common/cors';

const ORDERS_TABLE = process.env.ORDERS_TABLE as string;

async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.pathParameters?.userId;
    const auth = getAuth(event);
    if (!auth) return unauthorized();
    const callerId = auth.userId;

    if (userId !== callerId) {
      return forbidden('Solo puedes listar tus propias órdenes');
    }

    const result = await dynamo.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        IndexName: 'UserOrdersIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
      })
    );

    return ok({ orders: result.Items || [] });
  } catch (error) {
    console.error('Error en list orders by user id', error);
    return internalError();
  }
}

export const listOrdersByUserId = withCors(handler);
