# LoRa SOS Beacon — Web Flasher

Browser-based flasher for the AIR (Search & Rescue) course. A student plugs a
LILYGO T-Beam V1.2 into a computer, opens the site, types a beacon name, and presses
one button. No Arduino IDE, no board package, no libraries, no code editing.

Replaces sections 2 and 4 of `Readme.pdf` for the Beacon role. The Receiver and the
Python live map (`sos_live_map.py`) are unchanged and still handled by staff.

```
LoRa_SOS_Beacon_SX1262/   the beacon sketch (still compiles standalone in Arduino IDE)
web/                      the flasher website (Vite + TypeScript, deploys to Vercel)
tools/                    build scripts, and the ESP32-S3 test probe
```

## For students / นักเรียน

1. เปิดเว็บด้วย **Google Chrome** หรือ **Microsoft Edge** บนคอมพิวเตอร์
   (Firefox, Safari และมือถือใช้ไม่ได้ — เบราว์เซอร์เหล่านี้ยังไม่รองรับ Web Serial)
2. เสียบบอร์ด T-Beam เข้ากับคอมพิวเตอร์ด้วยสาย USB
3. พิมพ์ชื่อ Beacon (A-Z และ 0-9 ไม่เกิน 12 ตัว เช่น `B01`)
4. กด **เชื่อมต่อและอัปโหลด** แล้วเลือกบอร์ดจากรายการที่เบราว์เซอร์เปิดขึ้นมา
5. เสร็จแล้วกดแท็บ **ดูข้อมูลจากบอร์ด** เพื่อดูสถานะ GPS และการส่ง SOS

## How the beacon name works

`BEACON_ID` used to be a compile-time `#define`, which a browser cannot change. The
name now lives in flash instead, so **one pre-compiled firmware serves every student**.

The website writes a 4096-byte sector to the `spiffs` partition at `0x290000` — free
because the sketch never uses SPIFFS — as one extra file in the same flash pass:

| Offset | Size | Contents |
|---|---|---|
| `0x00` | 8 | magic `TBSOSID1` |
| `0x08` | 1 | name length (1–12) |
| `0x09` | 12 | name characters, `0xFF` padded |

`loadBeaconId()` in the sketch reads it at boot and validates magic, length, and
charset. Anything unexpected falls back to `BEACON_ID_FALLBACK` (`"BLUE"`), so a board
flashed without a name still behaves exactly as the original code did.

This avoids patching the app image, which would invalidate both the ESP32 image
checksum byte and its appended SHA-256. Changing a beacon's name costs a single 4 KB
sector write (~0.1 s) and does not touch the firmware.

The same parser is duplicated in `tools/test/IdProbe/IdProbe.ino` so both sketches stay
standalone-compilable in the Arduino IDE. `build-firmware.mjs` compares the two copies
and fails the build if they drift apart.

## Rebuilding the firmware

Binaries under `web/public/firmware/` are committed so Vercel needs no toolchain.
Rebuild and commit them whenever the sketch changes:

```bash
node tools/setup.mjs            # once: portable arduino-cli + pinned core and libraries
node tools/build-firmware.mjs   # writes web/public/firmware/tbeam/
```

Versions are pinned in `tools/setup.mjs` (esp32 core 3.3.11, RadioLib 7.7.1,
XPowersLib 0.3.1, TinyGPSPlus 1.0.3, SSD1306 driver 4.6.2). `tools/arduino-cli.yaml` is
generated, not committed — it holds absolute machine paths.

## Running the website

```bash
cd web
npm install
npm run dev       # http://localhost:5173
npm run build     # -> dist/
```

Web Serial requires a secure context; `localhost` and any HTTPS origin both qualify.

## Deploying to Vercel

Static build, no serverless functions.

1. `git init && git add . && git commit -m "..."`, push to GitHub.
2. Import the repo in Vercel and set **Root Directory** to `web`.
   Framework preset **Vite**, build `npm run build`, output `dist` — `web/vercel.json`
   already declares these along with cache headers.
3. Deploy. HTTPS is automatic, which is all Web Serial needs.

Firmware `.bin` files are served `immutable` and requested with a content-hash query
string, so a classroom of 30 students hits the CDN rather than the origin, and a
rebuilt firmware still reaches everyone because its URL changes.

## Testing without a T-Beam

`tools/test/IdProbe/` is a sketch for any ESP32-S3 board that parses the ID sector with
the identical function and prints what it recovered. It exercises everything except the
T-Beam's own peripherals.

```bash
node tools/build-firmware.mjs s3-test
cd web && npm run dev
# open http://localhost:5173/?target=s3-test
```

Flash with a name, then open the serial monitor tab and confirm the board reports it.

**What this does not cover:** the ESP32-S3 uses native USB-CDC, while the T-Beam uses a
CP2104 bridge with the classic DTR/RTS auto-reset circuit. esptool-js handles both, but
the T-Beam reset path is only truly confirmed on real hardware.

## Known issues in the sketch (left as-is deliberately)

- `loop()` reads the SOS button by level, not edge, so holding the button transmits
  every 300 ms. `DEBOUNCE_MS` limits the repeat rate rather than debouncing a press.
- The OLED status strings are Thai, but `ArialMT_Plain_10/16` are Latin-only fonts, so
  those lines do not render on screen. Serial output is unaffected — and the website's
  serial monitor decodes UTF-8, so Thai logs display correctly there.
