import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from './firebase'
import EthicalHacking from './EthicalHacking'
import Leaderboard from './Leaderboard'
import Recruitment from './Recruitment'
import Shop from './Shop'
import SeriaTracker from './SeriaTracker'
import './App.css'

type Tab = 'welcome' | 'assistant' | 'recruitment' | 'leaderboard' | 'shop' | 'seria' | 'minecraft' | 'valorant' | 'ethical' | 'briefing' | 'archive'
type SashaEmotion =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'crying'
  | 'shy'
  | 'confused'
  | 'angry'
  | 'working'
  | 'love'
  | 'drink'
  | 'sleepy'
  | 'cool'
  | 'shocked'
  | 'thinking'
  | 'food'
  | 'cute'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  emotion?: SashaEmotion
}

type MinecraftEduState = {
  symbols: string[]
  online: boolean
  updatedAtMs: number | null
}

type MinecraftEduStatusResponse = {
  symbols?: string[]
  online?: boolean
  updatedAtMs?: number | null
  canEdit?: boolean
}

const minecraftJoinSymbols = [
  ['book', '📕', 'Book'],
  ['balloon', '🎈', 'Balloon'],
  ['ladder', '🪜', 'Ladder'],
  ['face', '🙂', 'Face'],
  ['cookie', '🍪', 'Cookie'],
  ['fish', '🐟', 'Fish'],
  ['shovel', '♠️', 'Shovel'],
  ['cake', '🎂', 'Cake'],
  ['pickaxe', '⛏️', 'Pickaxe'],
  ['bucket', '🪣', 'Bucket'],
  ['steve', '👤', 'Steve'],
  ['apple', '🍎', 'Apple'],
  ['carrot', '🥕', 'Carrot'],
  ['cow', '🐄', 'Cow'],
  ['sign', '🪧', 'Sign'],
  ['potion', '🧪', 'Potion'],
  ['paper', '📄', 'Paper'],
  ['rabbit', '🐇', 'Rabbit'],
  ['panda', '🐼', 'Panda'],
  ['water', '💧', 'Water'],
  ['bottle', '🧴', 'Bottle'],
  ['alex', '🧑‍🦰', 'Alex'],
  ['llama', '🦙', 'Llama'],
] as const

const minecraftJoinSymbol = (id: string) =>
  minecraftJoinSymbols.find(([value]) => value === id) ??
  (['unknown', '❔', id || 'Waiting'] as const)

const starterMessages: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Sasha online. Ask me a question, give me something to plan, or just talk to me.',
    emotion: 'happy',
  },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('welcome')
  const [user, setUser] = useState(auth.currentUser)
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages)
  const [draft, setDraft] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [floatingAssistantOpen, setFloatingAssistantOpen] = useState(false)
  const [minecraftEdu, setMinecraftEdu] = useState<MinecraftEduState>({
    symbols: ['bottle', 'alex', 'water', 'llama'],
    online: false,
    updatedAtMs: null,
  })
  const [minecraftEduDraft, setMinecraftEduDraft] = useState<string[]>([
    'apple',
    'book',
    'pickaxe',
    'diamond',
  ])
  const [minecraftEduCanEdit, setMinecraftEduCanEdit] = useState(false)
  const [minecraftEduSaving, setMinecraftEduSaving] = useState(false)
  const [minecraftEduMessage, setMinecraftEduMessage] = useState('')

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser)

        if (nextUser) {
          const registerMember = httpsCallable(functions, 'registerDanjiMember')
          registerMember().catch((error) => {
            console.error('DANJI member registration failed', error)
          })
        }
      }),
    [],
  )

  useEffect(() => {
    const ref = doc(db, 'danjiConfig', 'minecraftEducation')
    return onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) return
        const data = snapshot.data()
        const symbols = Array.isArray(data.symbols)
          ? data.symbols.filter((value): value is string => typeof value === 'string').slice(0, 4)
          : []
        const nextSymbols =
          symbols.length === 4 ? symbols : ['bottle', 'alex', 'water', 'llama']
        const updatedAtMs =
          data.updatedAt && typeof data.updatedAt.toMillis === 'function'
            ? data.updatedAt.toMillis()
            : null

        setMinecraftEdu({
          symbols: nextSymbols,
          online: data.online === true,
          updatedAtMs,
        })
        setMinecraftEduDraft(nextSymbols)
      },
      (error) => {
        console.error('Minecraft Education live code subscription failed', error)
      },
    )
  }, [])

  useEffect(() => {
    if (!user) {
      setMinecraftEduCanEdit(false)
      return
    }

    const getStatus = httpsCallable<void, MinecraftEduStatusResponse>(
      functions,
      'getMinecraftEducationJoin',
    )

    void getStatus()
      .then((result) => {
        setMinecraftEduCanEdit(result.data.canEdit === true)
      })
      .catch((error) => {
        console.error('Minecraft Education admin check failed', error)
        setMinecraftEduCanEdit(false)
      })
  }, [user])

  const saveMinecraftEducationJoin = async (online = minecraftEdu.online) => {
    if (!minecraftEduCanEdit || minecraftEduSaving) return

    setMinecraftEduSaving(true)
    setMinecraftEduMessage('')

    try {
      const updateJoin = httpsCallable<
        { symbols: string[]; online: boolean },
        { ok: boolean }
      >(functions, 'updateMinecraftEducationJoin')

      await updateJoin({
        symbols: minecraftEduDraft.slice(0, 4),
        online,
      })

      setMinecraftEduMessage('LIVE JOIN CODE UPDATED')
    } catch (error) {
      console.error(error)
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : ''
      setMinecraftEduMessage(
        message.replace(/^FirebaseError:\s*/i, '') || 'UPDATE FAILED',
      )
    } finally {
      setMinecraftEduSaving(false)
    }
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()

    if (!text || isThinking) return
    if (!user) {
      setAssistantError('Become a DANJI member before talking to Sasha.')
      return
    }

    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setDraft('')
    setAssistantError('')
    setIsThinking(true)

    try {
      const askDanji = httpsCallable<
        { messages: ChatMessage[] },
        { reply: string; emotion: SashaEmotion }
      >(functions, 'danjiAssistant')

      const result = await askDanji({ messages: nextMessages.slice(-12) })

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.data.reply || 'I could not produce a response.',
          emotion: result.data.emotion || 'neutral',
        },
      ])
    } catch (error) {
      console.error(error)

      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : ''
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : ''

      if (message) {
        setAssistantError(message.replace(/^FirebaseError:\s*/i, ''))
      } else if (code) {
        setAssistantError(`Sasha could not connect (${code}).`)
      } else {
        setAssistantError('Sasha could not connect to the AI service.')
      }
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <main className="danji-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button className="brand" type="button" onClick={() => setActiveTab('welcome')}>
          <span className="brand-mark">D</span>
          <span>
            <strong>DANJI</strong>
            <small>CONTROL NETWORK</small>
          </span>
        </button>

        <nav className="tabs" aria-label="DANJI sections">
          <button
            className={activeTab === 'welcome' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('welcome')}
          >
            Welcome
          </button>
          <button
            className={activeTab === 'assistant' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('assistant')}
          >
            Sasha
          </button>
          <button
            className={activeTab === 'recruitment' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('recruitment')}
          >
            Recruitment
          </button>
          <button
            className={activeTab === 'leaderboard' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
          <button
            className={activeTab === 'shop' ? 'tab active shop-nav-tab' : 'tab shop-nav-tab'}
            type="button"
            onClick={() => setActiveTab('shop')}
          >
            Shop
          </button>
          <button
            className={activeTab === 'seria' ? 'tab active seria-nav-tab' : 'tab seria-nav-tab'}
            type="button"
            onClick={() => setActiveTab('seria')}
          >
            Seria
          </button>
          <button
            className={activeTab === 'minecraft' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('minecraft')}
          >
            Minecraft
          </button>
          <button
            className={activeTab === 'valorant' ? 'tab active valorant-tab' : 'tab valorant-tab'}
            type="button"
            onClick={() => setActiveTab('valorant')}
          >
            Valorant
          </button>
          <button
            className={activeTab === 'ethical' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('ethical')}
          >
            Ethical Hacking
          </button>
          <button
            className={activeTab === 'briefing' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('briefing')}
          >
            Briefing
          </button>
          <button
            className={activeTab === 'archive' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('archive')}
          >
            Archive
          </button>
          <a
            className="tab qas-link"
            href="https://quill-and-circle.web.app"
            target="_blank"
            rel="noreferrer"
            aria-label="Open Quill and Circle"
          >
            QAS <span aria-hidden="true">↗</span>
          </a>
        </nav>

        <div className="status-pill">
          <span className="status-dot" />
          ONLINE
        </div>
      </header>

      {activeTab === 'welcome' ? (
        <section className="welcome-page">
          <div className="eyebrow">
            <span>01</span>
            WELCOME
          </div>

          <div className="hero-copy">
            <p className="kicker">SYSTEM ACCESS // DANJI</p>
            <h1>
              Welcome to
              <span>DANJI.</span>
            </h1>
            <p className="intro">
              A private digital hub built from the ground up. This is the first
              entry point into the DANJI network — more sections will come online
              as the project grows.
            </p>

            <div className="hero-actions">
              <button
                className="primary-action"
                type="button"
                onClick={() => setFloatingAssistantOpen(true)}
              >
                OPEN SASHA
                <span aria-hidden="true">↗</span>
              </button>
              <a
                className="secondary-action qas-hero-link"
                href="https://quill-and-circle.web.app"
                target="_blank"
                rel="noreferrer"
              >
                OPEN QAS
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <div className="welcome-grid">
            <article className="feature-card feature-card-large">
              <div className="card-index">A / 01</div>
              <div>
                <span className="card-label">WELCOME NODE</span>
                <h2>One place. One system.</h2>
                <p>
                  DANJI is ready for its next modules. The welcome page is now the
                  default tab whenever the site opens.
                </p>
              </div>
              <div className="signal" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>

            <article className="feature-card metric-card">
              <span className="card-label">NETWORK</span>
              <strong>LIVE</strong>
              <p>Firebase connected</p>
            </article>

            <article className="feature-card metric-card">
              <span className="card-label">AI CORE</span>
              <strong>READY</strong>
              <p>Secure server function</p>
            </article>
          </div>

          <footer className="welcome-footer">
            <span>DANJI // WEB SYSTEM</span>
            <span className="footer-line" />
            <span>EST. 2026</span>
          </footer>
        </section>
      ) : activeTab === 'assistant' ? (
        <section className="assistant-page">
          <div className="assistant-heading">
            <div className="eyebrow">
              <span>02</span>
              SASHA
            </div>
            <div className="assistant-heading-row">
              <div>
                <p className="kicker">INTELLIGENCE NODE // ACTIVE</p>
                <h1>Sasha.</h1>
              </div>

              <div className="assistant-user">
                {user ? (
                  <>
                    <span>{user.displayName || user.email || 'DANJI MEMBER'}</span>
                    <button type="button" onClick={() => setActiveTab('recruitment')}>
                      MEMBER STATUS
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setActiveTab('recruitment')}>
                    BECOME DANJI MEMBER
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="assistant-console">
            <aside className="assistant-sidebar">
              <i className="tomori-sidebar-avatar tomori-avatar" role="img" aria-label="Sasha" />
              <span className="card-label">AI CORE</span>
              <strong>SASHA // 01</strong>
              <p>
                The AI runs through a protected Firebase Function, so the API key
                never lives in the website code.
              </p>
              <div className="assistant-state">
                <span className={user ? 'status-dot' : 'status-dot idle'} />
                {user ? 'AUTHENTICATED' : 'AUTH REQUIRED'}
              </div>
            </aside>

            <div className="chat-panel">
              <div className="chat-log" aria-live="polite">
                {messages.map((message, index) => (
                  <article
                    className={message.role === 'user' ? 'message user-message' : 'message ai-message'}
                    key={index}
                  >
                    <span>{message.role === 'user' ? 'YOU' : 'SASHA'}</span>
                    {message.role === 'assistant' ? (
                      <div className="tomori-response">
                        <i
                          className={`tomori-emote tomori-emote-${message.emotion || 'neutral'}`}
                          aria-hidden="true"
                        />
                        <p>{message.content}</p>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </article>
                ))}

                {isThinking && (
                  <article className="message ai-message thinking-message">
                    <span>SASHA</span>
                    <div className="tomori-response">
                      <i className="tomori-emote tomori-emote-thinking" aria-hidden="true" />
                      <p>Processing<span className="thinking-dots">...</span></p>
                    </div>
                  </article>
                )}
              </div>

              {assistantError && <div className="assistant-error">{assistantError}</div>}

              <form className="assistant-input" onSubmit={handleSend}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={user ? 'Message Sasha...' : 'Sign in to talk to Sasha...'}
                  maxLength={4000}
                  disabled={!user || isThinking}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                <button type="submit" disabled={!user || !draft.trim() || isThinking}>
                  SEND
                  <span>↗</span>
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : activeTab === 'recruitment' ? (
        <Recruitment
          user={user}
          onOpenSasha={() => setActiveTab('assistant')}
        />
      ) : activeTab === 'leaderboard' ? (
        <Leaderboard
          currentUid={user?.uid}
          onJoin={() => setActiveTab('recruitment')}
        />
      ) : activeTab === 'shop' ? (
        <Shop
          user={user}
          onJoin={() => setActiveTab('recruitment')}
        />
      ) : activeTab === 'seria' ? (
        <SeriaTracker />
      ) : activeTab === 'minecraft' ? (
        <section className="minecraft-page">
          <div className="minecraft-wrap">
            <div className="eyebrow">
              <span>06</span>
              MINECRAFT
            </div>

            <div className="minecraft-heading">
              <div>
                <p className="kicker">DANJI EDUCATION NODE // LIVE JOIN CODE</p>
                <h1>Minecraft.</h1>
                <p>
                  The current Minecraft Education picture code updates here live.
                  Open Join World and click the four pictures in the same order.
                </p>
              </div>
              <div className={minecraftEdu.online ? 'minecraft-edition-badge online' : 'minecraft-edition-badge offline'}>
                <span>▦</span>
                <strong>EDUCATION</strong>
                <small>{minecraftEdu.online ? 'WORLD ONLINE' : 'WORLD OFFLINE'}</small>
              </div>
            </div>

            <section className="minecraft-edu-panel">
              <div className="minecraft-edu-topline">
                <div>
                  <span className="card-label">CURRENT JOIN CODE</span>
                  <h2>Click these four pictures in order</h2>
                </div>
                <div className={minecraftEdu.online ? 'minecraft-live-state online' : 'minecraft-live-state offline'}>
                  <i />
                  {minecraftEdu.online ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>

              <div className="minecraft-symbol-code" aria-label="Current Minecraft Education join code">
                {minecraftEdu.symbols.map((symbolId, index) => {
                  const symbol = minecraftJoinSymbol(symbolId)
                  return (
                    <article className="minecraft-symbol-card" key={index}>
                      <small>{String(index + 1).padStart(2, '0')}</small>
                      <b aria-hidden="true">{symbol[1]}</b>
                      <span>{symbol[2]}</span>
                    </article>
                  )
                })}
              </div>

              <div className="minecraft-edu-meta">
                <span>
                  {minecraftEdu.updatedAtMs
                    ? `UPDATED ${new Date(minecraftEdu.updatedAtMs).toLocaleString()}`
                    : 'WAITING FOR FIRST HOST UPDATE'}
                </span>
                <strong>The code refreshes here automatically when the DANJI host changes it.</strong>
              </div>

              <section className="minecraft-edu-how">
                <span className="card-label">JOIN FROM MINECRAFT EDUCATION</span>
                <div>
                  <p><b>01</b> Open Minecraft Education.</p>
                  <p><b>02</b> Choose <strong>Play → Join World</strong>.</p>
                  <p><b>03</b> Click the four pictures above in order.</p>
                  <p><b>04</b> Join the DANJI world.</p>
                </div>
              </section>

              {minecraftEduCanEdit && (
                <section className="minecraft-host-controls">
                  <div className="minecraft-host-heading">
                    <div>
                      <span className="card-label">HOST CONTROLS</span>
                      <h3>Update the live Education code</h3>
                    </div>
                    <span>ADMIN</span>
                  </div>

                  <div className="minecraft-symbol-editors">
                    {minecraftEduDraft.map((symbolId, index) => (
                      <label key={index}>
                        <small>SYMBOL {index + 1}</small>
                        <select
                          value={symbolId}
                          onChange={(event) => {
                            const next = [...minecraftEduDraft]
                            next[index] = event.target.value
                            setMinecraftEduDraft(next)
                          }}
                        >
                          {minecraftJoinSymbols.map(([value, icon, label]) => (
                            <option value={value} key={value}>
                              {icon} {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="minecraft-host-actions">
                    <button
                      type="button"
                      disabled={minecraftEduSaving}
                      onClick={() => void saveMinecraftEducationJoin(true)}
                    >
                      SAVE CODE + SET ONLINE
                    </button>
                    <button
                      className="quiet"
                      type="button"
                      disabled={minecraftEduSaving}
                      onClick={() => void saveMinecraftEducationJoin(false)}
                    >
                      SET WORLD OFFLINE
                    </button>
                    {minecraftEduMessage && <span>{minecraftEduMessage}</span>}
                  </div>
                </section>
              )}
            </section>

            <section className="minecraft-bedrock-legacy">
              <div className="minecraft-bedrock-title">
                <div>
                  <span className="card-label">BEDROCK SERVER</span>
                  <h2>DANJI Bedrock node</h2>
                </div>
                <span>ALSO AVAILABLE</span>
              </div>

              <div className="minecraft-server-grid">
                <article className="minecraft-server-card primary">
                  <span className="card-label">DIRECT CONNECTION</span>
                  <h2>DANJI Bedrock Server</h2>
                  <div className="minecraft-server-field">
                    <small>SERVER ADDRESS</small>
                    <code>5.9.151.142</code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText('5.9.151.142')}
                    >
                      COPY IP
                    </button>
                  </div>
                  <div className="minecraft-server-field">
                    <small>PORT</small>
                    <code>2391</code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText('2391')}
                    >
                      COPY PORT
                    </button>
                  </div>
                  <div className="minecraft-server-combined">
                    <span>FULL ADDRESS</span>
                    <strong>5.9.151.142:2391</strong>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText('5.9.151.142:2391')}
                    >
                      COPY FULL ADDRESS
                    </button>
                  </div>
                </article>

                <article className="minecraft-server-card">
                  <span className="card-label">DOMAIN CONNECTION</span>
                  <h2>ScalaCube Domain</h2>
                  <div className="minecraft-server-field">
                    <small>SERVER ADDRESS</small>
                    <code>a16eyftxek.scalacube.pro</code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText('a16eyftxek.scalacube.pro')}
                    >
                      COPY DOMAIN
                    </button>
                  </div>
                  <div className="minecraft-server-field">
                    <small>PORT</small>
                    <code>2391</code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText('2391')}
                    >
                      COPY PORT
                    </button>
                  </div>
                  <div className="minecraft-server-combined">
                    <span>FULL DOMAIN</span>
                    <strong>a16eyftxek.scalacube.pro:2391</strong>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText('a16eyftxek.scalacube.pro:2391')}
                    >
                      COPY FULL DOMAIN
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </section>
      ) : activeTab === 'valorant' ? (
        <section className="placeholder-page valorant-page">
          <div className="eyebrow">
            <span>07</span>
            VALORANT
          </div>
          <div className="placeholder-content">
            <p>TACTICAL NODE // READY</p>
            <h1>Valorant</h1>
            <span>Agents, maps, loadouts, clips, stats and DANJI Valorant tools will live here.</span>
          </div>
        </section>
      ) : activeTab === 'ethical' ? (
        <EthicalHacking />
      ) : (
        <section className="placeholder-page">
          <div className="eyebrow">
            <span>{activeTab === 'briefing' ? '09' : '10'}</span>
            {activeTab.toUpperCase()}
          </div>
          <div className="placeholder-content">
            <p>MODULE OFFLINE</p>
            <h1>{activeTab === 'briefing' ? 'Briefing' : 'Archive'}</h1>
            <span>This section is ready for us to build next.</span>
          </div>
        </section>
      )}

      <div className={floatingAssistantOpen ? 'floating-ai open' : 'floating-ai'}>
        {floatingAssistantOpen && (
          <section className="floating-ai-panel" aria-label="Sasha AI assistant">
            <header className="floating-ai-header">
              <div className="floating-ai-identity">
                <i className="tomori-header-avatar tomori-avatar" aria-hidden="true" />
                <div>
                  <span className="floating-ai-kicker">DANJI // INTELLIGENCE NODE</span>
                  <strong>SASHA</strong>
                </div>
              </div>
              <div className="floating-ai-header-actions">
                <button
                  type="button"
                  title="Open full assistant"
                  onClick={() => {
                    setActiveTab('assistant')
                    setFloatingAssistantOpen(false)
                  }}
                >
                  ↗
                </button>
                <button
                  type="button"
                  title="Close assistant"
                  onClick={() => setFloatingAssistantOpen(false)}
                >
                  ×
                </button>
              </div>
            </header>

            {!user ? (
              <div className="floating-ai-signin">
                <span className="status-dot idle" />
                <p>Sasha is available to DANJI members.</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('recruitment')
                    setFloatingAssistantOpen(false)
                  }}
                >
                  BECOME DANJI MEMBER
                </button>
              </div>
            ) : (
              <>
                <div className="floating-chat-log" aria-live="polite">
                  {messages.map((message, index) => (
                    <article
                      className={message.role === 'user' ? 'floating-message user-message' : 'floating-message ai-message'}
                      key={index}
                    >
                      <span>{message.role === 'user' ? 'YOU' : 'SASHA'}</span>
                      {message.role === 'assistant' ? (
                        <div className="tomori-response compact">
                          <i
                            className={`tomori-emote tomori-emote-${message.emotion || 'neutral'}`}
                            aria-hidden="true"
                          />
                          <p>{message.content}</p>
                        </div>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </article>
                  ))}

                  {isThinking && (
                    <article className="floating-message ai-message">
                      <span>SASHA</span>
                      <div className="tomori-response compact">
                        <i className="tomori-emote tomori-emote-thinking" aria-hidden="true" />
                        <p>Processing<span className="thinking-dots">...</span></p>
                      </div>
                    </article>
                  )}
                </div>

                {assistantError && <div className="floating-ai-error">{assistantError}</div>}

                <form className="floating-ai-input" onSubmit={handleSend}>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Message Sasha..."
                    maxLength={4000}
                    disabled={isThinking}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                  />
                  <button type="submit" disabled={!draft.trim() || isThinking}>
                    ↑
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        <button
          className="floating-ai-trigger"
          type="button"
          aria-label={floatingAssistantOpen ? 'Close Sasha' : 'Open Sasha'}
          aria-expanded={floatingAssistantOpen}
          onClick={() => setFloatingAssistantOpen((open) => !open)}
        >
          {floatingAssistantOpen ? (
            <span className="floating-close">×</span>
          ) : (
            <>
              <i className="tomori-trigger-avatar tomori-avatar" role="img" aria-label="Sasha" />
              <span className="floating-ai-label">
                <strong>SASHA</strong>
                <small>DANJI AI</small>
              </span>
            </>
          )}
        </button>
      </div>
    </main>
  )
}

export default App
