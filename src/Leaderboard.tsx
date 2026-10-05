import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'

type LeaderboardEntry = {
  uid: string
  displayName: string
  photoURL: string
  xp: number
  tomoriMessages: number
}

type LeaderboardProps = {
  currentUid?: string | null
  onJoin: () => void
}

type TimedRewardId = 'hourly' | 'sixHour' | 'daily'

type TimedRewardDefinition = {
  id: TimedRewardId
  label: string
  description: string
  points: number
  cooldownMs: number
}

const TIMED_REWARDS: TimedRewardDefinition[] = [
  {
    id: 'hourly',
    label: 'Hourly Signal',
    description: 'A small leaderboard boost every hour.',
    points: 10,
    cooldownMs: 60 * 60 * 1000,
  },
  {
    id: 'sixHour',
    label: 'Operations Cache',
    description: 'A larger cache that refreshes every six hours.',
    points: 75,
    cooldownMs: 6 * 60 * 60 * 1000,
  },
  {
    id: 'daily',
    label: 'Daily Command Drop',
    description: 'The main daily DANJI leaderboard reward.',
    points: 250,
    cooldownMs: 24 * 60 * 60 * 1000,
  },
]

const formatCountdown = (milliseconds: number) => {
  if (milliseconds <= 0) return 'READY'

  const totalSeconds = Math.ceil(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const rankTitle = (xp: number) => {
  if (xp >= 1000) return 'ELITE'
  if (xp >= 500) return 'SPECIALIST'
  if (xp >= 200) return 'OPERATOR'
  return 'RECRUIT'
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'D'

const geometricThresholds = (count: number, start: number, end: number) => {
  if (count <= 1) return [Math.round(start)]
  const ratio = Math.pow(end / start, 1 / (count - 1))
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? Math.round(end) : Math.round(start * Math.pow(ratio, index)),
  )
}

const WELLDONE_THRESHOLDS = [
  200,
  ...geometricThresholds(99, 400, 10_000_000_000),
]
const MASK_THRESHOLDS = geometricThresholds(84, 400, 10_000_000_000)

const rewardCountsForXp = (xp: number) => ({
  emotes: WELLDONE_THRESHOLDS.filter((threshold) => xp >= threshold).length,
  masks: (xp >= 200 ? 1 : 0) + MASK_THRESHOLDS.filter((threshold) => xp >= threshold).length,
})

const nextRewardThreshold = (xp: number) =>
  [...WELLDONE_THRESHOLDS, ...MASK_THRESHOLDS]
    .filter((threshold) => threshold > xp)
    .sort((a, b) => a - b)[0] ?? null

const toEntry = (id: string, data: DocumentData): LeaderboardEntry => ({
  uid: id,
  displayName:
    typeof data.displayName === 'string' && data.displayName.trim()
      ? data.displayName.trim()
      : 'DANJI Member',
  photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
  xp: typeof data.xp === 'number' ? data.xp : 0,
  tomoriMessages: typeof data.tomoriMessages === 'number' ? data.tomoriMessages : 0,
})

function Leaderboard({ currentUid, onJoin }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentXp, setCurrentXp] = useState(0)
  const [rewardCode, setRewardCode] = useState('')
  const [lastClaimedXp, setLastClaimedXp] = useState(0)
  const [rewardBusy, setRewardBusy] = useState(false)
  const [rewardError, setRewardError] = useState('')
  const [rewardCopied, setRewardCopied] = useState(false)
  const [timedClaims, setTimedClaims] = useState<Record<string, number>>({})
  const [claimingTimedReward, setClaimingTimedReward] = useState<TimedRewardId | null>(null)
  const [timedRewardMessage, setTimedRewardMessage] = useState('')
  const [timedRewardError, setTimedRewardError] = useState('')
  const [clockNow, setClockNow] = useState(Date.now())

  useEffect(() => {
    const leaderboardQuery = query(
      collection(db, 'danjiMembers'),
      orderBy('xp', 'desc'),
      limit(50),
    )

    return onSnapshot(
      leaderboardQuery,
      (snapshot) => {
        setEntries(snapshot.docs.map((doc) => toEntry(doc.id, doc.data())))
        setLoading(false)
        setError('')
      },
      (snapshotError) => {
        console.error(snapshotError)
        setLoading(false)
        setError('The DANJI leaderboard could not load.')
      },
    )
  }, [])

  useEffect(() => {
    if (!currentUid) {
      setCurrentXp(0)
      setRewardCode('')
      setLastClaimedXp(0)
      setTimedClaims({})
      return
    }

    return onSnapshot(doc(db, 'danjiMembers', currentUid), (snapshot) => {
      const data = snapshot.data()
      setCurrentXp(typeof data?.xp === 'number' ? data.xp : 0)
      setLastClaimedXp(
        typeof data?.qasRewardLastClaimedXp === 'number'
          ? data.qasRewardLastClaimedXp
          : data?.qas200Claimed === true
            ? 200
            : 0,
      )

      const claims =
        data?.timedRewardClaims && typeof data.timedRewardClaims === 'object'
          ? data.timedRewardClaims as Record<string, unknown>
          : {}

      setTimedClaims(
        Object.fromEntries(
          Object.entries(claims).filter((entry): entry is [string, number] =>
            typeof entry[1] === 'number',
          ),
        ),
      )
    })
  }, [currentUid])

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const claimTimedReward = async (reward: TimedRewardDefinition) => {
    if (!currentUid || claimingTimedReward) return

    setClaimingTimedReward(reward.id)
    setTimedRewardMessage('')
    setTimedRewardError('')

    try {
      const claim = httpsCallable<
        { rewardId: TimedRewardId },
        {
          ok: boolean
          rewardId: TimedRewardId
          label: string
          points: number
          xp: number
          claimedAt: number
          nextAvailableAt: number
        }
      >(functions, 'claimTimedReward')

      const result = await claim({ rewardId: reward.id })

      setTimedClaims((current) => ({
        ...current,
        [reward.id]: result.data.claimedAt,
      }))
      setCurrentXp(result.data.xp)
      setTimedRewardMessage(
        `${result.data.label} claimed: +${result.data.points} leaderboard XP.`,
      )
    } catch (claimError) {
      const message =
        typeof claimError === 'object' && claimError !== null && 'message' in claimError
          ? String((claimError as { message?: unknown }).message || '')
          : ''

      setTimedRewardError(
        message.replace(/^FirebaseError:\s*/i, '') ||
          'The timed reward could not be claimed.',
      )
    } finally {
      setClaimingTimedReward(null)
    }
  }

  const getQasReward = async () => {
    setRewardBusy(true)
    setRewardError('')

    try {
      const claim = httpsCallable<
        Record<string, never>,
        {
          unlocked: boolean
          redeemed: boolean
          code: string | null
          xp: number
          emoteCount: number
          cosmeticCount: number
          nextThreshold: number | null
        }
      >(functions, 'getQasRewardCode')

      const result = await claim({})
      setRewardCode(result.data.code || '')
      setRewardCopied(false)
    } catch (claimError) {
      const message =
        typeof claimError === 'object' && claimError !== null && 'message' in claimError
          ? String((claimError as { message?: unknown }).message || '')
          : ''
      setRewardError(
        message.replace(/^FirebaseError:\s*/i, '') ||
          'The Quill & Circle reward code could not be created.',
      )
    } finally {
      setRewardBusy(false)
    }
  }

  const currentRank = useMemo(
    () => entries.findIndex((entry) => entry.uid === currentUid) + 1,
    [currentUid, entries],
  )

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <section className="leaderboard-page">
      <div className="leaderboard-wrap">
        <div className="eyebrow">
          <span>04</span>
          DANJI LEADERBOARD
        </div>

        <div className="leaderboard-heading">
          <div>
            <p className="kicker">NETWORK RANKINGS // LIVE</p>
            <h1>Leaderboard.</h1>
            <p>
              First login awards 100 XP, creating the DANJI membership adds 25 XP,
              linked sign-in methods add 25 XP each, and successful Tomori replies
              currently award 5 XP.
            </p>
          </div>

          <div className="leaderboard-summary">
            <span>ACTIVE BOARD</span>
            <strong>{entries.length}</strong>
            <small>TOP MEMBERS LOADED</small>
          </div>
        </div>

        {!currentUid && (
          <div className="leaderboard-join">
            <div>
              <span className="card-label">MEMBER ACCESS</span>
              <strong>Join DANJI to enter the rankings.</strong>
              <p>Your leaderboard profile is created automatically when you become a member.</p>
            </div>
            <button type="button" onClick={onJoin}>
              BECOME DANJI MEMBER
              <span>↗</span>
            </button>
          </div>
        )}

        {currentUid && currentRank > 0 && (
          <div className="leaderboard-you">
            <span>YOUR CURRENT POSITION</span>
            <strong>#{currentRank}</strong>
            <small>{entries[currentRank - 1]?.xp ?? 0} XP</small>
          </div>
        )}

        {currentUid && (
          <section className="timed-rewards">
            <div className="timed-rewards-heading">
              <div>
                <span className="card-label">TIMED LEADERBOARD REWARDS</span>
                <h2>Claim points as the timers reset.</h2>
                <p>
                  Timers are enforced by the DANJI server, so changing the clock on a
                  device cannot bypass the cooldown.
                </p>
              </div>
              <span className="timed-rewards-live">LIVE REWARDS</span>
            </div>

            <div className="timed-reward-grid">
              {TIMED_REWARDS.map((reward) => {
                const lastClaimedAt = timedClaims[reward.id] || 0
                const nextAvailableAt = lastClaimedAt + reward.cooldownMs
                const remaining = lastClaimedAt > 0 ? nextAvailableAt - clockNow : 0
                const ready = remaining <= 0
                const claiming = claimingTimedReward === reward.id

                return (
                  <article
                    className={ready ? 'timed-reward-card ready' : 'timed-reward-card'}
                    key={reward.id}
                  >
                    <div className="timed-reward-top">
                      <span>{reward.label}</span>
                      <strong>+{reward.points} XP</strong>
                    </div>
                    <p>{reward.description}</p>
                    <div className="timed-reward-countdown">
                      <small>{ready ? 'AVAILABLE NOW' : 'NEXT CLAIM'}</small>
                      <b>{formatCountdown(remaining)}</b>
                    </div>
                    <button
                      type="button"
                      onClick={() => void claimTimedReward(reward)}
                      disabled={!ready || Boolean(claimingTimedReward)}
                    >
                      {claiming ? 'CLAIMING…' : ready ? 'CLAIM REWARD' : 'LOCKED'}
                    </button>
                  </article>
                )
              })}
            </div>

            {(timedRewardMessage || timedRewardError) && (
              <div className={timedRewardError ? 'timed-reward-feedback error' : 'timed-reward-feedback success'}>
                {timedRewardError || timedRewardMessage}
              </div>
            )}
          </section>
        )}

        {currentUid && (() => {
          const rewards = rewardCountsForXp(currentXp)
          const claimed = rewardCountsForXp(lastClaimedXp)
          const nextThreshold = nextRewardThreshold(currentXp)
          const fullySynced =
            rewards.emotes === claimed.emotes &&
            rewards.masks === claimed.masks &&
            rewards.emotes > 0

          return (
            <section className={currentXp >= 200 ? 'crossgame-reward unlocked' : 'crossgame-reward'}>
              <div className="crossgame-reward-copy">
                <img className="crossgame-reward-mask" src="/assets/danji-mask.webp" alt="DANJI Mask" />
                <span className="card-label">QUILL & CIRCLE REWARD TRACK</span>
                <strong>Weldone Collection</strong>
                <p>
                  Your DANJI score now unlocks 100 ordered Weldone emotes and a collection
                  of mask cosmetics in Quill & Circle. Rewards begin at 200 points and the
                  final prestige rewards sit at 10,000,000,000 points.
                </p>
                <div className="crossgame-reward-totals">
                  <span><b>{rewards.emotes}</b> / 100 EMOTES</span>
                  <span><b>{rewards.masks}</b> / 85 MASKS</span>
                </div>
                {nextThreshold ? (
                  <small className="crossgame-next">
                    NEXT REWARD // {nextThreshold.toLocaleString()} POINTS
                  </small>
                ) : (
                  <small className="crossgame-next complete">ALL REWARDS UNLOCKED</small>
                )}
              </div>

              <div className="crossgame-reward-action">
                {currentXp >= 200 ? (
                  <>
                    {fullySynced && !rewardCode && (
                      <span className="crossgame-claimed">CURRENT REWARDS SYNCED ✓</span>
                    )}
                    <button type="button" onClick={getQasReward} disabled={rewardBusy}>
                      {rewardBusy
                        ? 'CREATING CODE…'
                        : rewardCode
                          ? 'REFRESH CLAIM CODE'
                          : fullySynced
                            ? 'CREATE RESTORE CODE'
                            : 'GET LATEST Q&C REWARDS'}
                    </button>
                    {rewardCode && (
                      <div className="crossgame-code">
                        <span>YOUR ONE-TIME CODE</span>
                        <code>{rewardCode}</code>
                        <div className="crossgame-code-actions">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(rewardCode)
                                setRewardCopied(true)
                              } catch {
                                setRewardCopied(false)
                              }
                            }}
                          >
                            {rewardCopied ? 'COPIED ✓' : 'COPY CODE'}
                          </button>
                          <a
                            href="https://quill-and-circle.web.app"
                            target="_blank"
                            rel="noreferrer"
                          >
                            OPEN QAS ↗
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="crossgame-instructions">
                      <strong>HOW TO UNLOCK THEM IN QAS</strong>
                      <p>
                        Reaching the point target unlocks the reward in DANJI, but you still
                        need to sync it to your Quill & Circle account.
                      </p>
                      <ol>
                        <li>Press <b>GET LATEST Q&C REWARDS</b> above.</li>
                        <li>Copy the complete <b>DANJI-QC-...</b> code.</li>
                        <li>Open QAS and sign in to the account you want the rewards on.</li>
                        <li>Open the side menu → <b>Cloud & Profile</b>.</li>
                        <li>Find <b>DANJI REWARD TRACK</b>, paste the code and press <b>Sync DANJI rewards</b>.</li>
                        <li>Go back to <b>Apprentice → Hat</b>. Your earned masks should be unlocked immediately.</li>
                      </ol>
                      <small>
                        You only need to sync again after earning new DANJI point milestones.
                      </small>
                    </div>
                  </>
                ) : (
                  <span className="crossgame-locked">{200 - currentXp} POINTS TO FIRST REWARD</span>
                )}
                {rewardError && <p className="crossgame-error">{rewardError}</p>}
              </div>
            </section>
          )
        })()}

        {loading ? (
          <div className="leaderboard-state">Loading DANJI rankings…</div>
        ) : error ? (
          <div className="leaderboard-state error">{error}</div>
        ) : entries.length === 0 ? (
          <div className="leaderboard-state">
            No ranked members yet. The first DANJI member will take the top position.
          </div>
        ) : (
          <>
            <div className="leaderboard-podium">
              {[1, 0, 2].map((sourceIndex, visualIndex) => {
                const entry = podium[sourceIndex]
                if (!entry) return null
                const rank = sourceIndex + 1

                return (
                  <article
                    className={[
                      'podium-card',
                      rank === 1 ? 'first' : '',
                      entry.uid === currentUid ? 'current-user' : '',
                    ].filter(Boolean).join(' ')}
                    key={entry.uid}
                  >
                    <span className="podium-position">#{rank}</span>
                    <div className="leaderboard-avatar">
                      {entry.photoURL ? (
                        <img src={entry.photoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{initials(entry.displayName)}</span>
                      )}
                    </div>
                    <strong>{entry.displayName}</strong>
                    <small>{rankTitle(entry.xp)}</small>
                    <b>{entry.xp.toLocaleString()} XP</b>
                    {visualIndex === 1 && <i>TOP RANK</i>}
                  </article>
                )
              })}
            </div>

            <div className="leaderboard-table">
              <div className="leaderboard-row leaderboard-row-head">
                <span>RANK</span>
                <span>MEMBER</span>
                <span>TIER</span>
                <span>TOMORI</span>
                <span>XP</span>
              </div>

              {rest.map((entry, index) => (
                <div
                  className={entry.uid === currentUid ? 'leaderboard-row current-user' : 'leaderboard-row'}
                  key={entry.uid}
                >
                  <span className="leaderboard-rank">#{index + 4}</span>
                  <div className="leaderboard-member">
                    <div className="leaderboard-avatar small">
                      {entry.photoURL ? (
                        <img src={entry.photoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{initials(entry.displayName)}</span>
                      )}
                    </div>
                    <strong>{entry.displayName}</strong>
                    {entry.uid === currentUid && <small>YOU</small>}
                  </div>
                  <span>{rankTitle(entry.xp)}</span>
                  <span>{entry.tomoriMessages}</span>
                  <strong>{entry.xp.toLocaleString()}</strong>
                </div>
              ))}
            </div>

            <div className="leaderboard-rules">
              <span>XP RULES</span>
              <div>
                <strong>+100</strong>
                <small>JOIN DANJI</small>
              </div>
              <div>
                <strong>+25</strong>
                <small>SIGN UP / NEW LINK</small>
              </div>
              <div>
                <strong>+5</strong>
                <small>SUCCESSFUL TOMORI REPLY</small>
              </div>
              <p>Provider-link bonuses are awarded once per supported sign-in method and verified by the server.</p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default Leaderboard
