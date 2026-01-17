import YTDlpWrap from "yt-dlp-wrap";

let ytDlpWrap: YTDlpWrap;

const getYTDlp = async () => {
  await (YTDlpWrap as any).default.downloadFromGithub("yt-dlp", "2025.08.11", "win32");
  ytDlpWrap = new (YTDlpWrap as any).default("yt-dlp");

  return ytDlpWrap;
};

export {
  getYTDlp
};
