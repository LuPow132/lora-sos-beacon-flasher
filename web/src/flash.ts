import { ESPLoader, Transport } from "esptool-js";
import type { LoadedFirmware } from "./manifest";
import { buildIdBlob } from "./idblob";
import { acquirePort, forgetPort } from "./serial";

export type Phase = "connecting" | "erasing" | "writing" | "resetting" | "done";

export interface FlashCallbacks {
  onPhase: (phase: Phase) => void;
  /** 0..1 across the whole write, not per file. */
  onProgress: (fraction: number) => void;
  onLog: (line: string) => void;
  /** Return true to continue flashing a chip that is not the expected family. */
  onChipMismatch: (detected: string) => Promise<boolean>;
}

export class FlashCancelled extends Error {}

const BAUD = 921600;

export async function flash(
  fw: LoadedFirmware,
  beaconId: string,
  eraseAll: boolean,
  cb: FlashCallbacks,
): Promise<void> {
  cb.onPhase("connecting");

  const port = await acquirePort();
  const transport = new Transport(port, true);

  // esptool-js writes its own progress chatter here; route it into our log pane
  // rather than the console so students can paste it when asking for help.
  const terminal = {
    clean: () => {},
    writeLine: (data: string) => cb.onLog(data),
    write: (data: string) => cb.onLog(data),
  };

  const loader = new ESPLoader({ transport, baudrate: BAUD, terminal, debugLogging: false });

  try {
    const detected = await loader.main();
    cb.onLog(`detected chip: ${detected}`);

    if (!detected.toUpperCase().includes(fw.manifest.chipFamily.toUpperCase())) {
      const proceed = await cb.onChipMismatch(detected);
      if (!proceed) throw new FlashCancelled();
    }

    // The ID sector rides along as just another file in the same write pass, so
    // it costs one extra 4 KiB sector erase and nothing else.
    const idBlob = buildIdBlob(beaconId, fw.manifest.idBlob.sectorSize);
    const fileArray = [
      ...fw.parts.map((p) => ({ data: p.data, address: p.address })),
      { data: idBlob, address: fw.manifest.idBlob.offset },
    ];

    const totalBytes = fileArray.reduce((n, f) => n + f.data.length, 0);
    const writtenBefore: number[] = [];
    let acc = 0;
    for (const f of fileArray) {
      writtenBefore.push(acc);
      acc += f.data.length;
    }

    if (eraseAll) cb.onPhase("erasing");
    cb.onPhase("writing");

    await loader.writeFlash({
      fileArray,
      // "keep" honours whatever the bootloader header already specifies, which
      // avoids a whole class of boot failures across board revisions.
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll,
      compress: true,
      reportProgress: (fileIndex: number, written: number, _total: number) => {
        cb.onProgress(Math.min(1, (writtenBefore[fileIndex] + written) / totalBytes));
      },
    });

    cb.onPhase("resetting");
    await loader.after();
    cb.onPhase("done");
  } finally {
    // Always hand the port back, otherwise the monitor cannot open it afterwards.
    try {
      await transport.disconnect();
    } catch (e) {
      cb.onLog(`transport cleanup: ${String(e)}`);
      forgetPort();
    }
  }
}
