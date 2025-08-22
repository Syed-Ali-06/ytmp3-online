import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Directories
const downloadsDir = path.join(__dirname, 'downloads');
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// Serve frontend
app.use(express.static(publicDir));

// Serve MP3s
app.use('/downloads', express.static(downloadsDir));

// SSE progress
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

function broadcastProgress(message) {
  clients.forEach(client => client.write(`data: ${message}\n\n`));
}

// YouTube → MP3
app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  const uniqueName = `yt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`;
  const output = path.join(downloadsDir, uniqueName);

  broadcastProgress('Download started...');

  const ytdlp = spawn('yt-dlp', [
    '-x',
    '--audio-format', 'mp3',
    '-o', output,
    url
  ]);

  ytdlp.stdout.on('data', (data) => {
    const str = data.toString();
    const match = str.match(/(\d{1,3}\.\d)%/);
    if (match) broadcastProgress(`Progress: ${Math.round(match[1])}%`);
    console.log(str);
  });

  ytdlp.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  ytdlp.on('close', (code) => {
    if (fs.existsSync(output)) {
      broadcastProgress('✅ Conversion complete!');
      res.json({ file: `/downloads/${uniqueName}` });
    } else {
      broadcastProgress('❌ Conversion failed!');
      res.status(500).json({ error: 'Conversion failed' });
    }
  });
});

// Fallback route for all other URLs
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
