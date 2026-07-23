from http.server import BaseHTTPRequestHandler
import json
import re
import time
import urllib.parse
import requests

BASE_URL = "https://z2.idlixku.com"
MAJORPLAY_BASE = "https://e2e.majorplay.net"
UA = (
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36"
)

def parse_idlix_url(input_str):
    clean = input_str.strip().split("?")[0].rstrip("/")
    ep_match = re.search(r'/(?:series|tv)/([^/]+)/season/(\d+)/episode/(\d+)', clean, re.IGNORECASE)
    if ep_match:
        return {
            "slug": ep_match.group(1),
            "contentType": "episode",
            "season": int(ep_match.group(2)),
            "episode": int(ep_match.group(3))
        }
    if "/series/" in clean or "/tv/" in clean:
        slug = clean.split("/")[-1]
        return {"slug": slug, "contentType": "series"}
    
    slug = clean.split("/")[-1]
    return {"slug": slug, "contentType": "movie"}

def resolve_relative_url(path, base_url):
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if path.startswith("/"):
        parsed = urllib.parse.urlparse(base_url)
        return f"{parsed.scheme}://{parsed.netloc}{path}"
    return f"{base_url.rsplit('/', 1)[0]}/{path}"

def parse_variants(master_text, base_url):
    lines = master_text.strip().split("\n")
    variants = []
    audio_url = None

    for line in lines:
        if "#EXT-X-MEDIA:TYPE=AUDIO" in line:
            match = re.search(r'URI="([^"]+)"', line)
            if match:
                audio_url = resolve_relative_url(match.group(1), base_url)

    if "#EXT-X-STREAM-INF" not in master_text:
        return [{
            "resolution": "Original",
            "height": "Original",
            "bandwidth": 0,
            "url": base_url
        }], audio_url

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("#EXT-X-STREAM-INF:"):
            bw_match = re.search(r"BANDWIDTH=(\d+)", line)
            res_match = re.search(r"RESOLUTION=([x\d]+)", line)

            bw = int(bw_match.group(1)) if bw_match else 0
            res = res_match.group(1) if res_match else "unknown"

            i += 1
            while i < len(lines) and (lines[i].strip() == "" or lines[i].strip().startswith("#")):
                i += 1

            if i < len(lines):
                path = lines[i].strip()
                url = resolve_relative_url(path, base_url)

                if "x" in res:
                    height = res.split("x")[1] + "p"
                else:
                    if bw > 3500000: height = "1080p"
                    elif bw > 1800000: height = "720p"
                    elif bw > 900000: height = "480p"
                    else: height = "360p"

                if not any(v["url"] == url for v in variants):
                    variants.append({
                        "resolution": res,
                        "height": height,
                        "bandwidth": bw,
                        "url": url
                    })
        i += 1

    variants.sort(key=lambda x: x["bandwidth"], reverse=True)
    return variants, audio_url

def execute_full_flow(input_str):
    parsed = parse_idlix_url(input_str)
    slug = parsed["slug"]
    ctype = parsed["contentType"]
    season = parsed.get("season")
    episode = parsed.get("episode")

    session = requests.Session()
    session.headers.update({
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": BASE_URL,
        "Referer": f"{BASE_URL}/",
    })

    # Step 1: Resolve UUID
    if ctype == "episode":
        if not season or not episode:
            return None
        url = f"{BASE_URL}/api/series/{slug}/season/{season}"
        referer = f"{BASE_URL}/series/{slug}/season/{season}/episode/{episode}"
        r = session.get(url, headers={"Referer": referer}, timeout=20)
        if not r.ok: return None
        data = r.json()
        episodes = data.get("season", {}).get("episodes", [])
        uuid = None
        for ep in episodes:
            if str(ep.get("episodeNumber")) == str(episode):
                uuid = ep.get("id")
                break
        if not uuid: return None
    else:
        api_path = "/api/series" if ctype in ["series", "tv"] else "/api/movies"
        url = f"{BASE_URL}{api_path}/{slug}"
        referer = f"{BASE_URL}/{ctype}/{slug}"
        r = session.get(url, headers={"Referer": referer}, timeout=20)
        if not r.ok: return None
        data = r.json()
        uuid = data.get("id") or (data.get("data", {}) or {}).get("id")
        if not uuid: return None

    # Step 2: Track View
    track_url = f"{BASE_URL}/api/views/track"
    track_body = {"contentType": "tv_series" if ctype == "episode" else ctype, "contentId": uuid}
    if ctype == "episode" and uuid:
        track_body["episodeId"] = uuid
    try:
        session.post(track_url, json=track_body, headers={"Referer": f"{BASE_URL}/{ctype}/"}, timeout=10)
    except:
        pass

    # Step 3: Get Play Info
    play_info_type = "episode" if ctype == "episode" else "movie"
    play_url = f"{BASE_URL}/api/watch/play-info/{play_info_type}/{uuid}"
    r = session.get(play_url, headers={"Referer": f"{BASE_URL}/{ctype}/"}, timeout=20)
    if not r.ok: return None
    play_info = r.json()
    if play_info.get("kind") != "gate" or not play_info.get("gateToken"): return None

    # Step 4: Wait Countdown
    wait_ms = min(max(0, play_info["unlockAt"] - play_info["serverNow"] + 500), 20000)
    if wait_ms > 0:
        time.sleep(wait_ms / 1000.0)

    # Step 5: Claim Session
    claim_url = f"{BASE_URL}/api/watch/session/claim"
    r = session.post(claim_url, json={"gateToken": play_info["gateToken"]}, headers={"Referer": f"{BASE_URL}/{ctype}/"}, timeout=20)
    if not r.ok: return None
    claim_data = r.json()
    if not claim_data.get("claim") or not claim_data.get("redeemUrl"):
        return None

    # Step 6: Redeem Claim (majorplay.net)
    redeem_url = claim_data["redeemUrl"]
    r = session.post(
        redeem_url,
        data=json.dumps({"claim": claim_data["claim"]}),
        headers={"Content-Type": "text/plain", "Origin": BASE_URL, "Referer": f"{BASE_URL}/"},
        timeout=20
    )
    if not r.ok: return None
    play_data = r.json()
    if play_data.get("code") != "ok": return None

    master_url = play_data.get("url")
    if not master_url: return None

    # Fetch Master M3U8
    m3u8_resp = session.get(master_url, headers={"Origin": BASE_URL, "Referer": f"{BASE_URL}/"}, timeout=20)
    if not m3u8_resp.ok: return None
    master_text = m3u8_resp.text

    variants, audio_url = parse_variants(master_text, master_url)

    subtitles = [
        {"lang": s.get("lang"), "label": s.get("label"), "url": s.get("path")}
        for s in play_data.get("subtitles", [])
    ]

    return {
        "title": claim_data.get("title") or slug,
        "videoId": play_data.get("videoId") or claim_data.get("videoId"),
        "durationSec": claim_data.get("durationSec"),
        "maxHeight": play_data.get("maxHeight") or claim_data.get("maxHeight"),
        "expiresAt": play_data.get("expiresAt"),
        "masterUrl": master_url,
        "variants": variants,
        "audioPlaylistUrl": audio_url,
        "subtitles": subtitles
    }

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode('utf-8'))
            url = body.get('url', '')

            result = execute_full_flow(url)

            if result:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Failed to resolve stream via Python engine"}).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
