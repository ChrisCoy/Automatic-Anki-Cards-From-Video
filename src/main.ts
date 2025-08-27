import ffmpeg from "fluent-ffmpeg";
import { callAnkiConnect } from "./call-anki-connect.ts";
import { downloadAudioAndSubs } from "./download-audio-and-subs.ts";
import { getVideoInfo } from "./get-video-info.ts";
import { translateWithAi } from "./translate-with-ai.ts";
import { args } from "./utils/args.ts";
import { projectRoot } from "./utils/find-project-root.ts";

const modelName = "音楽::Model";

const cutAudio = async (fileId: string, startTimeMs: number, endTimeMs: number) => {
  return new Promise((resolve, reject) => {
    const outputBuffer = [];

    ffmpeg(`${projectRoot}/content/${fileId}.mp3`)
      .setStartTime((startTimeMs - 200) / 1000)  // Ms to Seconds
      .setDuration((endTimeMs - startTimeMs + 200) / 1000)    // Ms to Seconds
      .format('mp3')
      .on('error', (err) => {
        reject('Error trying to cut the audio: ' + err.message);
      })
      .on('end', () => {
        const base64Audio = Buffer.concat(outputBuffer).toString('base64');
        resolve(base64Audio);
      })
      .pipe()
      .on('data', (chunk) => {
        outputBuffer.push(chunk);
      });
  });
};

const createAnkiModelIfNotExists = async () => {
  const result = await callAnkiConnect("modelNames");

  if (result.includes(modelName)) {
    return;
  }

  await callAnkiConnect("createModel", {
    modelName: modelName,
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
        Name: modelName,
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
    const subtitles = await downloadAudioAndSubs(args.url);

    console.log(subtitles);

    if (!videoInfo.title) throw new Error("Could not retrieve video title");

    await callAnkiConnect("createDeck", { deck: `音楽::${videoInfo.title}` });

    for (let i = 0; i < subtitles.ja.length; i++) {
      const jaElement = subtitles.ja[i];

      
      try {
        const aiTranslation = await translateWithAi(jaElement.text);
        const soundBase64 = await cutAudio(subtitles.fileId, jaElement.startMs, jaElement.endMs);
        await callAnkiConnect("addNotes", {
          notes: [
            {
              deckName: `音楽::${videoInfo.title}`,
              modelName: modelName,
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
            },
          ],
        });

      } catch (error) {
        console.log("skipping card...", error);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

main();
