/**
 * Convert WebVTT text string into standard SubRip (.srt) format.
 */
export function convertVttToSrt(vttText: string): string {
  const lines = vttText.split(/\r?\n/);
  const srtLines: string[] = [];
  let blockIndex = 1;

  let i = 0;

  // Skip WEBVTT header and metadata lines
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "WEBVTT" || line.startsWith("X-TIMESTAMP-MAP") || line.startsWith("NOTE")) {
      i++;
      continue;
    }
    if (line.includes("-->")) {
      break;
    }
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes("-->")) {
      // VTT format: 00:00:01.000 --> 00:00:04.000
      // SRT format: 00:00:01,000 --> 00:00:04,000
      const timestamp = line.replace(/\./g, ",");

      srtLines.push(String(blockIndex));
      srtLines.push(timestamp);
      blockIndex++;

      i++;
      // Collect dialogue lines until blank line
      while (i < lines.length && lines[i].trim() !== "") {
        const text = lines[i].trim().replace(/<[^>]+>/g, ""); // Strip VTT tags like <c.color>
        if (text) {
          srtLines.push(text);
        }
        i++;
      }
      srtLines.push(""); // Blank separator line
    }
    i++;
  }

  return srtLines.join("\n");
}
