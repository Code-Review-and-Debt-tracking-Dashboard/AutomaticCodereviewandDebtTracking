import { redis } from './redis';

const STATE_TTL_SECONDS = 10 * 60; // must match STATE_EXPIRES_IN in jwt.ts

// true the first time, false on replay
export async function consumeStateNonce(nonce: string): Promise<boolean> {
  const result = await redis.set(`oauth:state:${nonce}`, '1', 'EX', STATE_TTL_SECONDS, 'NX');
  return result === 'OK';
}