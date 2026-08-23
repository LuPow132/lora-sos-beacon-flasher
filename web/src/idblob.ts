/**
 * Builds the beacon-ID sector that gets flashed alongside the firmware.
 *
 * Layout must stay byte-identical to loadBeaconId() in LoRa_SOS_Beacon_SX1262.ino:
 *
 *   0x00  8 bytes   magic "TBSOSID1"
 *   0x08  1 byte    id length (1..12)
 *   0x09  12 bytes  id characters, 0xFF padded
 *   ...   0xFF to the end of the 4096-byte sector
 *
 * 0xFF is the erased state of NOR flash, so padding with it means the sector is
 * written exactly as the erase leaves it and nothing extra has to be programmed.
 */

export const ID_MAX_LEN = 12;
const MAGIC = "TBSOSID1";

export type IdError = "empty" | "chars" | "long";

/** Mirrors the firmware's own validation, so the board can never reject what the UI accepted. */
export function validateBeaconId(raw: string): IdError | null {
  if (raw.length === 0) return "empty";
  if (raw.length > ID_MAX_LEN) return "long";
  if (!/^[A-Z0-9]+$/.test(raw)) return "chars";
  return null;
}

export function buildIdBlob(id: string, sectorSize: number): Uint8Array {
  const err = validateBeaconId(id);
  if (err) throw new Error(`invalid beacon id: ${err}`);

  const blob = new Uint8Array(sectorSize).fill(0xff);
  for (let i = 0; i < MAGIC.length; i++) blob[i] = MAGIC.charCodeAt(i);
  blob[8] = id.length;
  for (let i = 0; i < id.length; i++) blob[9 + i] = id.charCodeAt(i);
  return blob;
}
