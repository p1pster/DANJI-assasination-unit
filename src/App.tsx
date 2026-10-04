import { useEffect, useState } from 'react'\nimport type { FormEvent } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'
import './App.css'

type Tab = 'welcome' | 'assistant' | 'briefing' | 'archive'
type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const starterMessages: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'DANJI AI online. Ask me a question, give me something to plan, or use me as your built-in assistant.',
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
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch {
      setAssistantError('Google sign-in failed. Check that Google is enabled in Firebase Authentication.')
    }
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()

    if (!text || isThinking) return
    if (!user) {
      setAssistantError('Sign in before using DANJI AI.')
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
        { reply: string }
      >(functions, 'danjiAssistant')

      const result = await askDanji({ messages: nextMessages.slice(-12) })

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.data.reply || 'I could not produce a response.',
        },
      ])
    } catch (error) {
      console.error(error)
      setAssistantError(
        'DANJI AI could not connect. The AI function may still need its API key or deployment.',
      )
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
            AI
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
                OPEN DANJI AI
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
              DANJI AI
            </div>
            <div className="assistant-heading-row">
              <div>
                <p className="kicker">INTELLIGENCE NODE // ACTIVE</p>
                <h1>Assistant.</h1>
              </div>

              <div className="assistant-user">
                {user ? (
                  <>
                    <span>{user.displayName || user.email || 'SIGNED IN'}</span>
                    <button type="button" onClick={() => signOut(auth)}>
                      SIGN OUT
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={handleGoogleSignIn}>
                    SIGN IN WITH GOOGLE
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="assistant-console">
            <aside className="assistant-sidebar">
              <span className="card-label">AI CORE</span>
              <strong>DANJI // 01</strong>
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
                    <span>{message.role === 'user' ? 'YOU' : 'DANJI AI'}</span>
                    <p>{message.content}</p>
                  </article>
                ))}

                {isThinking && (
                  <article className="message ai-message thinking-message">
                    <span>DANJI AI</span>
                    <p>Processing<span className="thinking-dots">...</span></p>
                  </article>
                )}
              </div>

              {assistantError && <div className="assistant-error">{assistantError}</div>}

              <form className="assistant-input" onSubmit={handleSend}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={user ? 'Message DANJI AI...' : 'Sign in to activate DANJI AI...'}
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
      ) : (
        <section className="placeholder-page">
          <div className="eyebrow">
            <span>{activeTab === 'briefing' ? '03' : '04'}</span>
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
          <section className="floating-ai-panel" aria-label="DANJI AI assistant">
            <header className="floating-ai-header">
              <div>
                <span className="floating-ai-kicker">DANJI // INTELLIGENCE NODE</span>
                <strong>DANJI AI</strong>
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
                <p>Sign in to activate DANJI AI.</p>
                <button type="button" onClick={handleGoogleSignIn}>
                  SIGN IN WITH GOOGLE
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
                      <span>{message.role === 'user' ? 'YOU' : 'DANJI AI'}</span>
                      <p>{message.content}</p>
                    </article>
                  ))}

                  {isThinking && (
                    <article className="floating-message ai-message">
                      <span>DANJI AI</span>
                      <p>Processing<span className="thinking-dots">...</span></p>
                    </article>
                  )}
                </div>

                {assistantError && <div className="floating-ai-error">{assistantError}</div>}

                <form className="floating-ai-input" onSubmit={handleSend}>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Message DANJI AI..."
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
          aria-label={floatingAssistantOpen ? 'Close DANJI AI' : 'Open DANJI AI'}
          aria-expanded={floatingAssistantOpen}
          onClick={() => setFloatingAssistantOpen((open) => !open)}
        >
          {floatingAssistantOpen ? (
            <span className="floating-close">×</span>
          ) : (
            <>
              <span className="floating-ai-orb">AI</span>
              <span className="floating-ai-label">
                <strong>DANJI</strong>
                <small>ASSISTANT</small>
              </span>
            </>
          )}
        </button>
      </div>
    </main>
  )
}

export default App
