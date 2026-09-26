import { prisma } from '@codehealth/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendPushNotifications, type PushBatch } from '../../src/services/pushService';
import { createDevice, createOrg, createRepo, createUser } from '../helpers/factories';

interface SentMessage {
  to: string;
  title: string;
  body: string;
  channelId: string;
  data: Record<string, unknown>;
}

// fake expo api, one ticket per message
function mockExpo(ticketFor: (m: SentMessage) => object = () => ({ status: 'ok', id: 'receipt' })) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const messages = JSON.parse(String(init?.body)) as SentMessage[];
    return new Response(JSON.stringify({ data: messages.map(ticketFor) }), { status: 200 });
  });
}

function sentMessages(fetchSpy: ReturnType<typeof mockExpo>): SentMessage[] {
  return fetchSpy.mock.calls.flatMap(([, init]) => JSON.parse(String(init?.body)) as SentMessage[]);
}

const gateFailed = { type: 'QUALITY_GATE_FAILED' as const, title: 'Quality gate failed — api', body: 'Health score 61.' };

function batch(userIds: string[], overrides: Partial<PushBatch> = {}): PushBatch {
  return { repoId: 'repo-1', userIds, events: [gateFailed], ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendPushNotifications', () => {
  it('does not call Expo when nobody notified has a device', async () => {
    const fetchSpy = mockExpo();
    const user = await createUser();

    await sendPushNotifications(batch([user.id]));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not call Expo when there is nothing to send', async () => {
    const fetchSpy = mockExpo();
    const user = await createUser();
    await createDevice(user);

    await sendPushNotifications(batch([user.id], { events: [] }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends each event to each of the users' active devices, and nowhere else", async () => {
    const fetchSpy = mockExpo();
    const alice = await createUser();
    const bob = await createUser();
    const stranger = await createUser();
    const phone = await createDevice(alice);
    const tablet = await createDevice(alice);
    const bobPhone = await createDevice(bob);
    await createDevice(bob, { active: false });
    await createDevice(stranger);

    const scoreDropped = { type: 'SCORE_DROPPED' as const, title: 'Health score dropped — api', body: 'Down 12 points.' };
    await sendPushNotifications(batch([alice.id, bob.id], { events: [gateFailed, scoreDropped] }));

    const sent = sentMessages(fetchSpy);
    expect(sent).toHaveLength(6);
    expect(new Set(sent.map((m) => m.to))).toEqual(
      new Set([phone.expoPushToken, tablet.expoPushToken, bobPhone.expoPushToken]),
    );
    expect(sent.find((m) => m.to === phone.expoPushToken && m.data.type === 'QUALITY_GATE_FAILED')).toMatchObject({
      title: gateFailed.title,
      body: gateFailed.body,
      channelId: 'default',
      data: { type: 'QUALITY_GATE_FAILED', repoId: 'repo-1' },
    });
  });

  it('sends the repo name so the app can open that repo', async () => {
    const fetchSpy = mockExpo(() => ({ status: 'ok', id: 'receipt' }));
    const user = await createUser();
    const repo = await createRepo(await createOrg(), user, { name: 'api-gateway' });
    await createDevice(user);

    await sendPushNotifications(batch([user.id], { repoId: repo.id }));

    expect(sentMessages(fetchSpy)[0].data).toEqual({
      type: 'QUALITY_GATE_FAILED',
      repoId: repo.id,
      repoName: 'api-gateway',
    });
  });

  it('stops sending to a device Expo reports as no longer registered', async () => {
    const user = await createUser();
    const gone = await createDevice(user);
    const kept = await createDevice(user);
    mockExpo((m) =>
      m.to === gone.expoPushToken
        ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: 'receipt' },
    );

    await sendPushNotifications(batch([user.id]));

    expect((await prisma.device.findUniqueOrThrow({ where: { id: gone.id } })).active).toBe(false);
    expect((await prisma.device.findUniqueOrThrow({ where: { id: kept.id } })).active).toBe(true);
  });

  it('keeps a device whose push failed for any other reason', async () => {
    const user = await createUser();
    const device = await createDevice(user);
    mockExpo(() => ({ status: 'error', message: 'rate limited', details: { error: 'MessageRateExceeded' } }));

    await sendPushNotifications(batch([user.id]));

    expect((await prisma.device.findUniqueOrThrow({ where: { id: device.id } })).active).toBe(true);
  });

  it('splits more than 100 messages into several requests', async () => {
    const fetchSpy = mockExpo();
    const user = await createUser();
    await prisma.device.createMany({
      data: Array.from({ length: 150 }, (_, i) => ({
        userId: user.id,
        expoPushToken: `ExponentPushToken[bulk-${i}]`,
        platform: 'ANDROID' as const,
      })),
    });

    await sendPushNotifications(batch([user.id]));

    expect(fetchSpy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).length)).toEqual([100, 50]);
  });

  it('never throws — an Expo outage is logged, not raised', async () => {
    const user = await createUser();
    await createDevice(user);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('upstream down', { status: 503 }));

    await expect(sendPushNotifications(batch([user.id]))).resolves.toBeUndefined();
  });

  it('never throws when the request itself fails', async () => {
    const user = await createUser();
    await createDevice(user);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    await expect(sendPushNotifications(batch([user.id]))).resolves.toBeUndefined();
  });
});
