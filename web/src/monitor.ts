/**
 * Reads the board's serial output at 115200 baud (matching Serial.begin in the sketch).
 *
 * Decoding is explicitly UTF-8 and streaming: the firmware prints Thai log lines, and
 * a multi-byte character can land across a read boundary. A single stateful decoder
 * with {stream: true} keeps those characters intact, which is why this does not just
 * decode each chunk on its own.
 */
import { acquirePort, forgetPort } from "./serial";

const BAUD = 115200;

export class SerialMonitor {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private running = false;
  private decoder = new TextDecoder("utf-8");
  private partial = "";

  constructor(
    private onLines: (lines: string[]) => void,
    private onState: (running: boolean, error?: string) => void,
  ) {}

  get active() {
    return this.running;
  }

  async start() {
    if (this.running) return;
    try {
      this.port = await acquirePort();
      await this.port.open({ baudRate: BAUD, bufferSize: 4096 });
    } catch (e) {
      // An already-open port throws here; surface it rather than silently doing nothing.
      this.onState(false, String(e instanceof Error ? e.message : e));
      return;
    }
    this.running = true;
    this.onState(true);
    void this.readLoop();
  }

  private async readLoop() {
    while (this.running && this.port?.readable) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this.push(this.decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        if (this.running) this.onState(false, String(e instanceof Error ? e.message : e));
      } finally {
        try {
          this.reader.releaseLock();
        } catch {
          /* already released */
        }
        this.reader = null;
      }
      if (!this.running) break;
    }
  }

  private push(text: string) {
    this.partial += text.replace(/\r/g, "");
    const parts = this.partial.split("\n");
    this.partial = parts.pop() ?? ""; // trailing fragment waits for the rest of the line
    if (parts.length) this.onLines(parts);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* reader may already be gone */
    }
    try {
      await this.port?.close();
    } catch {
      forgetPort();
    }
    if (this.partial) {
      this.onLines([this.partial]);
      this.partial = "";
    }
    this.onState(false);
  }
}
