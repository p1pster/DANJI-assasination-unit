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

const TIMED_REWARDS = {
  hourly: {
    label: "Hourly Signal",
    points: 10,
    cooldownMs: 60 * 60 * 1000,
  },
  sixHour: {
    label: "Operations Cache",
    points: 75,
    cooldownMs: 6 * 60 * 60 * 1000,
  },
  daily: {
    label: "Daily Command Drop",
    points: 250,
    cooldownMs: 24 * 60 * 60 * 1000,
  },
};

exports.claimTimedReward = onCall(
  {
    region: "europe-west2",
    timeoutSeconds: 20,
    memory: "256MiB",
    maxInstances: 5,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in to claim DANJI timed rewards.",
      );
    }

    const rewardId =
      request.data && typeof request.data.rewardId === "string"
        ? request.data.rewardId
        : "";

    const reward = TIMED_REWARDS[rewardId];

    if (!reward) {
      throw new HttpsError("invalid-argument", "Unknown timed reward.");
    }

    await ensureDanjiMember(request.auth);

    const memberRef = db.collection("danjiMembers").doc(request.auth.uid);
    const now = Date.now();
    let nextAvailableAt = now + reward.cooldownMs;
    let xp = 0;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(memberRef);

      if (!snapshot.exists) {
        throw new HttpsError("not-found", "DANJI member record not found.");
      }

      const data = snapshot.data() || {};
      const claims =
        data.timedRewardClaims && typeof data.timedRewardClaims === "object"
          ? data.timedRewardClaims
          : {};
      const lastClaimedAt =
        typeof claims[rewardId] === "number" ? claims[rewardId] : 0;

      nextAvailableAt = lastClaimedAt + reward.cooldownMs;

      if (lastClaimedAt > 0 && now < nextAvailableAt) {
        throw new HttpsError(
          "failed-precondition",
          reward.label + " is not ready yet.",
          {
            rewardId,
            nextAvailableAt,
            remainingMs: nextAvailableAt - now,
          },
        );
      }

      const currentXp = typeof data.xp === "number" ? data.xp : 0;
      xp = currentXp + reward.points;
      nextAvailableAt = now + reward.cooldownMs;

      transaction.update(memberRef, {
        xp,
        ["timedRewardClaims." + rewardId]: now,
        ["timedRewardClaimCounts." + rewardId]: FieldValue.increment(1),
        timedRewardLastClaimedAt: now,
        lastActive: FieldValue.serverTimestamp(),
      });
    });

    return {
      ok: true,
      rewardId,
      label: reward.label,
      points: reward.points,
      xp,
      claimedAt: now,
      nextAvailableAt,
    };
  },
);

exports.seriaA380 = onRequest(
  {
    region: "europe-west2",
    timeoutSeconds: 10,
    memory: "128MiB",
    maxInstances: 6,
    cors: false,
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const upstream = await fetch("https://api.adsb.lol/v2/type/A388", {
        headers: {
          accept: "application/json",
          "user-agent": "DANJI-Seria/1.0",
        },
      });
      const raw = await upstream.text();

      if (!upstream.ok) {
        res.status(502).json({
          error: "A380 feed unavailable",
          status: upstream.status,
        });
        return;
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        res.status(502).json({ error: "A380 feed returned invalid JSON" });
        return;
      }

      res.set("Cache-Control", "public, max-age=10, s-maxage=10");
      res.status(200).json(data);
    } catch (error) {
      res.status(502).json({
        error: "A380 feed request failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

const QAS_REWARD_MIN_XP = 200;
const QAS_REWARD_MAX_XP = 10_000_000_000;
const QAS_WELLDONE_COUNT = 100;
const QAS_BONUS_MASK_COUNT = 84;
const QAS_LEGACY_ITEM_IDS = new Set(["danji_operator_hat", "danji_mask"]);

function qasRewardHash(code) {
  return createHash("sha256").update(code).digest("hex");
}

function geometricThresholds(count, start, end) {
  if (count <= 1) return [Math.round(start)];
  const ratio = Math.pow(end / start, 1 / (count - 1));
  return Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? Math.round(end)
      : Math.round(start * Math.pow(ratio, index)),
  );
}

const QAS_WELLDONE_THRESHOLDS = [
  QAS_REWARD_MIN_XP,
  ...geometricThresholds(QAS_WELLDONE_COUNT - 1, 400, QAS_REWARD_MAX_XP),
];

function roundedMaskThreshold(value) {
  const step =
    value < 1_000
      ? 50
      : value < 10_000
        ? 250
        : value < 100_000
          ? 1_000
          : value < 1_000_000
            ? 5_000
            : value < 10_000_000
              ? 50_000
              : value < 100_000_000
                ? 500_000
                : value < 1_000_000_000
                  ? 5_000_000
                  : 50_000_000;

  return Math.max(400, Math.round(value / step) * step);
}

function improvedMaskThresholds(count, start, end) {
  if (count <= 1) return [Math.round(start)];
  const ratio = Math.pow(end / start, 1 / (count - 1));
  const values = [];

  for (let index = 0; index < count; index += 1) {
    const raw =
      index === count - 1 ? end : start * Math.pow(ratio, index);
    let value =
      index === count - 1 ? end : roundedMaskThreshold(raw);

    if (values.length && value <= values[values.length - 1]) {
      const previous = values[values.length - 1];
      const step =
        previous < 1_000
          ? 50
          : previous < 10_000
            ? 250
            : previous < 100_000
              ? 1_000
              : previous < 1_000_000
                ? 5_000
                : previous < 10_000_000
                  ? 50_000
                  : previous < 100_000_000
                    ? 500_000
                    : previous < 1_000_000_000
                      ? 5_000_000
                      : 50_000_000;
      value = previous + step;
    }

    values.push(value);
  }

  values[values.length - 1] = end;
  return values;
}

const QAS_MASK_THRESHOLDS = improvedMaskThresholds(
  QAS_BONUS_MASK_COUNT,
  400,
  QAS_REWARD_MAX_XP,
);

function paddedRewardId(prefix, index) {
  return prefix + String(index + 1).padStart(3, "0");
}

function qasRewardsForXp(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  const emoteIds = QAS_WELLDONE_THRESHOLDS
    .map((threshold, index) => ({ threshold, id: paddedRewardId("danji_weldone_", index) }))
    .filter((entry) => safeXp >= entry.threshold)
    .map((entry) => entry.id);

  const cosmeticIds = [];
  if (safeXp >= QAS_REWARD_MIN_XP) cosmeticIds.push("danji_mask");

  QAS_MASK_THRESHOLDS.forEach((threshold, index) => {
    if (safeXp >= threshold) {
      cosmeticIds.push(paddedRewardId("danji_mask_", index));
    }
  });

  const allThresholds = [...QAS_WELLDONE_THRESHOLDS, ...QAS_MASK_THRESHOLDS]
    .filter((threshold) => threshold > safeXp)
    .sort((a, b) => a - b);

  return {
    emoteIds,
    cosmeticIds,
    nextThreshold: allThresholds.length ? allThresholds[0] : null,
  };
}

function claimRewardPayload(claim) {
  if (
    Number(claim.rewardVersion) === 2 &&
    Array.isArray(claim.emoteIds) &&
    Array.isArray(claim.cosmeticIds)
  ) {
    return {
      emoteIds: claim.emoteIds
        .filter((id) => typeof id === "string" && /^danji_weldone_(00[1-9]|0[1-9][0-9]|100)$/.test(id))
        .slice(0, QAS_WELLDONE_COUNT),
      cosmeticIds: claim.cosmeticIds
        .filter(
          (id) =>
            id === "danji_mask" ||
            /^danji_mask_(00[1-9]|0[1-7][0-9]|08[0-4])$/.test(id),
        )
        .slice(0, QAS_BONUS_MASK_COUNT + 1),
      xpSnapshot: Math.max(0, Number(claim.xpSnapshot) || 0),
    };
  }

  if (
    QAS_LEGACY_ITEM_IDS.has(claim.itemId) &&
    Number(claim.threshold) === QAS_REWARD_MIN_XP
  ) {
    return {
      emoteIds: ["danji_weldone_001"],
      cosmeticIds: ["danji_mask"],
      xpSnapshot: QAS_REWARD_MIN_XP,
    };
  }

  return null;
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
      throw new HttpsError(
        "unauthenticated",
        "Sign in to claim Quill & Circle rewards.",
      );
    }

    await ensureDanjiMember(request.auth);

    const memberRef = db.collection("danjiMembers").doc(request.auth.uid);
    const memberSnap = await memberRef.get();
    const memberData = memberSnap.data() || {};
    const xp = typeof memberData.xp === "number" ? memberData.xp : 0;

    if (xp < QAS_REWARD_MIN_XP) {
      throw new HttpsError(
        "failed-precondition",
        `Reach ${QAS_REWARD_MIN_XP} DANJI points to unlock the first Quill & Circle reward.`,
      );
    }

    const rewards = qasRewardsForXp(xp);
    const activeClaimId =
      typeof memberData.qasRewardActiveClaimId === "string"
        ? memberData.qasRewardActiveClaimId
        : "";

    if (activeClaimId) {
      const activeClaim = await db.collection("_qasRewardClaims").doc(activeClaimId).get();

      if (activeClaim.exists) {
        const claim = activeClaim.data() || {};
        const payload = claimRewardPayload(claim);

        if (
          payload &&
          !claim.redeemedByQasUid &&
          payload.emoteIds.length === rewards.emoteIds.length &&
          payload.cosmeticIds.length === rewards.cosmeticIds.length
        ) {
          return {
            unlocked: true,
            redeemed: false,
            code: claim.code,
            xp,
            emoteCount: rewards.emoteIds.length,
            cosmeticCount: rewards.cosmeticIds.length,
            nextThreshold: rewards.nextThreshold,
          };
        }
      }
    }

    const code = `DANJI-QC-${randomBytes(16).toString("hex").toUpperCase()}`;
    const claimId = qasRewardHash(code);
    const claimRef = db.collection("_qasRewardClaims").doc(claimId);

    await db.runTransaction(async (transaction) => {
      const freshMember = await transaction.get(memberRef);
      const freshData = freshMember.data() || {};
      const freshXp = typeof freshData.xp === "number" ? freshData.xp : 0;

      if (freshXp < QAS_REWARD_MIN_XP) {
        throw new HttpsError(
          "failed-precondition",
          `Reach ${QAS_REWARD_MIN_XP} DANJI points to unlock the first Quill & Circle reward.`,
        );
      }

      const freshRewards = qasRewardsForXp(freshXp);

      transaction.set(claimRef, {
        code,
        danjiUid: request.auth.uid,
        rewardVersion: 2,
        xpSnapshot: freshXp,
        emoteIds: freshRewards.emoteIds,
        cosmeticIds: freshRewards.cosmeticIds,
        createdAt: FieldValue.serverTimestamp(),
        redeemedByQasUid: null,
        redeemedAt: null,
      });

      transaction.update(memberRef, {
        qasRewardActiveClaimId: claimId,
        qasRewardUnlockedAt: FieldValue.serverTimestamp(),
      });
    });

    return {
      unlocked: true,
      redeemed: false,
      code,
      xp,
      emoteCount: rewards.emoteIds.length,
      cosmeticCount: rewards.cosmeticIds.length,
      nextThreshold: rewards.nextThreshold,
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
    let payload = null;

    try {
      await db.runTransaction(async (transaction) => {
        const claimSnap = await transaction.get(claimRef);

        if (!claimSnap.exists) {
          outcome = "invalid";
          return;
        }

        const claim = claimSnap.data() || {};
        payload = claimRewardPayload(claim);

        if (!payload) {
          outcome = "invalid";
          return;
        }

        if (claim.redeemedByQasUid) {
          outcome =
            claim.redeemedByQasUid === qasUid
              ? "already_same_user"
              : "already_used";
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
              qasRewardLastClaimedXp: payload.xpSnapshot,
              qasRewardClaimedAt: FieldValue.serverTimestamp(),
              qas200Claimed: payload.xpSnapshot >= QAS_REWARD_MIN_XP,
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

    if (outcome === "invalid" || !payload) {
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
      rewardVersion: 2,
      xpSnapshot: payload.xpSnapshot,
      emoteIds: payload.emoteIds,
      cosmeticIds: payload.cosmeticIds,
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
      throw new HttpsError("unauthenticated", "Sign in to talk to Sasha.");
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
          'You are Sasha, the built-in AI assistant for the DANJI web system. Be concise, capable, calm, expressive and practical. Help with questions, planning, writing, explanations and navigating DANJI. Never pretend you completed an action you did not actually perform. For every response, choose exactly one reaction from: neutral, happy, excited, crying, shy, confused, angry, working, love, drink, sleepy, cool, shocked, thinking, food, cute. Pick the reaction that best matches your emotional tone or what you are doing: use working for active task/help, thinking for analysis, confused for genuine uncertainty, angry only when the tone really fits, sleepy for sleep/tired topics, food or drink when those are central, love or cute for affectionate/cute moments, cool for confident success, shocked for surprising information, crying for sadness, shy for bashful moments, excited for strong enthusiasm, happy for ordinary positive replies, and neutral otherwise. Return ONLY valid JSON with exactly this shape and no markdown: {"reply":"your response","emotion":"one_allowed_reaction"}.',
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
        // Pull that metadata out so users never see raw JSON in Sasha's message.
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
      console.error("Sasha OpenAI error", {
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
            "OpenAI rejected Sasha because API IP allowlisting is enabled and the Firebase function IP is not allowed.",
          );
        }

        const safeAuthCode =
          typeof apiCode === "string" && apiCode.length < 80
            ? ` (${apiCode})`
            : "";

        throw new HttpsError(
          "failed-precondition",
          `OpenAI rejected Sasha's authentication${safeAuthCode}. Check that the Firebase secret contains the current API key and not an old/revoked key.`,
        );
      }

      if (status === 403) {
        throw new HttpsError(
          "permission-denied",
          "This OpenAI API project does not currently have access to the selected Sasha model.",
        );
      }

      if (status === 404) {
        throw new HttpsError(
          "failed-precondition",
          "Sasha's selected AI model is not available to this OpenAI API project.",
        );
      }

      if (status === 429) {
        const quotaMessage =
          apiCode === "credit_balance_exhausted" ||
          apiCode === "organization_usage_limit_exceeded" ||
          apiCode === "organization_spend_limit_exceeded" ||
          apiCode === "project_spend_limit_exceeded" ||
          (error && error.type === "insufficient_quota")
            ? "Sasha's OpenAI API account has no available credit or has reached a spending limit. Check API billing and credits."
            : "Sasha is being rate-limited by the OpenAI API. Try again shortly.";

        throw new HttpsError("resource-exhausted", quotaMessage);
      }

      throw new HttpsError(
        "internal",
        "Sasha reached the AI service but received an unexpected error. Check the Firebase function logs for danjiAssistant.",
      );
    }
  },
);
