import ffmpeg from "fluent-ffmpeg";
import { callAnkiConnect } from "./call-anki-connect.ts";
import { downloadAudioAndSubs } from "./download-audio-and-subs.ts";
import { getVideoInfo } from "./get-video-info.ts";
import { translateWithAi } from "./translate-with-ai.ts";
import { args } from "./utils/args.ts";
import { projectRoot } from "./utils/find-project-root.ts";

const GROUP_NAME = "音楽";
const MODEL_NAME = `${GROUP_NAME}::Model`;

type CutAudioInput = {
  fileId: string;
  startTimeMs: number;
  endTimeMs: number;
};
const cutAudio = async (input: CutAudioInput): Promise<string> => {
  const { fileId, startTimeMs, endTimeMs } = input;
  return new Promise((resolve, reject) => {
    const outputBuffer = [];

    ffmpeg(`${projectRoot}/content/${fileId}.mp3`)
      .setStartTime((startTimeMs - 200) / 1000) // Ms to Seconds
      .setDuration((endTimeMs - startTimeMs + 200) / 1000) // Ms to Seconds
      .format("mp3")
      .on("error", (err) => {
        reject("Error trying to cut the audio: " + err.message);
      })
      .on("end", () => {
        const base64Audio = Buffer.concat(outputBuffer).toString("base64");
        resolve(base64Audio);
      })
      .pipe()
      .on("data", (chunk) => {
        outputBuffer.push(chunk);
      });
  });
};

const createAnkiModelIfNotExists = async () => {
  const result = await callAnkiConnect("modelNames");

  if (result.includes(MODEL_NAME)) {
    return;
  }

  await callAnkiConnect("createModel", {
    modelName: MODEL_NAME,
    inOrderFields: [
      "Audio",
      "Japanese_Reading",
      "Translated",
      "Furigana",
      "Hiragana",
      "Hint",
    ],
    css: `
      .card {
          font-family: arial;
          font-size: 20px;
          text-align: center;
          color: black;
          background-color: white;
      }

      .hint {
        font-size: 0.9em;
        color: #555;
        display: block;
        margin-top: 6px;
      }

      .hint-star {
        color: #ff6600;
        font-size: 1.4em;
        font-weight: bold;
        margin-right: 4px;
      }
    `,
    cardTemplates: [
      {
        Name: MODEL_NAME,
        Front: `
          {{Audio}}
          <br><br>
          <b>{{Japanese_Reading}}</b>
        `,
        Back: `
          {{FrontSide}}
          <hr id=answer>
          <br>

          {{Hiragana}}
          <br>
          <br>
          {{Translated}}

          <br>
          <br>

          {{#Hint}}
          <span class="hint">
            <span class="hint-star">*</span> {{Hint}}
          </span>
          {{/Hint}}
        `,
      },
    ],
  });
};

const main = async () => {
  await createAnkiModelIfNotExists();

  try {
    const videoInfo = await getVideoInfo(args.url);
    console.log(`Got video info: ${videoInfo.title}`);
    const subtitles = await downloadAudioAndSubs(args.url);
    console.log("Downloaded audio and subtitles");

    if (!videoInfo.title) throw new Error("Could not retrieve video title");

    const notes = [];

    for (let i = 0; i < subtitles.ja.length; i++) {
      const percent = Math.floor(((i + 1) / subtitles.ja.length) * 100);

      // is there anyway to print this in the same line? removing the old one
      process.stdout.write(`Progress: ${percent}%\r`);

      const jaElement = subtitles.ja[i];

      try {
        const aiTranslation = await translateWithAi(jaElement.text);
        const soundBase64 = await cutAudio({
          fileId: subtitles.fileId,
          startTimeMs: jaElement.startMs,
          endTimeMs: jaElement.endMs,
        });

        notes.push({
          deckName: `${GROUP_NAME}::${videoInfo.title}`,
          modelName: MODEL_NAME,
          fields: {
            Japanese_Reading: jaElement.text,
            Translated: aiTranslation.parsed.translation,
            Furigana: aiTranslation.parsed.furigana,
            Hiragana: aiTranslation.parsed.hiragana,
          },
          tags: ["jp"],
          audio: [
            {
              data: `${soundBase64}`,
              filename: "iku.mp3",
              fields: ["Audio"],
            },
          ],
        });
      } catch (error) {
        console.log("Error creating note:", error);
      }
    }

    await callAnkiConnect("createDeck", { deck: `音楽::${videoInfo.title}` });

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      try {
        await callAnkiConnect("addNotes", {
          notes: [note],
        });
      } catch (error) {
        console.log("skipping card...", error);
      }
    }

    console.log("All done!");
  } catch (error) {
    console.error(error);
  }
};

main();
