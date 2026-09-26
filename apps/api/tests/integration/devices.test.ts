import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createDevice, createUser } from '../helpers/factories';

const TOKEN = 'ExponentPushToken[abc123]';

describe('POST /api/devices', () => {
  it('401 without a token', async () => {
    const res = await api().post('/api/devices').send({ expoPushToken: TOKEN, platform: 'android' });
    expect(res.status).toBe(401);
  });

  it('400 for something that is not an Expo push token', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/devices')
      .set(bearer(user))
      .send({ expoPushToken: 'not-a-token', platform: 'android' });
    expect(res.status).toBe(400);
  });

  it('400 for an unknown platform', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/devices')
      .set(bearer(user))
      .send({ expoPushToken: TOKEN, platform: 'windows' });
    expect(res.status).toBe(400);
  });

  it('registers the device for the caller', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/devices')
      .set(bearer(user))
      .send({ expoPushToken: TOKEN, platform: 'android', deviceName: 'Pixel 7' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(String), expoPushToken: TOKEN, platform: 'android', active: true });

    const row = await prisma.device.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row).toMatchObject({ userId: user.id, platform: 'ANDROID', deviceName: 'Pixel 7', active: true });
    expect(row.lastUsedAt).toBeInstanceOf(Date);
  });

  it('is idempotent — registering the same token again keeps the same row', async () => {
    const user = await createUser();
    const body = { expoPushToken: TOKEN, platform: 'ios' };

    const first = await api().post('/api/devices').set(bearer(user)).send(body);
    const second = await api().post('/api/devices').set(bearer(user)).send(body);

    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(await prisma.device.count()).toBe(1);
  });

  it('reactivates a device that push had marked inactive', async () => {
    const user = await createUser();
    const device = await createDevice(user, { expoPushToken: TOKEN, active: false });

    await api().post('/api/devices').set(bearer(user)).send({ expoPushToken: TOKEN, platform: 'android' });

    expect((await prisma.device.findUniqueOrThrow({ where: { id: device.id } })).active).toBe(true);
  });

  it('moves the token to whoever signs in on the phone next', async () => {
    const before = await createUser();
    const after = await createUser();
    const device = await createDevice(before, { expoPushToken: TOKEN });

    const res = await api().post('/api/devices').set(bearer(after)).send({ expoPushToken: TOKEN, platform: 'android' });

    expect(res.body.id).toBe(device.id);
    expect((await prisma.device.findUniqueOrThrow({ where: { id: device.id } })).userId).toBe(after.id);
  });
});

describe('DELETE /api/devices/:deviceId', () => {
  it('401 without a token', async () => {
    const user = await createUser();
    const device = await createDevice(user);
    const res = await api().delete(`/api/devices/${device.id}`);
    expect(res.status).toBe(401);
  });

  it('404 for an unknown id', async () => {
    const user = await createUser();
    const res = await api().delete('/api/devices/nope').set(bearer(user));
    expect(res.status).toBe(404);
  });

  it("404 for another user's device — same as unknown, and it stays", async () => {
    const owner = await createUser();
    const other = await createUser();
    const device = await createDevice(owner);

    const res = await api().delete(`/api/devices/${device.id}`).set(bearer(other));

    expect(res.status).toBe(404);
    expect(await prisma.device.findUnique({ where: { id: device.id } })).not.toBeNull();
  });

  it('removes the device', async () => {
    const user = await createUser();
    const device = await createDevice(user);

    const res = await api().delete(`/api/devices/${device.id}`).set(bearer(user));

    expect(res.status).toBe(204);
    expect(await prisma.device.findUnique({ where: { id: device.id } })).toBeNull();
  });
});
