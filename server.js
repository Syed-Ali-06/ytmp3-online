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
let clients = [];
app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// Helper to broadcast progress
function broadcastProgress(message) {
  clients.forEach(client => client.write(`data: ${message}\n\n`));
}

app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  const uniqueName = `yt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`;
  const output = path.join(downloadsDir, uniqueName);

  console.log(`🚀 Starting download for ${url}`);
  broadcastProgress("Download started...");

  try {
    // yt-dlp with progress logging
    await ytdlp(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: output,
      progress: true,
      onProgress: (info) => {
        if (info.percent) {
          broadcastProgress(`Progress: ${Math.round(info.percent)}%`);
        }
      }
    });

    console.log(`✅ Finished download: ${uniqueName}`);
    broadcastProgress("Conversion complete!");
    res.json({ file: `/downloads/${uniqueName}` });
  } catch (err) {
    console.error('yt-dlp error:', err);
    broadcastProgress("❌ Conversion failed!");
    res.status(500).json({ error: 'Conversion failed', details: err.message });
  }
});

app.use('/downloads', express.static(downloadsDir));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
