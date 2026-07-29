import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { getRepoTrend } from '../services/repoService';


export const reposRouter = Router();



reposRouter.get('/api/repos/:repoId/trend', requireAuth, async (req, res, next) =>{
    try {
        const trend = await getRepoTrend(req.params.repoId, req.query);
        res.status(200).json(trend);
    } catch (err) {
        next(err);
    }
});