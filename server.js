import express from "express";
import cors from "cors";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create downloads folder if missing
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

// Endpoint to convert YouTube to MP3
app.post("/download", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  const uniqueName = `yt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.mp3`;
  const output = path.join(downloadsDir, uniqueName);

  const command = `yt-dlp -x --audio-format mp3 -o "${output}" "${url}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("yt-dlp error:", stderr);
      return res.status(500).json({ error: "Conversion failed", details: stderr });
    }
    res.json({ file: `/downloads/${uniqueName}` });
  });
});

// Serve downloads folder
app.use("/downloads", express.static(downloadsDir));

// Listen on dynamic port for hosting
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
