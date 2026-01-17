import ffmpeg from "fluent-ffmpeg";
import { callAnkiConnect } from "./call-anki-connect.ts";
import { downloadAudioAndSubs } from "./download-audio-and-subs.ts";
import { getVideoInfo } from "./get-video-info.ts";
import { translateWithAi } from "./translate-with-ai.ts";
import { args } from "./utils/args.ts";
import { projectRoot } from "./utils/find-project-root.ts";

const GROUP_NAME = "音楽";
const MODEL_NAME = `${GROUP_NAME}::Model`;

const validateOpenAiApiKey = (): void => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not defined. Please set the OPENAI_API_KEY environment variable in the .env file or system environment variables."
    );
  }

  if (!apiKey.startsWith("sk-")) {
    throw new Error(
      "OPENAI_API_KEY appears to be invalid. The OpenAI API key must start with 'sk-'."
    );
  }
};

const validateOpenAiCredits = async (): Promise<void> => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: "test"
          }
        ],
        max_tokens: 5
      }),
    });

    if (response.status === 401) {
      throw new Error(
        "OPENAI_API_KEY is invalid or expired. Please check your API key."
      );
    }

    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error?.code === "insufficient_quota") {
        throw new Error(
          "No credits available in OpenAI account. Please add credits at https://platform.openai.com/account/billing"
        );
      }
      throw new Error(
        "Rate limit exceeded. Please check your credits at https://platform.openai.com/account/billing"
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error checking OpenAI credits: ${response.status} - ${errorText}`
      );
    }

    console.log("OPENAI_API_KEY validated and credits available");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("insufficient_quota") || error.message.includes("No credits")) {
        throw error;
      }
      if (error.message.includes("fetch")) {
        throw new Error(
          "Connection error while checking OpenAI credits. Please check your internet connection."
        );
      }
    }
    throw error;
  }
};

type CutAudioInput = {
  fileId: string;
  startTimeMs: number;
  endTimeMs: number;
};
const cutAudio = async (input: CutAudioInput, paddingMs: number = 200): Promise<string> => {
  const { fileId, startTimeMs, endTimeMs } = input;
  return new Promise((resolve, reject) => {
    const outputBuffer = [];

    const paddedStartTime = Math.max(0, startTimeMs - paddingMs);
    const paddedEndTime = endTimeMs + paddingMs;

    ffmpeg(`${projectRoot}/content/${fileId}.mp3`)
      .setStartTime(paddedStartTime / 1000)
      .setDuration((paddedEndTime - paddedStartTime) / 1000)
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
          white-space: pre-line;
          display: flex;
          justify-content: center;
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
  console.log("Validating OPENAI_API_KEY...");
  validateOpenAiApiKey();
  await validateOpenAiCredits();

  

  await createAnkiModelIfNotExists();

  try {
    const videoInfo = await getVideoInfo(args.url);
    console.log(`Got video info: ${videoInfo.title}`);
    const subtitles = await downloadAudioAndSubs(args.url);
    console.log("Downloaded audio and subtitles");

    if (!videoInfo.title) throw new Error("Could not retrieve video title");

    const groupSize = args.groupSize || 1;
    const audioPadding = args.audioPadding || 200;
    const totalGroups = Math.ceil(subtitles.ja.length / groupSize);

    const notes = [];

    for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
      const startIndex = groupIndex * groupSize;
      const endIndex = Math.min(startIndex + groupSize, subtitles.ja.length);
      const group = subtitles.ja.slice(startIndex, endIndex);

      const percent = Math.floor(((groupIndex + 1) / totalGroups) * 100);
      process.stdout.write(`Progress: ${percent}%\r`);

      try {
        const translations = [];
        const furiganas = [];
        const hiraganas = [];

        for (const jaElement of group) {
          const aiTranslation = await translateWithAi(jaElement.text);
          translations.push(aiTranslation.parsed.translation);
          furiganas.push(aiTranslation.parsed.furigana);
          hiraganas.push(aiTranslation.parsed.hiragana);
        }

        const combinedJapanese = group.map(item => item.text).join("\n");
        const combinedTranslation = translations.join("\n");
        const combinedFurigana = furiganas.join("\n");
        const combinedHiragana = hiraganas.join("\n");

        const firstElement = group[0];
        const lastElement = group[group.length - 1];
        const soundBase64 = await cutAudio({
          fileId: subtitles.fileId,
          startTimeMs: firstElement.startMs,
          endTimeMs: lastElement.endMs,
        }, audioPadding);

        notes.push({
          deckName: `${GROUP_NAME}::${videoInfo.title}`,
          modelName: MODEL_NAME,
          fields: {
            Japanese_Reading: combinedJapanese,
            Translated: combinedTranslation,
            Furigana: combinedFurigana,
            Hiragana: combinedHiragana,
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
