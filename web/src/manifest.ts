/**
 * Loads the firmware manifest and its binaries.
 *
 * Binaries are fetched as soon as the page loads so that pressing Upload does not
 * wait on the network. Each .bin is requested with its content hash in the query
 * string: the files are served `immutable`, and the changing URL is what makes a
 * rebuilt firmware actually reach students instead of being served from cache.
 */

export interface ManifestPart {
  path: string;
  offset: number;
  size: number;
  sha256: string;
}

export interface Manifest {
  target: string;
  label: string;
  chipFamily: string;
  fqbn: string;
  coreVersion: string;
  buildTime: string;
  idBlob: { offset: number; sectorSize: number; magic: string; maxLen: number };
  parts: ManifestPart[];
}

export interface LoadedFirmware {
  manifest: Manifest;
  parts: { data: Uint8Array; address: number }[];
}

/** `?target=s3-test` swaps in the ESP32-S3 probe build used to verify the pipeline. */
export function targetName(): string {
  const t = new URLSearchParams(location.search).get("target");
  return t && /^[a-z0-9-]+$/.test(t) ? t : "tbeam";
}

export async function loadFirmware(): Promise<LoadedFirmware> {
  const base = `${import.meta.env.BASE_URL}firmware/${targetName()}`;
  const res = await fetch(`${base}/manifest.json`);
  if (!res.ok) throw new Error(`cannot load firmware manifest (HTTP ${res.status})`);
  const manifest: Manifest = await res.json();

  const parts = await Promise.all(
    manifest.parts.map(async (p) => {
      const r = await fetch(`${base}/${p.path}?v=${p.sha256.slice(0, 12)}`);
      if (!r.ok) throw new Error(`cannot load ${p.path} (HTTP ${r.status})`);
      const data = new Uint8Array(await r.arrayBuffer());
      if (data.length !== p.size) {
        throw new Error(`${p.path} is ${data.length} bytes, manifest says ${p.size}`);
      }
      return { data, address: p.offset };
    }),
  );

  return { manifest, parts };
}
