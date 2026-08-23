/**
 * Writes a beacon-ID sector to a file using the exact same code path the website
 * uses, so a command-line flash test exercises the shipped blob builder rather
 * than a re-implementation of it.
 *
 *   node --experimental-strip-types tools/gen-idblob.ts TEST12 out.bin
 */
import fs from "node:fs";
import { buildIdBlob, validateBeaconId } from "../web/src/idblob.ts";

const [, , id, out] = process.argv;
if (!id || !out) {
  console.error("usage: gen-idblob.ts <BEACON_ID> <output.bin>");
  process.exit(1);
}

const err = validateBeaconId(id);
if (err) {
  console.error(`invalid beacon id (${err})`);
  process.exit(1);
}

const blob = buildIdBlob(id, 4096);
fs.writeFileSync(out, blob);
console.log(`id       : ${id}`);
console.log(`first 24 : ${[...blob.slice(0, 24)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);
console.log(`ascii    : ${String.fromCharCode(...blob.slice(0, 8))} len=${blob[8]} "${String.fromCharCode(...blob.slice(9, 9 + blob[8]))}"`);
console.log(`wrote    : ${out} (${blob.length} bytes)`);
