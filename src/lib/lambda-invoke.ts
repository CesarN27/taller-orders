import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { localEndpoint } from './aws-endpoint';

const stage = process.env.STAGE || 'local';

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: localEndpoint(),
});

export interface InvokeResult<T = unknown> {
  statusCode: number;
  body: T;
}

// Invoca otra lambda directo (sin API Gateway ni authorizer)
export async function invokeLambda<T = unknown>(
  functionName: string,
  event: object
): Promise<InvokeResult<T>> {
  const res = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(event)),
    })
  );
  if (res.FunctionError) {
    throw new Error(
      'Error al invocar la lambda ' + functionName + ': ' + res.FunctionError
    );
  }
  const result = JSON.parse(Buffer.from(res.Payload!).toString()) as {
    statusCode: number;
    body: string;
  };
  return { statusCode: result.statusCode, body: JSON.parse(result.body) as T };
}

// Arma el nombre de una lambda de Products (debe coincidir con el name: de su serverless.yml)
export const productFn = (name: string) => 'taller-' + stage + '-products-' + name;
