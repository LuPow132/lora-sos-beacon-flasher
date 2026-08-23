/**
 * Owns the single SerialPort shared by the flasher and the monitor.
 *
 * Only one consumer may hold the port open at a time — the monitor must be fully
 * stopped before flashing starts, or the flasher cannot claim it. Keeping the
 * SerialPort object around between the two means a student picks their board from
 * the browser chooser once, not once per tab.
 */

let port: SerialPort | null = null;

export const isSupported = () => typeof navigator !== "undefined" && "serial" in navigator;

export function currentPort(): SerialPort | null {
  return port;
}

/** Reuses the already-chosen port when there is one; otherwise shows the browser chooser. */
export async function acquirePort(forcePicker = false): Promise<SerialPort> {
  if (port && !forcePicker) return port;
  port = await navigator.serial.requestPort();
  return port;
}

export function forgetPort() {
  port = null;
}
