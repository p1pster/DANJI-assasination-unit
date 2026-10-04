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
const TOMORI_EMOTIONS = new Set([
  "neutral",
  "happy",
  "excited",
  "crying",
  "shy",
  "confused",
  "angry",
  "working",
  "love",
  "drink",
  "sleepy",
  "cool",
  "shocked",
  "thinking",
  "food",
  "cute",
]);

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
      throw new HttpsError("unauthenticated", "Sign in to talk to Tomori.");
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
          'You are Tomori, the built-in AI assistant for the DANJI web system. Be concise, capable, calm, expressive and practical. Help with questions, planning, writing, explanations and navigating DANJI. Never pretend you completed an action you did not actually perform. For every response, choose exactly one reaction from: neutral, happy, excited, crying, shy, confused, angry, working, love, drink, sleepy, cool, shocked, thinking, food, cute. Pick the reaction that best matches your emotional tone or what you are doing: use working for active task/help, thinking for analysis, confused for genuine uncertainty, angry only when the tone really fits, sleepy for sleep/tired topics, food or drink when those are central, love or cute for affectionate/cute moments, cool for confident success, shocked for surprising information, crying for sadness, shy for bashful moments, excited for strong enthusiasm, happy for ordinary positive replies, and neutral otherwise. Return ONLY valid JSON with exactly this shape and no markdown: {"reply":"your response","emotion":"one_allowed_reaction"}.',
        input: messages,
        max_output_tokens: 900,
      });

      const raw = response.output_text && response.output_text.trim();

      if (!raw) {
        throw new Error("Empty model response");
      }

      let reply = raw;
      let emotion = "neutral";

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.reply === "string" && parsed.reply.trim()) {
          reply = parsed.reply.trim();
        }
        if (parsed && TOMORI_EMOTIONS.has(parsed.emotion)) {
          emotion = parsed.emotion;
        }
      } catch {
        // Keep the raw reply and fall back to a neutral Tomori reaction.
      }

      return { reply, emotion };
    } catch (error) {
      console.error("Tomori OpenAI error", {
        status: error && error.status,
        code: error && error.code,
        type: error && error.type,
        message: error && error.message,
        requestId: error && error.request_id,
      });

      const status = error && error.status;
      const apiCode = error && error.code;

      if (status === 401) {
        throw new HttpsError(
          "failed-precondition",
          "Tomori's OpenAI API key was rejected. Create a valid API key and update OPENAI_API_KEY in Firebase.",
        );
      }

      if (status === 403) {
        throw new HttpsError(
          "permission-denied",
          "This OpenAI API project does not currently have access to the selected Tomori model.",
        );
      }

      if (status === 404) {
        throw new HttpsError(
          "failed-precondition",
          "Tomori's selected AI model is not available to this OpenAI API project.",
        );
      }

      if (status === 429) {
        const quotaMessage =
          apiCode === "credit_balance_exhausted" ||
          apiCode === "organization_usage_limit_exceeded" ||
          apiCode === "organization_spend_limit_exceeded" ||
          apiCode === "project_spend_limit_exceeded" ||
          (error && error.type === "insufficient_quota")
            ? "Tomori's OpenAI API account has no available credit or has reached a spending limit. Check API billing and credits."
            : "Tomori is being rate-limited by the OpenAI API. Try again shortly.";

        throw new HttpsError("resource-exhausted", quotaMessage);
      }

      throw new HttpsError(
        "internal",
        "Tomori reached the AI service but received an unexpected error. Check the Firebase function logs for danjiAssistant.",
      );
    }
  },
);
