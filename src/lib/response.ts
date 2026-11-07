import { APIGatewayProxyResult } from 'aws-lambda';

const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const ok = (body: unknown) => json(200, body);
export const created = (body: unknown) => json(201, body);
export const badRequest = (message: string) => json(400, { message });
export const unauthorized = (message: string = 'Unauthorized') =>
  json(401, { message });
export const forbidden = (message: string) => json(403, { message });
export const notFound = (message: string) => json(404, { message });
export const internalError = (message: string = 'Internal server error') =>
  json(500, { message });
