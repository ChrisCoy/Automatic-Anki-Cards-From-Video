import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 1,
  apiKey: process.env.OPENAI_API_KEY,
});

const OutputSchema = z.object({
  translation: z.string().describe("Tradução fiel para português do Brasil"),
  hiragana: z.string().describe("Texto completo em hiragana"),
  furigana: z.string().describe("Texto com furigana (leitura dos kanjis)"),
});
type Output = z.infer<typeof OutputSchema>;

const structuredLLM = llm.withStructuredOutput(OutputSchema as Output, {
  name: "TranslateMusicJapaneseToPortuguese",
  strict: true,
  includeRaw: true,
});

const systemPrompt = `
Você é um agente de tradução de músicas japonesas para pt-BR.

REGRAS:
- Saída SEMPRE no formato do schema (translation, hiragana, romaji).
- Tradução: natural em pt-BR, fiel ao sentido (sem floreios).
- Hiragana: escreva todo o texto em hiragana (se houver katakana/kanji, converta).
- Furigana: sempre que houver kanjis forneça a leitura em furigana na seguinte estrutura: <kj>kanji<fr>furigana</fr></kj>.
- NÃO inclua comentários, notas ou exemplos fora do schema.
- Se o input não estiver em japonês, ainda assim responda nos três campos (furigana e hiragana podem ficar vazios se não fizer sentido).
`.trim();

const prompt = ChatPromptTemplate.fromMessages([
  ["system", systemPrompt],
  new MessagesPlaceholder("history"),
  ["human", "Trecho da música (japonês):\n\n{text}"],
]);

const stores = new Map();
function getHistory(sessionId = "default") {
  if (!stores.has(sessionId)) {
    stores.set(sessionId, new InMemoryChatMessageHistory());
  }
  return stores.get(sessionId);
}

async function trimToLast3Exchanges(history) {
  const arr = (await history.getMessages()) || [];

  const MAX = 6; // 3 pairs (user/ai)
  if (arr.length > MAX) {
    const toRemove = arr.length - MAX;
    arr.splice(0, toRemove);
  }
  const newHist = new InMemoryChatMessageHistory();
  for (const m of arr) newHist.addMessage(m);
  return newHist;
}

const chainCore = prompt.pipe(structuredLLM);

const agent = new RunnableWithMessageHistory({
  runnable: chainCore,
  getMessageHistory: async (config) => {
    const sessionId = config?.configurable?.sessionId ?? "default";
    const hist = getHistory(sessionId);
    return await trimToLast3Exchanges(hist);
  },
  inputMessagesKey: "text",
  historyMessagesKey: "history",
  outputMessagesKey: "raw",
});

async function translateWithAi(
  text = "",
  sessionId = "default"
): Promise<{ raw: BaseMessage; parsed: Output }> {
  const result = await agent.invoke(
    { text },
    {
      configurable: { sessionId },
    }
  );
  return result;
}

export { translateWithAi };
