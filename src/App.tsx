import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'
import './App.css'

type Tab = 'welcome' | 'assistant' | 'recruitment' | 'minecraft' | 'ethical' | 'briefing' | 'archive'
type TomoriEmotion =
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
  emotion?: TomoriEmotion
}

const starterMessages: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Tomori online. Ask me a question, give me something to plan, or just talk to me.',
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

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const handleGoogleSignIn = async () => {
    setAssistantError('')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : ''

      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, provider)
          return
        } catch {
          setAssistantError('Google sign-in was blocked by the browser. Allow redirects/pop-ups for danji.web.app and try again.')
          return
        }
      }

      if (code === 'auth/unauthorized-domain') {
        setAssistantError('Google sign-in is not authorised for danji.web.app yet. Add danji.web.app in Firebase Authentication → Settings → Authorized domains.')
        return
      }

      if (code === 'auth/operation-not-allowed') {
        setAssistantError('Google sign-in is disabled in Firebase. Enable Google under Authentication → Sign-in method.')
        return
      }

      setAssistantError(`Google sign-in failed${code ? ` (${code})` : ''}. Check Firebase Authentication settings.`)
    }
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()

    if (!text || isThinking) return
    if (!user) {
      setAssistantError('Become a DANJI member before talking to Tomori.')
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
        { reply: string; emotion: TomoriEmotion }
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
        setAssistantError(`Tomori could not connect (${code}).`)
      } else {
        setAssistantError('Tomori could not connect to the AI service.')
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
            Tomori
          </button>
          <button
            className={activeTab === 'recruitment' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('recruitment')}
          >
            Recruitment
          </button>
          <button
            className={activeTab === 'minecraft' ? 'tab active' : 'tab'}
            type="button"
            onClick={() => setActiveTab('minecraft')}
          >
            Minecraft
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
                OPEN TOMORI
                <span aria-hidden="true">↗</span>
              </button>
              <button className="secondary-action" type="button">
                VIEW STATUS
              </button>
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
              TOMORI
            </div>
            <div className="assistant-heading-row">
              <div>
                <p className="kicker">INTELLIGENCE NODE // ACTIVE</p>
                <h1>Tomori.</h1>
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
              <i className="tomori-sidebar-avatar tomori-avatar" role="img" aria-label="Tomori" />
              <span className="card-label">AI CORE</span>
              <strong>TOMORI // 01</strong>
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
                    <span>{message.role === 'user' ? 'YOU' : 'TOMORI'}</span>
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
                    <span>TOMORI</span>
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
                  placeholder={user ? 'Message Tomori...' : 'Sign in to talk to Tomori...'}
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
        <section className="recruitment-page">
          <div className="recruitment-wrap">
            <div className="eyebrow">
              <span>03</span>
              RECRUITMENT
            </div>

            <div className="recruitment-hero">
              <p className="kicker">DANJI // MEMBER ACCESS</p>
              <h1>Join DANJI.</h1>
              <p>
                Become a DANJI member to unlock Tomori and future member-only
                systems as they come online.
              </p>
            </div>

            <div className="recruitment-grid">
              <article className="recruitment-card recruitment-card-main">
                <span className="card-label">MEMBERSHIP STATUS</span>
                {user ? (
                  <>
                    <div className="member-status-line">
                      <span className="status-dot" />
                      ACTIVE MEMBER
                    </div>
                    <h2>{user.displayName || 'DANJI Member'}</h2>
                    <p>{user.email || 'Google account connected'}</p>
                    <div className="recruitment-actions">
                      <button
                        className="recruitment-primary"
                        type="button"
                        onClick={() => setActiveTab('assistant')}
                      >
                        TALK TO TOMORI
                        <span>↗</span>
                      </button>
                      <button
                        className="recruitment-secondary"
                        type="button"
                        onClick={() => signOut(auth)}
                      >
                        SIGN OUT
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="member-status-line muted">
                      <span className="status-dot idle" />
                      NOT A MEMBER
                    </div>
                    <h2>Become a DANJI member.</h2>
                    <p>
                      Sign in with Google to create or access your DANJI membership.
                      Your Firebase account is used to identify you securely.
                    </p>
                    <button
                      className="recruitment-primary google-login"
                      type="button"
                      onClick={handleGoogleSignIn}
                    >
                      <span className="google-mark">G</span>
                      SIGN IN WITH GOOGLE
                      <span>↗</span>
                    </button>
                  </>
                )}

                {assistantError && (
                  <div className="recruitment-error">{assistantError}</div>
                )}
              </article>

              <aside className="recruitment-card recruitment-info">
                <span className="card-label">MEMBER ACCESS</span>
                <strong>TOMORI // ENABLED</strong>
                <p>
                  Membership gives you authenticated access to Tomori. More DANJI
                  member systems can be added here later.
                </p>
                <div className="recruitment-rule" />
                <span className="recruitment-note">
                  ONE DANJI ID // GOOGLE AUTHENTICATION
                </span>
              </aside>
            </div>
          </div>
        </section>
      ) : activeTab === 'minecraft' ? (
        <section className="placeholder-page">
          <div className="eyebrow">
            <span>04</span>
            MINECRAFT
          </div>
          <div className="placeholder-content">
            <p>GAME NODE // READY</p>
            <h1>Minecraft</h1>
            <span>Servers, builds, tools, maps and DANJI Minecraft projects will live here.</span>
          </div>
        </section>
      ) : activeTab === 'ethical' ? (
        <section className="placeholder-page">
          <div className="eyebrow">
            <span>05</span>
            ETHICAL HACKING
          </div>
          <div className="placeholder-content">
            <p>SECURITY LAB // READY</p>
            <h1>Ethical Hacking</h1>
            <span>Authorised security labs, learning tools, notes and defensive testing will live here.</span>
          </div>
        </section>
      ) : (
        <section className="placeholder-page">
          <div className="eyebrow">
            <span>{activeTab === 'briefing' ? '06' : '07'}</span>
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
          <section className="floating-ai-panel" aria-label="Tomori AI assistant">
            <header className="floating-ai-header">
              <div className="floating-ai-identity">
                <i className="tomori-header-avatar tomori-avatar" aria-hidden="true" />
                <div>
                  <span className="floating-ai-kicker">DANJI // INTELLIGENCE NODE</span>
                  <strong>TOMORI</strong>
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
                <p>Tomori is available to DANJI members.</p>
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
                      <span>{message.role === 'user' ? 'YOU' : 'TOMORI'}</span>
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
                      <span>TOMORI</span>
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
                    placeholder="Message Tomori..."
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
          aria-label={floatingAssistantOpen ? 'Close Tomori' : 'Open Tomori'}
          aria-expanded={floatingAssistantOpen}
          onClick={() => setFloatingAssistantOpen((open) => !open)}
        >
          {floatingAssistantOpen ? (
            <span className="floating-close">×</span>
          ) : (
            <>
              <i className="tomori-trigger-avatar tomori-avatar" role="img" aria-label="Tomori" />
              <span className="floating-ai-label">
                <strong>TOMORI</strong>
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
