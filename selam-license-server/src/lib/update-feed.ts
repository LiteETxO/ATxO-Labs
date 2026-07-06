// ─── Update feed adapter ─────────────────────────────────────────────
//
// Reads the auto-update manifest from R2 (or wherever UPDATES_FEED_BASE
// points) and parses it. Used by:
//   - GET /api/updates/manifest        (JSON for the download page)
//   - GET /api/updates/latest-mac.yml  (raw YAML for electron-updater)
//   - /download                        (renders current version)
//
// Defaults to R2 when UPDATES_FEED_BASE isn't set. Override during dev
// or for staging by setting that env var.

const DEFAULT_FEED_BASE = 'https://updates.heyselam.app/mac';
const FEED_BASE = process.env.UPDATES_FEED_BASE || DEFAULT_FEED_BASE;

export type UpdateManifest = {
  version: string;
  releaseDate: string | null;
  fileName: string;
  fileUrl: string;
  size: number | null;
  sha512: string | null;
  rawYaml: string;
};

// Minimal YAML parser — the manifest electron-builder writes is well-formed
// and small. Avoids pulling a YAML library into the bundle for ~10 fields.
//
// Manifest shape (single channel, single platform — what we ship):
//   version: 1.0.1
//   files:
//     - url: Selam-1.0.1-arm64.dmg
//       sha512: <base64>
//       size: 763415552
//       blockMapSize: 802345
//   path: Selam-1.0.1-arm64.dmg
//   sha512: <same as files[0].sha512>
//   releaseDate: '2026-05-25T10:00:00.000Z'
function parseManifest(yaml: string): UpdateManifest | null {
  const lines = yaml.split('\n');
  let version = '';
  let releaseDate: string | null = null;
  let topLevelPath = '';
  let topLevelSha = '';
  let fileUrl = '';
  let fileSha = '';
  let fileSize: number | null = null;

  let inFiles = false;
  let inFirstFile = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    // Top-level keys (no leading whitespace)
    const top = line.match(/^([a-zA-Z][a-zA-Z0-9_]*):\s*(.*)$/);
    if (top) {
      const [, k, v] = top;
      if (k === 'files') { inFiles = true; inFirstFile = false; continue; }
      inFiles = false;
      if (k === 'version') version = stripQuotes(v);
      else if (k === 'releaseDate') releaseDate = stripQuotes(v);
      else if (k === 'path') topLevelPath = stripQuotes(v);
      else if (k === 'sha512') topLevelSha = stripQuotes(v);
      continue;
    }
    if (inFiles) {
      // First-level array item start (- url: ...)
      const arr = line.match(/^\s*-\s*url:\s*(.*)$/);
      if (arr) { inFirstFile = true; fileUrl = stripQuotes(arr[1]); continue; }
      if (inFirstFile) {
        const kv = line.match(/^\s+([a-zA-Z][a-zA-Z0-9_]*):\s*(.*)$/);
        if (kv) {
          const [, k, v] = kv;
          if (k === 'sha512') fileSha = stripQuotes(v);
          else if (k === 'size') fileSize = parseInt(v, 10);
        }
      }
    }
  }

  const fileName = fileUrl || topLevelPath;
  if (!version || !fileName) return null;
  return {
    version,
    releaseDate,
    fileName,
    fileUrl: `${FEED_BASE}/${fileName}`,
    size: fileSize,
    sha512: fileSha || topLevelSha || null,
    rawYaml: yaml,
  };
}

function stripQuotes(s: string): string {
  s = s.trim();
  if ((s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

// In-process cache so we don't hit R2 on every page render. 60s TTL —
// matches the cache hint we set on the R2 manifest at upload time.
let _cache: { manifest: UpdateManifest | null; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export async function getCurrentManifest(opts: { fresh?: boolean } = {}): Promise<UpdateManifest | null> {
  const now = Date.now();
  if (!opts.fresh && _cache && (now - _cache.fetchedAt) < CACHE_TTL_MS) {
    return _cache.manifest;
  }
  try {
    const resp = await fetch(`${FEED_BASE}/latest-mac.yml`, {
      // Don't honor any upstream cache — we manage cache locally above.
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      // Cache the negative result briefly so we don't hammer a sick origin
      _cache = { manifest: null, fetchedAt: now };
      return null;
    }
    const yaml = await resp.text();
    const manifest = parseManifest(yaml);
    _cache = { manifest, fetchedAt: now };
    return manifest;
  } catch (e) {
    console.warn('[update-feed] fetch failed:', (e as Error).message);
    _cache = { manifest: null, fetchedAt: now };
    return null;
  }
}

// Used by /api/updates/latest-mac.yml — pass-through the raw YAML so
// electron-updater can parse it directly. No JSON conversion in case
// electron-updater strict-checks YAML shape.
export async function getRawManifest(): Promise<string | null> {
  const m = await getCurrentManifest();
  return m?.rawYaml ?? null;
}
