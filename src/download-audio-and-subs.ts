import fs from "node:fs";
import { args } from "./utils/args.ts";
import { projectRoot } from "./utils/find-project-root.ts";
import { formatToFilename } from "./utils/format-to-filename.ts";
import { getYTDlp } from "./utils/get-ytdlp.ts";
import { isValidUrl } from "./utils/is-valid-url.ts";

const agents = [
  // Chrome - Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",

  // Chrome - Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_6_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",

  // Chrome - Linux
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Chrome/122.0.0.0 Safari/537.36",

  // Firefox - Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",

  // Firefox - Linux
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",

  // Safari - Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",

  // iOS Safari
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",

  // Edge - Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
];

const randomUA = agents[Math.floor(Math.random() * agents.length)];

function parseVtt(vttString = "") {
  const lines = vttString.replace(/\r/g, "").split("\n");
  const cues = [];

  const parseTime = (s) => {
    const str = s.trim().replace(",", ".");
    const m = str.match(/(?:(\d{2,}):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
    if (!m) throw new Error(`Timestamp inválido: "${s}"`);
    const [, h = "0", mm, ss, ms = "0"] = m;
    return (
      parseInt(h, 10) * 3600000 +
      parseInt(mm, 10) * 60000 +
      parseInt(ss, 10) * 1000 +
      parseInt(ms.padEnd(3, "0"), 10)
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;

    if (
      !line ||
      line.startsWith("WEBVTT") ||
      line.startsWith("NOTE") ||
      line.startsWith("STYLE") ||
      line.startsWith("REGION")
    ) {
      continue;
    }

    if (line.includes("-->")) {
      const [start, end] = line.split(/-->/).map((s) => s.trim().split(" ")[0]);
      const startMs = parseTime(start);
      const endMs = parseTime(end);

      const textLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i]);
        i++;
      }

      cues.push({
        startMs,
        endMs,
        text: textLines.join("\n"),
      });
    }
  }

  return cues;
}

const downloadAudioAndSubs = async (url = "") => {
  if (!isValidUrl(url)) throw new Error("Invalid URL");

  const fileName = formatToFilename(url);

  let subtitles = {
    ja: [],
  };

  if (args.download === false) {
    const ytDlpWrap = await getYTDlp();
    await ytDlpWrap.execPromise([
      url,
      "--sub-langs",
      "ja",
      "--write-subs",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "-o",
      `content/${fileName}.%(ext)s`,
      "--user-agent",
      randomUA,
    ]);
  }

  const jaPath = `${projectRoot}/content`;
  if (fs.existsSync(`${jaPath}/${fileName}.ja.vtt`)) {
    const cues = parseVtt(
      fs.readFileSync(`${jaPath}/${fileName}.ja.vtt`).toString()
    );
    subtitles.ja = cues;
  }

  return {
    ...subtitles,
    fileId: fileName
  };
};

export { downloadAudioAndSubs };
