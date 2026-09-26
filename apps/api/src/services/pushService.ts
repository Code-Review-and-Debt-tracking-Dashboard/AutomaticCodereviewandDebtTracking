import { prisma, type NotificationType } from '@codehealth/db';

import { env } from '../config/env';
import { logger } from '../lib/logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// expo max per request
const CHUNK_SIZE = 100;

// must match the channel the app creates
const ANDROID_CHANNEL_ID = 'default';

export interface PushBatch {
  repoId: string;
  userIds: string[];
  events: { type: NotificationType; title: string; body: string }[];
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: Record<string, unknown>;
}

// https://docs.expo.dev/push-notifications/sending-notifications/#push-tickets
type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

// never throws, a failed push is just logged
export async function sendPushNotifications(batch: PushBatch): Promise<void> {
  try {
    await dispatch(batch);
  } catch (err) {
    logger.error({ err, repoId: batch.repoId }, 'push dispatch failed');
  }
}

async function dispatch({ repoId, userIds, events }: PushBatch): Promise<void> {
  if (userIds.length === 0 || events.length === 0) {
    return;
  }

  const devices = await prisma.device.findMany({
    where: { userId: { in: userIds }, active: true },
    select: { id: true, expoPushToken: true },
  });

  if (devices.length === 0) {
    return;
  }

  // tickets come back in the same order as messages
  const outgoing = devices.flatMap((device) =>
    events.map((event) => ({
      deviceId: device.id,
      message: {
        to: device.expoPushToken,
        title: event.title,
        body: event.body,
        sound: 'default' as const,
        channelId: ANDROID_CHANNEL_ID,
        data: { type: event.type, repoId },
      },
    })),
  );

  for (let i = 0; i < outgoing.length; i += CHUNK_SIZE) {
    const chunk = outgoing.slice(i, i + CHUNK_SIZE);
    const tickets = await postToExpo(chunk.map((o) => o.message));

    const unregistered = new Set<string>();
    tickets.forEach((ticket, j) => {
      if (ticket.status !== 'error') return;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        unregistered.add(chunk[j].deviceId);
      } else {
        logger.warn({ repoId, error: ticket.details?.error, message: ticket.message }, 'push rejected');
      }
    });

    // app uninstalled or token changed
    if (unregistered.size > 0) {
      await prisma.device.updateMany({
        where: { id: { in: [...unregistered] } },
        data: { active: false },
      });
    }
  }
}

async function postToExpo(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(env.expoAccessToken ? { Authorization: `Bearer ${env.expoAccessToken}` } : {}),
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Expo Push API responded ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: ExpoPushTicket[] };
  return json.data ?? [];
}
