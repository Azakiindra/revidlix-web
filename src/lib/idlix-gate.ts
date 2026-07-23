export const BASE_URL = "https://z2.idlixku.com";
export const MAJORPLAY_BASE = "https://e2e.majorplay.net";
export const STEALTH_API_URL = process.env.STEALTH_API_URL || "http://localhost:8191";
export const DEFAULT_UA = 
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36";

export interface SubtitleTrack {
  lang: string;
  label: string;
  url: string;
}

export interface StreamVariant {
  resolution: string;
  height: string;
  bandwidth: number;
  url: string;
}

export interface StreamDataResult {
  title: string | null;
  videoId: string | null;
  durationSec: number | null;
  maxHeight: string | null;
  expiresAt: number | null;
  masterUrl: string | null;
  variants: StreamVariant[];
  audioPlaylistUrl: string | null;
  subtitles: SubtitleTrack[];
  isStealthUsed?: boolean;
}

export function parseIdlixUrl(input: string): {
  slug: string;
  contentType: "movie" | "series" | "episode";
  season?: number;
  episode?: number;
} {
  const clean = input.trim().split("?")[0].replace(/\/+$/, "");

  const epMatch = clean.match(/\/(?:series|tv)\/([^\/]+)\/season\/(\d+)\/episode\/(\d+)/i);
  if (epMatch) {
    return {
      slug: epMatch[1],
      contentType: "episode",
      season: parseInt(epMatch[2], 10),
      episode: parseInt(epMatch[3], 10),
    };
  }

  if (clean.includes("/series/") || clean.includes("/tv/")) {
    const slug = clean.split("/").pop() || clean;
    return { slug, contentType: "series" };
  }

  const slug = clean.split("/").pop() || clean;
  return { slug, contentType: "movie" };
}

export function resolveRelativeUrl(pathStr: string, baseUrl: string): string {
  if (pathStr.startsWith("http://") || pathStr.startsWith("https://")) {
    return pathStr;
  }
  if (pathStr.startsWith("/")) {
    try {
      const u = new URL(baseUrl);
      return `${u.protocol}//${u.host}${pathStr}`;
    } catch {
      return `${MAJORPLAY_BASE}${pathStr}`;
    }
  }
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf("/"));
  return `${baseDir}/${pathStr}`;
}

export function parseVariantsFromMaster(masterText: string, baseUrl: string): {
  variants: StreamVariant[];
  audioUrl: string | null;
} {
  const lines = masterText.trim().split("\n");
  const variants: StreamVariant[] = [];
  let audioUrl: string | null = null;

  for (const line of lines) {
    if (line.includes("#EXT-X-MEDIA:TYPE=AUDIO")) {
      const match = line.match(/URI="([^"]+)"/);
      if (match) {
        audioUrl = resolveRelativeUrl(match[1], baseUrl);
      }
    }
  }

  if (!masterText.includes("#EXT-X-STREAM-INF")) {
    return {
      variants: [
        {
          resolution: "Original",
          height: "Original",
          bandwidth: 0,
          url: baseUrl,
        },
      ],
      audioUrl,
    };
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      const resMatch = line.match(/RESOLUTION=([x\d]+)/);

      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      const resolution = resMatch ? resMatch[1] : "unknown";

      i++;
      while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) {
        i++;
      }

      if (i < lines.length) {
        const pathStr = lines[i].trim();
        const url = resolveRelativeUrl(pathStr, baseUrl);

        let height = "unknown";
        if (resolution.includes("x")) {
          height = `${resolution.split("x")[1]}p`;
        } else {
          if (bandwidth > 3500000) height = "1080p";
          else if (bandwidth > 1800000) height = "720p";
          else if (bandwidth > 900000) height = "480p";
          else height = "360p";
        }

        if (!variants.some((v) => v.url === url)) {
          variants.push({ resolution, height, bandwidth, url });
        }
      }
    }
    i++;
  }

  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return { variants, audioUrl };
}

export function parseSegmentsFromM3u8(m3u8Text: string, playlistUrl: string): {
  segments: string[];
  initUrl: string | null;
} {
  const segments: string[] = [];
  let initUrl: string | null = null;

  const lines = m3u8Text.split("\n");
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("#EXT-X-MAP:URI=")) {
      const match = line.match(/URI="([^"]+)"/);
      if (match) {
        initUrl = resolveRelativeUrl(match[1], playlistUrl);
      }
    } else if (!line.startsWith("#")) {
      segments.push(resolveRelativeUrl(line, playlistUrl));
    }
  }

  return { segments, initUrl };
}

export async function fetchM3u8Text(url: string): Promise<string | null> {
  try {
    const headers = {
      "User-Agent": DEFAULT_UA,
      Accept: "*/*",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
    };
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(`[fetchM3u8Text Error] ${url}:`, err);
    return null;
  }
}
