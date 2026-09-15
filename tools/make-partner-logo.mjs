#!/usr/bin/env node
/**
 * Regenerates web/public/partners.png from the master artwork.
 *
 * The master is 1920x185 RGBA (~169 KiB). The site renders the strip around
 * 560px wide, so it ships at 1200px for 2x displays, quantised to a 256-colour
 * palette — the logos are flat colour plus antialiasing, so the palette is
 * visually lossless here and cuts the file to ~23 KiB.
 *
 * Requires Python with Pillow:  python tools/make-partner-logo.mjs is NOT it —
 * run:  node tools/make-partner-logo.mjs
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(ROOT, "assets", "partners-source.png");
const dst = path.join(ROOT, "web", "public", "partners.png");

const script = `
from PIL import Image
im = Image.open(r"${src}").convert("RGBA")
w = 1200
h = round(im.height * w / im.width)
r = im.resize((w, h), Image.LANCZOS)
r.quantize(colors=256, method=Image.FASTOCTREE).save(r"${dst}", optimize=True)
import os; print(f"wrote {w}x{h}  {os.path.getsize(r'${dst}')/1024:.0f} KiB")
`;
execFileSync("python", ["-c", script], { stdio: "inherit" });
