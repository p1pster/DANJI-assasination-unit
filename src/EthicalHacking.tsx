import { useMemo, useState } from 'react'
import {
  kaliToolCategories,
  kaliToolEntryCount,
  kaliToolsSource,
  kaliUniqueToolCount,
} from './kaliTools'

function EthicalHacking() {
  const [kaliOpen, setKaliOpen] = useState(true)
  const [toolsOpen, setToolsOpen] = useState(true)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

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
    setSelectedTool(null)
    setQuery('')
  }

  const toolPurpose = (tool: string) => {
    const lower = tool.toLowerCase()

    if (lower.includes('nmap') || lower === 'zenmap') {
      return 'Network discovery and security-auditing tooling used to identify hosts, services and exposed network surfaces in authorised environments.'
    }
    if (lower.includes('wireshark') || lower === 'tcpdump' || lower.includes('tcpflow')) {
      return 'Packet and traffic analysis tooling used to inspect network communications, troubleshoot protocols and investigate security events.'
    }
    if (lower.includes('burp') || lower.includes('zaproxy') || lower.includes('nikto') || lower.includes('wapiti')) {
      return 'Web application assessment tooling used to inspect requests, responses and common application security weaknesses during authorised testing.'
    }
    if (lower.includes('hashcat') || lower === 'john' || lower.includes('ophcrack')) {
      return 'Credential-auditing tooling used to test password strength and recover credentials from hashes that you are authorised to assess.'
    }
    if (lower.includes('metasploit') || lower === 'armitage') {
      return 'A security-testing framework used in controlled labs and authorised penetration tests to validate vulnerabilities and defensive controls.'
    }
    if (lower.includes('aircrack') || lower.includes('wifite') || lower.includes('reaver')) {
      return 'Wireless security assessment tooling used to evaluate Wi-Fi configurations and authentication controls on networks you are authorised to test.'
    }
    if (lower.includes('autopsy') || lower.includes('foremost') || lower.includes('testdisk') || lower.includes('photorec')) {
      return 'Digital forensics tooling used to inspect storage media, recover data and analyse evidence in incident-response or lab workflows.'
    }

    return `${tool} is listed by Kali Linux under ${category.name} → ${section.name}. Use it only in a lab, on your own systems, or where you have explicit permission to test.`
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
                      setSelectedTool(null)
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
                  <button
                    type="button"
                    className={selectedTool === tool ? 'ethical-tool-card active' : 'ethical-tool-card'}
                    key={tool}
                    onClick={() => setSelectedTool(tool)}
                  >
                    <span className="ethical-tool-marker" aria-hidden="true">›</span>
                    <div>
                      <strong>{tool}</strong>
                      <small>{category.name} // {section.name}</small>
                    </div>
                  </button>
                ))}
                {visibleTools.length === 0 && (
                  <div className="ethical-empty">No matching tools in this section.</div>
                )}
              </div>

              {selectedTool && (
                <section className="ethical-tool-detail">
                  <div className="ethical-tool-detail-head">
                    <div>
                      <span className="card-label">TOOL INFORMATION</span>
                      <h3>{selectedTool}</h3>
                    </div>
                    <button type="button" onClick={() => setSelectedTool(null)}>CLOSE ×</button>
                  </div>

                  <div className="ethical-tool-detail-grid">
                    <article>
                      <span>WHAT IT IS</span>
                      <p>{toolPurpose(selectedTool)}</p>
                    </article>
                    <article>
                      <span>KALI CATEGORY</span>
                      <strong>{category.name}</strong>
                      <small>{section.name}</small>
                    </article>
                    <article>
                      <span>SAFE USE</span>
                      <p>
                        Use only on systems you own, isolated labs, CTFs, or environments
                        where the owner has explicitly authorised the testing.
                      </p>
                    </article>
                  </div>

                  <div className="ethical-tool-detail-actions">
                    <a
                      href={kaliToolsSource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      VIEW OFFICIAL KALI DOCUMENTATION ↗
                    </a>
                  </div>
                </section>
              )}

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
