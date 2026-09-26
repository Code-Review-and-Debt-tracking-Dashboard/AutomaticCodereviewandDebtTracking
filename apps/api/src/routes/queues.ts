import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';
import basicAuth from 'express-basic-auth';

import { env } from '../config/env';
import { analysisQueue, bulkLinkQueue } from '../lib/queue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(analysisQueue), new BullMQAdapter(bulkLinkQueue)],
  serverAdapter,
});

export const queuesRouter = Router();

// guards everything under /admin
queuesRouter.use(
  '/admin',
  basicAuth({
    users: { [env.adminBasicAuthUser]: env.adminBasicAuthPassword },
    challenge: true,
    realm: 'CodePulse admin',
  }),
);

queuesRouter.use('/admin/queues', serverAdapter.getRouter());
