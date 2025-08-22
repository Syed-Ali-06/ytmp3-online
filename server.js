import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import ytdlp from '@borodutch-labs/yt-dlp-exec';

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

app.get('/', (req, res) => {
  res.send('✅ YTMP3 backend is running!');
});

// SSE endpoint for progress
app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(() => {
    res.write(`data: still working...\n\n`);
  }, 2000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// POST endpoint for conversion
app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  const uniqueName = `yt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`;
  const output = path.join(downloadsDir, uniqueName);

  console.log(`🚀 Starting download for ${url}`);

  try {
    await ytdlp(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: output,
      progress: true // logs progress in backend
    });

    console.log(`✅ Finished download: ${uniqueName}`);
    res.json({ file: `/downloads/${uniqueName}` });
  } catch (err) {
    console.error('yt-dlp error:', err);
    res.status(500).json({ error: 'Conversion failed', details: err.message });
  }
});

app.use('/downloads', express.static(downloadsDir));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
