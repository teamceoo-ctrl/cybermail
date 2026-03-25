import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import https from "https";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uid = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${uid}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router: IRouter = Router();

router.post("/files/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file received" });

    const { filename, originalname, size, mimetype } = req.file;

    res.json({
      id: filename,
      name: originalname,
      size,
      mimetype,
      url: `/api/files/${filename}`,
    });
  } catch (err) {
    req.log.error({ err }, "Error uploading file");
    res.status(500).json({ error: "Upload failed" });
  }
});

router.get("/files/:id", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, path.basename(req.params.id));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.sendFile(filePath);
});

router.delete("/files/:id", (req, res) => {
  try {
    const filePath = path.join(UPLOADS_DIR, path.basename(req.params.id));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting file");
    res.status(500).json({ error: "Delete failed" });
  }
});

// ── Logo proxy — fetches brand logos server-side to bypass browser CORS/blocks ──

const LOGO_CACHE = new Map<string, { buf: Buffer; ct: string; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function fetchUrl(url: string): Promise<{ buf: Buffer; ct: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 CyberMail/1.0" },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ buf: Buffer.concat(chunks), ct: res.headers["content-type"] || "image/png" }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

router.get("/proxy/logo", async (req, res) => {
  const domain = (req.query.domain as string || "").trim().replace(/^https?:\/\//, "").split("/")[0];
  if (!domain || !domain.includes(".")) {
    return res.status(400).json({ error: "Invalid domain" });
  }

  const cached = LOGO_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.set("Content-Type", cached.ct);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(cached.buf);
  }

  const sources = [
    `https://logo.clearbit.com/${domain}?size=128`,
    `https://icon.horse/icon/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];

  for (const src of sources) {
    try {
      const { buf, ct } = await fetchUrl(src);
      if (buf.length < 100) continue;
      LOGO_CACHE.set(domain, { buf, ct, ts: Date.now() });
      res.set("Content-Type", ct);
      res.set("Cache-Control", "public, max-age=86400");
      return res.send(buf);
    } catch {
      continue;
    }
  }

  res.status(404).json({ error: "Logo not found" });
});

export default router;
