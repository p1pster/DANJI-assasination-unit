import { useState } from 'react'
import './App.css'

type Tab = 'welcome' | 'briefing' | 'archive'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('welcome')

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
              <button className="primary-action" type="button">
                ENTER DANJI
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
              <span className="card-label">BUILD</span>
              <strong>ALPHA</strong>
              <p>web-alpha branch</p>
            </article>
          </div>

          <footer className="welcome-footer">
            <span>DANJI // WEB SYSTEM</span>
            <span className="footer-line" />
            <span>EST. 2026</span>
          </footer>
        </section>
      ) : (
        <section className="placeholder-page">
          <div className="eyebrow">
            <span>{activeTab === 'briefing' ? '02' : '03'}</span>
            {activeTab.toUpperCase()}
          </div>
          <div className="placeholder-content">
            <p>MODULE OFFLINE</p>
            <h1>{activeTab === 'briefing' ? 'Briefing' : 'Archive'}</h1>
            <span>This section is ready for us to build next.</span>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
