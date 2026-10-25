import fs from "node:fs";
import crypto from "node:crypto";

const out = "public/images";
fs.mkdirSync(out, { recursive: true });
const used = new Map();

for (const file of process.argv.slice(2)) {
  const html = fs.readFileSync(file, "utf8");
  const re = /data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)/g;
  for (const m of html.matchAll(re)) {
    const buf = Buffer.from(m[2], "base64");
    const hash = crypto.createHash("md5").update(buf).digest("hex").slice(0, 8);
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const base = m[1] === "png" ? "cathay-logo" : "a350";
    if (used.get(base) === hash) continue;
    const name = used.has(base) ? `${base}-${hash}.${ext}` : `${base}.${ext}`;
    used.set(base, used.get(base) ?? hash);
    fs.writeFileSync(`${out}/${name}`, buf);
    console.log("wrote", `${out}/${name}`, `(from ${file})`);
  }
}