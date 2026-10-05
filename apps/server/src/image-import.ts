import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { UPLOAD_MAX_BYTES } from "@prism/shared";
import { badRequest } from "./errors.js";

// Downloads an image from a URL an AI editor gives (e.g. a Mobbin screen) so it can be stored in
// the board's object storage. The server fetches it, so private and local addresses are refused:
// a URL must not be a way to reach the server's own network.

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

const isBlocked = (address: string) =>
  blocked.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");

const NOT_ALLOWED = "That address can't be used. Give a public http(s) image URL.";

/** Refuses URLs that aren't http(s) or whose host resolves to a private or local address. */
async function checkPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw badRequest(NOT_ALLOWED);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true }).then(
        (results) => results.map((result) => result.address),
        () => {
          throw badRequest(`Couldn't find the host ${host}.`);
        },
      );
  if (addresses.length === 0 || addresses.some(isBlocked)) throw badRequest(NOT_ALLOWED);
}

/** Reads a response body, refusing anything over the upload limit. */
async function readLimited(response: Response) {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > UPLOAD_MAX_BYTES) throw badRequest("That image is larger than 10 MB.");
  if (!response.body) throw badRequest("That URL returned no image.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > UPLOAD_MAX_BYTES) throw badRequest("That image is larger than 10 MB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Fetches `input`, following up to 3 redirects and checking each hop's address. */
export async function downloadImage(input: string) {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await checkPublicUrl(url);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "image/png,image/jpeg,image/webp,image/gif;q=0.9,*/*;q=0.1" },
      });
    } catch {
      throw badRequest("Couldn't download that image.");
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw badRequest(`Downloading the image failed (HTTP ${response.status}).`);
    const bytes = await readLimited(response);
    const image = sniffImage(bytes);
    if (!image) throw badRequest("That URL isn't a PNG, JPEG, GIF or WebP image.");
    return { bytes, ...image };
  }
  throw badRequest("That URL redirects too many times.");
}

interface ImageInfo {
  type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  extension: string;
  width: number;
  height: number;
}

/** The image's type (from its first bytes, not the server's word) and pixel size. */
export function sniffImage(b: Uint8Array): ImageInfo | null {
  const at = (i: number) => b[i] ?? 0;
  const be16 = (i: number) => (at(i) << 8) | at(i + 1);
  const le16 = (i: number) => at(i) | (at(i + 1) << 8);
  const le24 = (i: number) => at(i) | (at(i + 1) << 8) | (at(i + 2) << 16);
  const be32 = (i: number) =>
    ((at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3)) >>> 0;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));

  let info: ImageInfo | null = null;
  if (at(0) === 0x89 && ascii(1, 4) === "PNG") {
    info = { type: "image/png", extension: "png", width: be32(16), height: be32(20) };
  } else if (ascii(0, 4) === "GIF8") {
    info = { type: "image/gif", extension: "gif", width: le16(6), height: le16(8) };
  } else if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const chunk = ascii(12, 16);
    const webp = { type: "image/webp", extension: "webp" } as const;
    if (chunk === "VP8 ") {
      info = { ...webp, width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    } else if (chunk === "VP8L") {
      const [b1, b2, b3, b4] = [at(21), at(22), at(23), at(24)];
      info = {
        ...webp,
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    } else if (chunk === "VP8X") {
      info = { ...webp, width: 1 + le24(24), height: 1 + le24(27) };
    }
  } else if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    // Walk the JPEG segments to the frame header (SOFn), which holds the size.
    let i = 2;
    while (i + 9 < b.length) {
      if (at(i) !== 0xff) return null;
      const marker = at(i + 1);
      if (marker === 0xff) {
        i++;
        continue;
      }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        info = { type: "image/jpeg", extension: "jpg", width: be16(i + 7), height: be16(i + 5) };
        break;
      }
      i += 2 + be16(i + 2);
    }
  }
  return info && info.width > 0 && info.height > 0 ? info : null;
}
