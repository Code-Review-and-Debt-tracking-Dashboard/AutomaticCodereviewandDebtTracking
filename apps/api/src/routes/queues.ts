import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';
import basicAuth from 'express-basic-auth';

import { env } from '../config/env';
import { analysisQueue } from '../lib/queue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(analysisQueue)],
  serverAdapter,
});

export const queuesRouter = Router();

// Guards the whole /admin prefix, not just the dashboard, so anything added
// under it later is covered by default.
queuesRouter.use(
  '/admin',
  basicAuth({
    users: { [env.adminBasicAuthUser]: env.adminBasicAuthPassword },
    challenge: true,
    realm: 'CodeHealth admin',
  }),
);

queuesRouter.use('/admin/queues', serverAdapter.getRouter());
