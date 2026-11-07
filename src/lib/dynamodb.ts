import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { localEndpoint } from './aws-endpoint';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: localEndpoint(),
});

// El DocumentClient convierte el formato de DynamoDB (S, N, M...) a objetos normales
export const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
