const { initializeApp } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { createHash, randomBytes } = require("node:crypto");
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

function memberIdentity(auth) {
  const token = (auth && auth.token) || {};
  const fallbackName =
    typeof token.email === "string" && token.email.includes("@")
      ? token.email.split("@")[0]
      : "DANJI Member";

  return {
    displayName:
      typeof token.name === "string" && token.name.trim()
        ? token.name.trim().slice(0, 60)
        : fallbackName.slice(0, 60),
    photoURL:
      typeof token.picture === "string" && token.picture.startsWith("http")
        ? token.picture.slice(0, 500)
        : "",
  };
}

function signInProvider(auth) {
  const firebaseToken = auth && auth.token && auth.token.firebase;
  return firebaseToken && typeof firebaseToken.sign_in_provider === "string"
    ? firebaseToken.sign_in_provider
    : "";
}

async function ensureDanjiMember(auth) {
  const ref = db.collection("danjiMembers").doc(auth.uid);
  const identity = memberIdentity(auth);
  const currentProvider = signInProvider(auth);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      transaction.set(ref, {
        uid: auth.uid,
        ...identity,
        xp: 125,
        tomoriMessages: 0,
        signupBonusAwarded: true,
        rewardedProviders: currentProvider ? [currentProvider] : [],
        joinedAt: FieldValue.serverTimestamp(),
        lastActive: FieldValue.serverTimestamp(),
      });
      return;
    }

    const data = snapshot.data() || {};
    const existingRewarded = Array.isArray(data.rewardedProviders)
      ? data.rewardedProviders.filter((value) => typeof value === "string")
      : [];

    const rewardedProviders =
      currentProvider && existingRewarded.length === 0
        ? [currentProvider]
        : existingRewarded;

    const signupBonusAwarded = data.signupBonusAwarded === true;
    const currentXp = typeof data.xp === "number" ? data.xp : 100;

    transaction.update(ref, {
      ...identity,
      xp: signupBonusAwarded ? currentXp : currentXp + 25,
      signupBonusAwarded: true,
      rewardedProviders,
      lastActive: FieldValue.serverTimestamp(),
    });
  });
}

async function awardTomoriXp(auth) {
  const ref = db.collection("danjiMembers").doc(auth.uid);
  const identity = memberIdentity(auth);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      transaction.set(ref, {
        uid: auth.uid,
        ...identity,
        xp: 130,
        tomoriMessages: 1,
        signupBonusAwarded: true,
        rewardedProviders: signInProvider(auth) ? [signInProvider(auth)] : [],
        joinedAt: FieldValue.serverTimestamp(),
        lastActive: FieldValue.serverTimestamp(),
      });
      return;
    }

    const data = snapshot.data() || {};
    const baseXp = typeof data.xp === "number" ? data.xp : 100;
    const signupBonusAwarded = data.signupBonusAwarded === true;
    const xp = signupBonusAwarded ? baseXp : baseXp + 25;
    const tomoriMessages =
      typeof data.tomoriMessages === "number" ? data.tomoriMessages : 0;

    transaction.update(ref, {
      ...identity,
      xp: xp + 5,
      signupBonusAwarded: true,
      tomoriMessages: tomoriMessages + 1,
      lastActive: FieldValue.serverTimestamp(),
    });
  });
}

exports.registerDanjiMember = onCall(
  {
    region: "europe-west2",
    timeoutSeconds: 20,
    memory: "256MiB",
    maxInstances: 3,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to become a DANJI member.");
    }

    await ensureDanjiMember(request.auth);
    return { ok: true };
  },
);


exports.awardLinkedProvider = onCall(
  {
    region: "europe-west2",
    timeoutSeconds: 20,
    memory: "256MiB",
    maxInstances: 3,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before linking an account.");
    }

    const providerId =
      request.data && typeof request.data.providerId === "string"
        ? request.data.providerId.trim().slice(0, 80)
        : "";

    const allowedProviders = new Set([
      "password",
      "phone",
      "google.com",
      "facebook.com",
      "github.com",
      "yahoo.com",
      "microsoft.com",
      "apple.com",
    ]);

    if (!allowedProviders.has(providerId)) {
      throw new HttpsError("invalid-argument", "Unsupported DANJI sign-in provider.");
    }

    const userRecord = await getAdminAuth().getUser(request.auth.uid);
    const verifiedProviders = new Set(
      userRecord.providerData
        .map((provider) => provider.providerId)
        .filter((value) => typeof value === "string"),
    );

    if (userRecord.phoneNumber) verifiedProviders.add("phone");
    if (userRecord.email) {
      const passwordProvider = userRecord.providerData.some(
        (provider) => provider.providerId === "password",
      );
      if (passwordProvider) verifiedProviders.add("password");
    }

    if (!verifiedProviders.has(providerId)) {
      throw new HttpsError(
        "failed-precondition",
        "That sign-in method is not linked to this DANJI account yet.",
      );
    }

    const ref = db.collection("danjiMembers").doc(request.auth.uid);
    let awarded = false;
    let xp = 100;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const identity = memberIdentity(request.auth);

      if (!snapshot.exists) {
        const initialProvider = signInProvider(request.auth);
        const isAdditionalProvider =
          initialProvider && initialProvider !== providerId;
        const rewardedProviders = Array.from(
          new Set([initialProvider, providerId].filter(Boolean)),
        );

        xp = isAdditionalProvider ? 150 : 125;
        awarded = isAdditionalProvider;

        transaction.set(ref, {
          uid: request.auth.uid,
          ...identity,
          xp,
          tomoriMessages: 0,
          signupBonusAwarded: true,
          rewardedProviders,
          joinedAt: FieldValue.serverTimestamp(),
          lastActive: FieldValue.serverTimestamp(),
        });
        return;
      }

      const data = snapshot.data() || {};
      const storedXp = typeof data.xp === "number" ? data.xp : 100;
      const signupBonusAwarded = data.signupBonusAwarded === true;
      const currentXp = signupBonusAwarded ? storedXp : storedXp + 25;
      const rewardedProviders = Array.isArray(data.rewardedProviders)
        ? data.rewardedProviders.filter((value) => typeof value === "string")
        : [];

      if (rewardedProviders.includes(providerId)) {
        xp = currentXp;
        transaction.update(ref, {
          ...identity,
          xp,
          signupBonusAwarded: true,
          lastActive: FieldValue.serverTimestamp(),
        });
        return;
      }

      xp = currentXp + 25;
      awarded = true;

      transaction.update(ref, {
        ...identity,
        xp,
        signupBonusAwarded: true,
        rewardedProviders: [...rewardedProviders, providerId],
        lastActive: FieldValue.serverTimestamp(),
      });
    });

    return { awarded, points: awarded ? 25 : 0, xp };
  },
);

const QAS_200_REWARD = {
  threshold: 200,
  itemId: "danji_operator_hat",
  itemName: "DANJI Operator Hat",
};

function qasRewardHash(code) {
  return createHash("sha256").update(code).digest("hex");
}

exports.getQasRewardCode = onCall(
  {
    region: "europe-west2",
    timeoutSeconds: 20,
    memory: "256MiB",
    maxInstances: 3,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to claim the Quill & Circle reward.");
    }

    await ensureDanjiMember(request.auth);

    const memberRef = db.collection("danjiMembers").doc(request.auth.uid);
    const initialMember = await memberRef.get();
    const initialData = initialMember.data() || {};
    const xp = typeof initialData.xp === "number" ? initialData.xp : 0;

    if (xp < QAS_200_REWARD.threshold) {
      throw new HttpsError(
        "failed-precondition",
        `Reach ${QAS_200_REWARD.threshold} DANJI XP to unlock this Quill & Circle item.`,
      );
    }

    const existingClaimId =
      typeof initialData.qas200RewardClaimId === "string"
        ? initialData.qas200RewardClaimId
        : "";

    if (existingClaimId) {
      const existingClaim = await db.collection("_qasRewardClaims").doc(existingClaimId).get();
      if (existingClaim.exists) {
        const claim = existingClaim.data() || {};
        return {
          unlocked: true,
          redeemed: Boolean(claim.redeemedByQasUid),
          code: claim.redeemedByQasUid ? null : claim.code,
          itemId: QAS_200_REWARD.itemId,
          itemName: QAS_200_REWARD.itemName,
        };
      }
    }

    const code = `DANJI-QC-${randomBytes(16).toString("hex").toUpperCase()}`;
    const claimId = qasRewardHash(code);
    const claimRef = db.collection("_qasRewardClaims").doc(claimId);

    await db.runTransaction(async (transaction) => {
      const memberSnap = await transaction.get(memberRef);
      const memberData = memberSnap.data() || {};
      const memberXp = typeof memberData.xp === "number" ? memberData.xp : 0;

      if (memberXp < QAS_200_REWARD.threshold) {
        throw new HttpsError(
          "failed-precondition",
          `Reach ${QAS_200_REWARD.threshold} DANJI XP to unlock this Quill & Circle item.`,
        );
      }

      if (
        typeof memberData.qas200RewardClaimId === "string" &&
        memberData.qas200RewardClaimId
      ) {
        return;
      }

      transaction.set(claimRef, {
        code,
        danjiUid: request.auth.uid,
        threshold: QAS_200_REWARD.threshold,
        itemId: QAS_200_REWARD.itemId,
        itemName: QAS_200_REWARD.itemName,
        createdAt: FieldValue.serverTimestamp(),
        redeemedByQasUid: null,
        redeemedAt: null,
      });

      transaction.update(memberRef, {
        qas200RewardClaimId: claimId,
        qas200Unlocked: true,
      });
    });

    const refreshed = await memberRef.get();
    const refreshedClaimId =
      typeof refreshed.data()?.qas200RewardClaimId === "string"
        ? refreshed.data().qas200RewardClaimId
        : claimId;
    const finalClaim = await db.collection("_qasRewardClaims").doc(refreshedClaimId).get();
    const finalData = finalClaim.data() || {};

    return {
      unlocked: true,
      redeemed: Boolean(finalData.redeemedByQasUid),
      code: finalData.redeemedByQasUid ? null : finalData.code,
      itemId: QAS_200_REWARD.itemId,
      itemName: QAS_200_REWARD.itemName,
    };
  },
);

exports.consumeQasReward = onRequest(
  {
    region: "europe-west2",
    timeoutSeconds: 20,
    memory: "256MiB",
    maxInstances: 5,
    cors: false,
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store");

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const code =
      req.body && typeof req.body.code === "string"
        ? req.body.code.trim().toUpperCase()
        : "";
    const qasUid =
      req.body && typeof req.body.qasUid === "string"
        ? req.body.qasUid.trim().slice(0, 128)
        : "";

    if (!/^DANJI-QC-[A-F0-9]{32}$/.test(code) || !qasUid) {
      res.status(400).json({ ok: false, error: "invalid_claim" });
      return;
    }

    const claimId = qasRewardHash(code);
    const claimRef = db.collection("_qasRewardClaims").doc(claimId);
    let outcome = "invalid";

    try {
      await db.runTransaction(async (transaction) => {
        const claimSnap = await transaction.get(claimRef);

        if (!claimSnap.exists) {
          outcome = "invalid";
          return;
        }

        const claim = claimSnap.data() || {};

        if (
          claim.itemId !== QAS_200_REWARD.itemId ||
          Number(claim.threshold) !== QAS_200_REWARD.threshold
        ) {
          outcome = "invalid";
          return;
        }

        if (claim.redeemedByQasUid) {
          outcome = claim.redeemedByQasUid === qasUid ? "already_same_user" : "already_used";
          return;
        }

        outcome = "redeemed";
        transaction.update(claimRef, {
          redeemedByQasUid: qasUid,
          redeemedAt: FieldValue.serverTimestamp(),
        });

        if (typeof claim.danjiUid === "string" && claim.danjiUid) {
          transaction.set(
            db.collection("danjiMembers").doc(claim.danjiUid),
            {
              qas200Claimed: true,
              qas200ClaimedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      });
    } catch (error) {
      console.error("DANJI QAS reward redemption failed", error);
      res.status(500).json({ ok: false, error: "redemption_failed" });
      return;
    }

    if (outcome === "invalid") {
      res.status(404).json({ ok: false, error: "invalid_claim" });
      return;
    }

    if (outcome === "already_used") {
      res.status(409).json({ ok: false, error: "already_redeemed" });
      return;
    }

    res.status(200).json({
      ok: true,
      alreadyRedeemed: outcome === "already_same_user",
      itemId: QAS_200_REWARD.itemId,
      itemName: QAS_200_REWARD.itemName,
    });
  },
);

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

    let apiKey = openAiKey.value().trim();

    // Be forgiving if the secret was pasted with quotes or a Bearer prefix.
    apiKey = apiKey
      .replace(/^Bearer\s+/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!apiKey.startsWith("sk-")) {
      throw new HttpsError(
        "failed-precondition",
        "OPENAI_API_KEY is not in a valid OpenAI API key format. Create a key at the OpenAI API key page and save only the key value in Firebase.",
      );
    }

    const client = new OpenAI({ apiKey });

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

      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed.reply === "string" && parsed.reply.trim()) {
          reply = parsed.reply.trim();
        }
        if (parsed && TOMORI_EMOTIONS.has(parsed.emotion)) {
          emotion = parsed.emotion;
        }
      } catch {
        // Some models may append the emotion object after a normal reply.
        // Pull that metadata out so users never see raw JSON in Tomori's message.
        const emotionObjectMatch = cleaned.match(
          /\{\s*"emotion"\s*:\s*"([^"]+)"\s*\}\s*$/,
        );

        if (emotionObjectMatch) {
          const candidateEmotion = emotionObjectMatch[1];

          if (TOMORI_EMOTIONS.has(candidateEmotion)) {
            emotion = candidateEmotion;
          }

          const withoutMetadata = cleaned
            .slice(0, emotionObjectMatch.index)
            .trim();

          if (withoutMetadata) {
            reply = withoutMetadata;
          }
        } else {
          reply = cleaned;
        }
      }

      try {
        await awardTomoriXp(request.auth);
      } catch (leaderboardError) {
        console.error("DANJI leaderboard XP update failed", leaderboardError);
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
        if (apiCode === "ip_not_authorized" || (error && error.type === "ip_not_authorized")) {
          throw new HttpsError(
            "permission-denied",
            "OpenAI rejected Tomori because API IP allowlisting is enabled and the Firebase function IP is not allowed.",
          );
        }

        const safeAuthCode =
          typeof apiCode === "string" && apiCode.length < 80
            ? ` (${apiCode})`
            : "";

        throw new HttpsError(
          "failed-precondition",
          `OpenAI rejected Tomori's authentication${safeAuthCode}. Check that the Firebase secret contains the current API key and not an old/revoked key.`,
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
