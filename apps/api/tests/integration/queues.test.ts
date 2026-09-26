import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createAdmin } from '../helpers/factories';
import { TEST_ADMIN_PASSWORD, TEST_ADMIN_USER } from '../setup/env';

// Bull Board lives under /admin behind HTTP Basic auth — not the JWT the
// rest of the API uses, so it still works when login is what is broken.
describe('/admin/queues (Bull Board)', () => {
  it('401 with a Basic challenge and no credentials', async () => {
    const res = await api().get('/admin/queues');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/^Basic realm=/);
  });

  it('401 for wrong credentials', async () => {
    const res = await api().get('/admin/queues').auth(TEST_ADMIN_USER, 'nope');
    expect(res.status).toBe(401);
  });

  it('a JWT is not accepted here', async () => {
    const admin = await createAdmin();
    const res = await api().get('/admin/queues').set(bearer(admin));
    expect(res.status).toBe(401);
  });

  it('serves the dashboard with the right credentials', async () => {
    const res = await api().get('/admin/queues/').auth(TEST_ADMIN_USER, TEST_ADMIN_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('the whole /admin prefix is guarded, not just the dashboard', async () => {
    const res = await api().get('/admin/anything-else');
    expect(res.status).toBe(401);
  });
});
