import 'dotenv/config';

import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';

const app = createApp();

app.listen(env.port, () => {
  logger.info({ port: env.port }, 'API listening');
});
