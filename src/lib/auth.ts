import { createHmac, timingSafeEqual } from 'crypto';
import { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthInfo {
  userId: string;
  role?: string;
}

// Verifica un JWT HS256 con el módulo crypto de Node (sin dependencias extra).
function verifyHs256(token: string, secret: string): Record<string, any> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Devuelve quién llama (userId y role) o null si no está autenticado.
//
// En AWS el authorizer del Gateway ya validó el token y deja userId y role en
// event.requestContext.authorizer: esa es la fuente de verdad.
//
// LocalStack (versión 2026.10) NO ejecuta los Lambda authorizers: la petición llega
// a la lambda sin contexto. Solo en el stage "local" se valida el token aquí mismo
// (mismo secreto y mismo resultado que el authorizer) para que 401 y los roles
// funcionen igual que en AWS. En develop/prod este respaldo nunca se usa.
export function getAuth(event: APIGatewayProxyEvent): AuthInfo | null {
  const ctx = event.requestContext?.authorizer;
  if (ctx?.userId) {
    return { userId: String(ctx.userId), role: ctx.role ? String(ctx.role) : undefined };
  }

  if (process.env.STAGE !== 'local') return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const headers = event.headers || {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization');
  const raw = key ? headers[key] : undefined;
  if (!raw) return null;

  const token = raw.replace(/^Bearer\s+/i, '').trim();
  const payload = verifyHs256(token, secret);
  if (!payload || !payload.userId) return null;
  return { userId: String(payload.userId), role: payload.role ? String(payload.role) : undefined };
}
