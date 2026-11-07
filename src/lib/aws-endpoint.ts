// En el stage "local" las lambdas corren dentro de LocalStack y tienen que
// hablar con LocalStack (no con AWS). En AWS real devuelve undefined y el SDK
// usa los endpoints normales.
export function localEndpoint(): string | undefined {
  if (process.env.STAGE !== 'local') return undefined;

  if (process.env.AWS_ENDPOINT_URL) return process.env.AWS_ENDPOINT_URL;

  if (process.env.LOCALSTACK_HOSTNAME) {
    return `http://${process.env.LOCALSTACK_HOSTNAME}:${process.env.EDGE_PORT || '4566'}`;
  }

  return 'http://localhost.localstack.cloud:4566';
}
