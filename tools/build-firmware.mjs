#!/usr/bin/env node
/**
 * Builds the SOS Beacon firmware and stages the flash artifacts for the web flasher.
 *
 * Written in Node (not PowerShell) so the same script runs locally on Windows and
 * in Linux CI. Emits web/public/firmware/<target>/ with the raw .bin files plus a
 * manifest.json describing every flash offset, so the web app never hardcodes them.
 *
 *   node tools/build-firmware.mjs            # build the T-Beam beacon
 *   node tools/build-firmware.mjs s3-test    # build the ESP32-S3 pipeline probe
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "tools", "bin", "arduino-cli.exe");
const CLI_FALLBACK = "arduino-cli";
const CONFIG = path.join(ROOT, "tools", "arduino-cli.yaml");

// Flash layout is identical for both targets except the bootloader offset:
// ESP32 classic keeps the bootloader at 0x1000, ESP32-S3 puts it at 0x0.
const TARGETS = {
  tbeam: {
    sketch: "LoRa_SOS_Beacon_SX1262",
    fqbn: "esp32:esp32:esp32:PartitionScheme=default,FlashFreq=80,UploadSpeed=921600",
    chipFamily: "ESP32",
    label: "LoRa SOS Beacon — T-Beam V1.2 (SX1262)",
    bootloaderOffset: 0x1000,
  },
  "s3-test": {
    sketch: path.join("tools", "test", "IdProbe"),
    // CDCOnBoot=cdc is required: it defaults to Disabled, which maps Serial to UART0
    // on GPIO43/44 and produces no output at all over the S3's native USB port.
    fqbn: "esp32:esp32:esp32s3:PartitionScheme=default,FlashMode=qio,USBMode=hwcdc,CDCOnBoot=cdc",
    chipFamily: "ESP32-S3",
    label: "Beacon ID probe (ESP32-S3 pipeline test)",
    bootloaderOffset: 0x0,
  },
};

// Must stay byte-identical to loadBeaconId() in the .ino.
const ID_BLOB = { offset: 0x290000, sectorSize: 4096, magic: "TBSOSID1", maxLen: 12 };

const targetName = process.argv[2] ?? "tbeam";
const target = TARGETS[targetName];
if (!target) {
  console.error(`unknown target "${targetName}" (expected: ${Object.keys(TARGETS).join(", ")})`);
  process.exit(1);
}

const cli = fs.existsSync(CLI) ? CLI : CLI_FALLBACK;
const outDir = path.join(ROOT, "tools", "out", targetName);
const destDir = path.join(ROOT, "web", "public", "firmware", targetName);

writeCliConfig();
assertBeaconIdParsersMatch();

console.log(`> compiling ${targetName} (${target.fqbn})`);
fs.rmSync(outDir, { recursive: true, force: true });
execFileSync(cli, [
  "--config-file", CONFIG,
  "compile",
  "--fqbn", target.fqbn,
  "--output-dir", outDir,
  path.join(ROOT, target.sketch),
], { stdio: "inherit" });

// arduino-cli names artifacts after the sketch folder.
const sketchName = path.basename(target.sketch);
const bootApp0 = findBootApp0();

const sources = [
  { file: path.join(outDir, `${sketchName}.ino.bootloader.bin`), name: "bootloader.bin", offset: target.bootloaderOffset },
  { file: path.join(outDir, `${sketchName}.ino.partitions.bin`), name: "partitions.bin", offset: 0x8000 },
  { file: bootApp0,                                              name: "boot_app0.bin", offset: 0xe000 },
  { file: path.join(outDir, `${sketchName}.ino.bin`),            name: "firmware.bin",  offset: 0x10000 },
];

fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });

const parts = sources.map(({ file, name, offset }) => {
  const data = fs.readFileSync(file);
  fs.writeFileSync(path.join(destDir, name), data);
  const sha256 = createHash("sha256").update(data).digest("hex");
  console.log(`  ${name.padEnd(16)} @ 0x${offset.toString(16).padStart(6, "0")}  ${String(data.length).padStart(7)} bytes`);
  return { path: name, offset, size: data.length, sha256 };
});

const manifest = {
  target: targetName,
  label: target.label,
  chipFamily: target.chipFamily,
  fqbn: target.fqbn,
  coreVersion: detectCoreVersion(),
  buildTime: new Date().toISOString(),
  idBlob: ID_BLOB,
  parts,
};
fs.writeFileSync(path.join(destDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const total = parts.reduce((n, p) => n + p.size, 0);
console.log(`> wrote ${destDir} (${(total / 1024).toFixed(0)} KiB across ${parts.length} files)`);

/**
 * Generates the arduino-cli config instead of committing one, so the file never
 * carries machine-specific absolute paths.
 *
 * Libraries live in a project-local directory so their versions are pinned by this
 * repo rather than by whatever the developer happens to have installed. The core
 * data directory is shared with an existing Arduino IDE install when there is one,
 * purely to avoid re-downloading ~2 GB of toolchain.
 */
function writeCliConfig() {
  const sharedData =
    process.env.ARDUINO_DIRECTORIES_DATA ??
    (process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA ?? "", "Arduino15")
      : path.join(process.env.HOME ?? "", ".arduino15"));

  const dataDir = fs.existsSync(sharedData) ? sharedData : path.join(ROOT, "tools", "arduino-data");
  fs.mkdirSync(dataDir, { recursive: true });

  const yaml = [
    "# Generated by tools/build-firmware.mjs — do not edit, do not commit.",
    "directories:",
    `  data: ${dataDir}`,
    `  downloads: ${path.join(dataDir, "staging")}`,
    `  user: ${path.join(ROOT, "tools", "arduino")}`,
    "library:",
    "  enable_unsafe_install: false",
    "",
  ].join("\n");
  fs.writeFileSync(CONFIG, yaml);
}

/**
 * The S3 probe only proves anything if it parses the ID blob the same way the real
 * beacon does. Both sketches must stay standalone-compilable in the Arduino IDE, so
 * the function is duplicated rather than shared via a header — this guard is what
 * stops the two copies drifting apart unnoticed.
 */
function assertBeaconIdParsersMatch() {
  const extract = (file) => {
    const src = fs.readFileSync(file, "utf8");
    const start = src.indexOf("void loadBeaconId()");
    if (start === -1) throw new Error(`loadBeaconId() not found in ${file}`);
    const end = src.indexOf("\n}", start);
    if (end === -1) throw new Error(`loadBeaconId() not terminated in ${file}`);
    // Normalise whitespace and strip comments so wording differences do not trip the guard.
    return src
      .slice(start, end + 2)
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const beacon = path.join(ROOT, "LoRa_SOS_Beacon_SX1262", "LoRa_SOS_Beacon_SX1262.ino");
  const probe = path.join(ROOT, "tools", "test", "IdProbe", "IdProbe.ino");
  if (!fs.existsSync(probe)) return;

  if (extract(beacon) !== extract(probe)) {
    console.error("loadBeaconId() differs between the beacon sketch and the S3 probe.");
    console.error("Keep them identical, or the S3 test proves nothing about the real board.");
    process.exit(1);
  }
}

/** boot_app0.bin ships with the esp32 core, not with the sketch build. */
function findBootApp0() {
  const dirs = execFileSync(cli, ["--config-file", CONFIG, "config", "get", "directories.data"], { encoding: "utf8" }).trim();
  const base = path.join(dirs, "packages", "esp32", "hardware", "esp32");
  const version = fs.readdirSync(base).sort().pop();
  const p = path.join(base, version, "tools", "partitions", "boot_app0.bin");
  if (!fs.existsSync(p)) throw new Error(`boot_app0.bin not found at ${p}`);
  return p;
}

function detectCoreVersion() {
  try {
    const dirs = execFileSync(cli, ["--config-file", CONFIG, "config", "get", "directories.data"], { encoding: "utf8" }).trim();
    const base = path.join(dirs, "packages", "esp32", "hardware", "esp32");
    return `esp32:esp32@${fs.readdirSync(base).sort().pop()}`;
  } catch {
    return "unknown";
  }
}
