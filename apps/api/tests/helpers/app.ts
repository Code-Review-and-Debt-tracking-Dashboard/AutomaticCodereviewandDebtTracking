import request from 'supertest';

import { createApp } from '../../src/app';

// One app for the whole run. createApp() is free of listen(), so supertest
// drives it in-process — no port, no server boot.
export const app = createApp();

export const api = () => request(app);
