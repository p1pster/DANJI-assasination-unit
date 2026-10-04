import { useMemo, useState } from 'react'
import {
  kaliToolCategories,
  kaliToolEntryCount,
  kaliToolsSource,
  kaliUniqueToolCount,
} from './kaliTools'

function EthicalHacking() {
  const [kaliOpen, setKaliOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [query, setQuery] = useState('')

  const category = kaliToolCategories[categoryIndex]
  const section = category.sections[Math.min(sectionIndex, category.sections.length - 1)]

  const visibleTools = useMemo(() => {
    const term = query.trim().toLowerCase()
    const tools = section?.tools || []
    return term ? tools.filter((tool) => tool.toLowerCase().includes(term)) : tools
  }, [query, section])

  const pickCategory = (index: number) => {
    setCategoryIndex(index)
    setSectionIndex(0)
    setQuery('')
  }

  return (
    <section className="ethical-page">
      <div className="ethical-heading">
        <div className="eyebrow">
          <span>05</span>
          ETHICAL HACKING
        </div>
        <div className="ethical-title-row">
          <div>
            <p className="kicker">SECURITY LAB // AUTHORISED USE</p>
            <h1>Ethical Hacking</h1>
            <p className="ethical-intro">
              A DANJI reference library for security learning, lab work and authorised
              testing. The Kali catalogue below mirrors the tool taxonomy published
              by Kali Linux without copying the full tool manuals.
            </p>
          </div>
          <div className="ethical-stats">
            <span>{kaliToolCategories.length} categories</span>
            <span>{kaliUniqueToolCount} unique tools</span>
            <span>{kaliToolEntryCount} catalogue entries</span>
          </div>
        </div>
      </div>

      <div className="ethical-stack">
        <div className="ethical-nav-level level-one">
          <span className="ethical-level-label">PLATFORM</span>
          <button
            type="button"
            className={kaliOpen ? 'ethical-pill active' : 'ethical-pill'}
            onClick={() => {
              setKaliOpen((open) => !open)
              if (kaliOpen) setToolsOpen(false)
            }}
          >
            KALI LINUX
            <span>{kaliOpen ? '−' : '+'}</span>
          </button>
        </div>

        {kaliOpen && (
          <div className="ethical-nav-level level-two">
            <span className="ethical-level-label">LIBRARY</span>
            <button
              type="button"
              className={toolsOpen ? 'ethical-pill active' : 'ethical-pill'}
              onClick={() => setToolsOpen((open) => !open)}
            >
              TOOLS
              <span>{toolsOpen ? '−' : '+'}</span>
            </button>
            <a
              className="ethical-source-link"
              href={kaliToolsSource}
              target="_blank"
              rel="noreferrer"
            >
              OFFICIAL KALI SOURCE ↗
            </a>
          </div>
        )}

        {kaliOpen && toolsOpen && (
          <>
            <div className="ethical-nav-level ethical-category-bar">
              <span className="ethical-level-label">CATEGORY</span>
              <div className="ethical-scroll-row">
                {kaliToolCategories.map((item, index) => (
                  <button
                    type="button"
                    key={item.name}
                    className={index === categoryIndex ? 'ethical-tab active' : 'ethical-tab'}
                    onClick={() => pickCategory(index)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="ethical-nav-level ethical-section-bar">
              <span className="ethical-level-label">SECTION</span>
              <div className="ethical-scroll-row">
                {category.sections.map((item, index) => (
                  <button
                    type="button"
                    key={item.name}
                    className={index === sectionIndex ? 'ethical-tab active' : 'ethical-tab'}
                    onClick={() => {
                      setSectionIndex(index)
                      setQuery('')
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="ethical-catalog">
              <div className="ethical-catalog-head">
                <div>
                  <span className="card-label">KALI TOOL INDEX</span>
                  <h2>{category.name}</h2>
                  <p>{category.summary}</p>
                </div>
                <div className="ethical-current-section">
                  <span>SECTION</span>
                  <strong>{section.name}</strong>
                  <small>{section.tools.length} entries</small>
                </div>
              </div>

              <div className="ethical-search-row">
                <label htmlFor="kali-tool-search">FILTER THIS SECTION</label>
                <input
                  id="kali-tool-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tool names..."
                />
              </div>

              <div className="ethical-tool-grid">
                {visibleTools.map((tool) => (
                  <article className="ethical-tool-card" key={tool}>
                    <span className="ethical-tool-marker" aria-hidden="true">›</span>
                    <div>
                      <strong>{tool}</strong>
                      <small>{category.name} // {section.name}</small>
                    </div>
                  </article>
                ))}
                {visibleTools.length === 0 && (
                  <div className="ethical-empty">No matching tools in this section.</div>
                )}
              </div>

              <footer className="ethical-source-note">
                <span>CATALOGUE SOURCE // KALI LINUX TOOLS</span>
                <span>
                  Names and category structure are indexed from the official Kali
                  catalogue. Use tools only on systems you own or are explicitly
                  authorised to test.
                </span>
              </footer>
            </div>
          </>
        )}

        {!kaliOpen && (
          <div className="ethical-empty-state">
            <span>01</span>
            <strong>Select Kali Linux</strong>
            <p>Open the Kali Linux node to enter the tool catalogue.</p>
          </div>
        )}

        {kaliOpen && !toolsOpen && (
          <div className="ethical-empty-state">
            <span>02</span>
            <strong>Select Tools</strong>
            <p>Open the Tools library to browse the Kali category hierarchy.</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default EthicalHacking
