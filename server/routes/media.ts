import { Router } from 'express';
import { checkYtDlpStatus, extractMediaWithYtDlp } from '../ytdlp.js';

export const mediaRouter = Router();

mediaRouter.get('/api/media/status', async (_req, res) => {
  const status = await checkYtDlpStatus();
  res.json(status);
});

mediaRouter.post('/api/media/extract', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }
  const result = await extractMediaWithYtDlp(url);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

mediaRouter.post('/api/media/test', async (req, res) => {
  const { url } = req.body;
  const status = await checkYtDlpStatus();
  if (!url) {
    return res.json({ available: status.available, version: status.version, success: false, error: 'URL is required for test extraction' });
  }
  const result = await extractMediaWithYtDlp(url);
  res.json({ available: status.available, version: status.version, ...result });
});

export default mediaRouter;
