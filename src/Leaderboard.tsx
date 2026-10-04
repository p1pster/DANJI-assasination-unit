import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

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
              Every DANJI member starts with 100 XP. Successful conversations with
              Tomori currently award 5 XP, with more ways to earn XP coming later.
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
                <strong>+5</strong>
                <small>SUCCESSFUL TOMORI REPLY</small>
              </div>
              <p>Future modules can add more verified XP sources without allowing members to edit their own score.</p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default Leaderboard
