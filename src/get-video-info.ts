import { getYTDlp } from "./utils/get-ytdlp.ts";

const getVideoInfo = async (url = "") => {
  const ytDlpWrap = await getYTDlp();
  const result = await ytDlpWrap.execPromise([
    url,
    "-J",
    "--ignore-no-formats-error",
  ]);

  const info = JSON.parse(result);
  return info;
};

export { getVideoInfo };
