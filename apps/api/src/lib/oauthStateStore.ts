import { redis } from './redis';

const STATE_TTL_SECONDS = 10 * 60; // must match STATE_EXPIRES_IN in jwt.ts

//returns true the first time a nonce is seen, false on replay.
export async function consumeStateNonce(nonce: string): Promise<boolean> {
  const result = await redis.set(`oauth:state:${nonce}`, '1', 'EX', STATE_TTL_SECONDS, 'NX');
  return result === 'OK';
}