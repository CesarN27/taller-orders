import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

const CORS_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Api-Key',
  'X-Amz-Date',
  'X-Amz-Security-Token',
].join(',');

// Envuelve una lambda y agrega a su respuesta las cabeceras de CORS.
// Los orígenes permitidos salen de CORS_ORIGINS (separados por comas), que viene
// de config/<stage>.yml.
export function withCors(handler: Handler): Handler {
  return async (event) => {
    const allowedOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    const origin = event.headers?.origin || event.headers?.Origin || '';
    const allowOrigin = allowedOrigins.includes(origin) ? origin : '';

    const result = await handler(event);
    return {
      ...result,
      headers: {
        ...result.headers,
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': CORS_HEADERS,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      },
    };
  };
}
