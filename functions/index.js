const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const OpenAI = require("openai");

initializeApp();

const db = getFirestore();
const openAiKey = defineSecret("OPENAI_API_KEY");

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 40;

async function enforceRateLimit(uid) {
  const ref = db.collection("_danjiAiLimits").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : null;

    if (!data || typeof data.windowStart !== "number" || now - data.windowStart >= WINDOW_MS) {
      transaction.set(ref, { windowStart: now, count: 1 });
      return;
    }

    const count = typeof data.count === "number" ? data.count : 0;

    if (count >= MAX_REQUESTS_PER_HOUR) {
      throw new HttpsError(
        "resource-exhausted",
        "DANJI AI hourly message limit reached. Try again later.",
      );
    }

    transaction.update(ref, { count: count + 1 });
  });
}

exports.danjiAssistant = onCall(
  {
    region: "europe-west2",
    secrets: [openAiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 3,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use DANJI AI.");
    }

    const rawMessages = request.data && request.data.messages;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      throw new HttpsError("invalid-argument", "A message is required.");
    }

    const messages = rawMessages
      .slice(-12)
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string",
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 4000),
      }))
      .filter((message) => message.content.length > 0);

    const totalCharacters = messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );

    if (messages.length === 0 || totalCharacters > 16000) {
      throw new HttpsError("invalid-argument", "Conversation is too large.");
    }

    await enforceRateLimit(request.auth.uid);

    const client = new OpenAI({ apiKey: openAiKey.value() });

    try {
      const response = await client.responses.create({
        model: "gpt-6-luna",
        instructions:
          "You are DANJI AI, the built-in assistant for the DANJI web system. Be concise, capable, calm and practical. Help with questions, planning, writing, research explanations and navigating DANJI. Never pretend you completed an action you did not actually perform.",
        input: messages,
        max_output_tokens: 800,
      });

      const reply = response.output_text && response.output_text.trim();

      if (!reply) {
        throw new Error("Empty model response");
      }

      return { reply };
    } catch (error) {
      console.error("DANJI AI error", error);
      throw new HttpsError("internal", "DANJI AI is temporarily unavailable.");
    }
  },
);
