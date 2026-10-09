import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPhoneNumber,
  linkWithPopup,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type AuthProvider,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'

type RecruitmentProps = {
  user: User | null
  onOpenSasha: () => void
}

type ProviderOption = {
  id: string
  label: string
  short: string
  kind: 'popup' | 'email' | 'phone' | 'native'
  note?: string
}

type PartyCosmeticItem = {
  id: string
  label: string
  slot: 'hat' | 'body'
  spriteY: number
}

type PartyCosmeticsStatus = {
  unlocked: boolean
  items: string[]
  equippedHat: string
  equippedBody: string
}

const partyCosmetics: PartyCosmeticItem[] = [
  { id: 'party-fox-mask', label: 'Party Fox Mask', slot: 'hat', spriteY: 0 },
  { id: 'party-crimson', label: 'Crimson Body', slot: 'body', spriteY: 16.6667 },
  { id: 'party-cobalt', label: 'Cobalt Body', slot: 'body', spriteY: 33.3333 },
  { id: 'party-violet', label: 'Violet Body', slot: 'body', spriteY: 50 },
  { id: 'party-emerald', label: 'Emerald Body', slot: 'body', spriteY: 66.6667 },
  { id: 'party-gold', label: 'Gold Body', slot: 'body', spriteY: 83.3333 },
  { id: 'party-frost', label: 'Frost Body', slot: 'body', spriteY: 100 },
]

const providers: ProviderOption[] = [
  { id: 'password', label: 'Email / Password', short: '✉', kind: 'email' },
  { id: 'phone', label: 'Phone', short: '☎', kind: 'phone' },
  { id: 'google.com', label: 'Google', short: 'G', kind: 'popup' },
  { id: 'playgames.google.com', label: 'Play Games', short: '▶', kind: 'native', note: 'Android / app only' },
  { id: 'gc.apple.com', label: 'Game Center', short: '◉', kind: 'native', note: 'iOS app only' },
  { id: 'facebook.com', label: 'Facebook', short: 'f', kind: 'popup' },
  { id: 'github.com', label: 'GitHub', short: '⌘', kind: 'popup' },
  { id: 'yahoo.com', label: 'Yahoo', short: 'Y', kind: 'popup' },
  { id: 'microsoft.com', label: 'Microsoft', short: '⊞', kind: 'popup' },
  { id: 'apple.com', label: 'Apple', short: '', kind: 'popup' },
]

const providerFor = (providerId: string): AuthProvider => {
  if (providerId === 'google.com') {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    return provider
  }

  if (providerId === 'facebook.com') {
    const provider = new FacebookAuthProvider()
    provider.addScope('email')
    return provider
  }

  if (providerId === 'github.com') {
    return new GithubAuthProvider()
  }

  const provider = new OAuthProvider(providerId)
  if (providerId === 'apple.com') {
    provider.addScope('email')
    provider.addScope('name')
  }
  return provider
}

const cleanAuthError = (error: unknown) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : ''

  if (code === 'auth/account-exists-with-different-credential') {
    return 'That email already belongs to a DANJI member. Sign in with the existing method first, then add this provider to the same profile for +25 XP.'
  }
  if (code === 'auth/credential-already-in-use') {
    return 'That sign-in account is already connected to another DANJI profile.'
  }
  if (code === 'auth/provider-already-linked') {
    return 'That sign-in method is already linked to this DANJI profile.'
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in popup. Allow popups for danji.web.app and try again.'
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in was cancelled before it finished.'
  }
  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.'
  }
  if (code === 'auth/weak-password') {
    return 'Use a stronger password of at least 6 characters.'
  }
  if (code === 'auth/email-already-in-use') {
    return 'That email is already registered. Use Log in instead.'
  }
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'The email or password was not accepted.'
  }
  if (code === 'auth/invalid-phone-number') {
    return 'Enter the phone number in international format, for example +447700900000.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Firebase has temporarily limited authentication attempts. Try again later.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'That provider is enabled in the UI but still needs its Firebase provider configuration completed.'
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : ''

  return message.replace(/^Firebase:\s*/i, '').replace(/^FirebaseError:\s*/i, '') ||
    'Authentication did not complete. Try again.'
}

function Recruitment({ user, onOpenSasha }: RecruitmentProps) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busyProvider, setBusyProvider] = useState('')
  const [panel, setPanel] = useState<'email' | 'phone' | null>(null)

  const [partyCode, setPartyCode] = useState('')
  const [partyUnlocked, setPartyUnlocked] = useState(false)
  const [partyItems, setPartyItems] = useState<string[]>([])
  const [equippedPartyHat, setEquippedPartyHat] = useState('')
  const [equippedPartyBody, setEquippedPartyBody] = useState('')
  const [partyBusy, setPartyBusy] = useState(false)
  const [partyMessage, setPartyMessage] = useState('')
  const [partyError, setPartyError] = useState('')

  const [emailMode, setEmailMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null)
  const phoneLinkingRef = useRef(false)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)

  const [linkedProviders, setLinkedProviders] = useState<string[]>(
    () => user?.providerData.map((provider) => provider.providerId) || [],
  )

  const linkedSet = useMemo(() => new Set(linkedProviders), [linkedProviders])

  useEffect(() => {
    setLinkedProviders(user?.providerData.map((provider) => provider.providerId) || [])
  }, [user])

  useEffect(() => {
    if (!user) {
      setPartyUnlocked(false)
      setPartyItems([])
      setEquippedPartyHat('')
      setEquippedPartyBody('')
      return
    }

    const getStatus = httpsCallable<Record<string, never>, PartyCosmeticsStatus>(
      functions,
      'getPartyCosmeticsStatus',
    )

    void getStatus({})
      .then((result) => {
        setPartyUnlocked(result.data.unlocked === true)
        setPartyItems(Array.isArray(result.data.items) ? result.data.items : [])
        setEquippedPartyHat(result.data.equippedHat || '')
        setEquippedPartyBody(result.data.equippedBody || '')
      })
      .catch((statusError) => {
        console.error('Party cosmetic status failed', statusError)
      })
  }, [user])

  const redeemPartyCode = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !partyCode.trim() || partyBusy) return

    setPartyBusy(true)
    setPartyMessage('')
    setPartyError('')

    try {
      const redeem = httpsCallable<
        { code: string },
        { ok: boolean; unlocked: boolean; items: string[] }
      >(functions, 'redeemPartyCosmetics')

      const result = await redeem({ code: partyCode })
      setPartyUnlocked(result.data.unlocked === true)
      setPartyItems(Array.isArray(result.data.items) ? result.data.items : [])
      setPartyCode('')
      setPartyMessage('PARTY-EXCLUSIVE ITEMS UNLOCKED')
    } catch (redeemError) {
      setPartyError(cleanAuthError(redeemError) || 'That item code was not accepted.')
    } finally {
      setPartyBusy(false)
    }
  }

  const equipPartyItem = async (item: PartyCosmeticItem) => {
    if (!user || !partyUnlocked || partyBusy) return

    setPartyBusy(true)
    setPartyMessage('')
    setPartyError('')

    try {
      const equip = httpsCallable<
        { slot: 'hat' | 'body'; itemId: string },
        { ok: boolean; slot: 'hat' | 'body'; itemId: string }
      >(functions, 'equipPartyCosmetic')

      await equip({ slot: item.slot, itemId: item.id })

      if (item.slot === 'hat') {
        setEquippedPartyHat(item.id)
      } else {
        setEquippedPartyBody(item.id)
      }

      setPartyMessage(`${item.label.toUpperCase()} EQUIPPED`)
    } catch (equipError) {
      setPartyError(cleanAuthError(equipError) || 'That cosmetic could not be equipped.')
    } finally {
      setPartyBusy(false)
    }
  }

  useEffect(
    () => () => {
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    },
    [],
  )

  const refreshLinkedProviders = async () => {
    if (!auth.currentUser) {
      setLinkedProviders([])
      return
    }

    await auth.currentUser.reload()
    setLinkedProviders(auth.currentUser.providerData.map((provider) => provider.providerId))
  }

  const awardProvider = async (providerId: string) => {
    const award = httpsCallable<
      { providerId: string },
      { awarded: boolean; points: number; xp: number }
    >(functions, 'awardLinkedProvider')

    const result = await award({ providerId })
    if (result.data.awarded) {
      setStatus(`Account linked. +${result.data.points} leaderboard XP — ${result.data.xp} XP total.`)
    } else {
      setStatus('Account linked. This sign-in method has already received its link bonus.')
    }
  }

  const handlePopupProvider = async (providerId: string) => {
    setError('')
    setStatus('')
    setBusyProvider(providerId)

    try {
      const provider = providerFor(providerId)

      if (auth.currentUser) {
        if (linkedSet.has(providerId)) {
          setStatus('That sign-in method is already linked to your DANJI profile.')
          return
        }

        await linkWithPopup(auth.currentUser, provider)
        await refreshLinkedProviders()
        await awardProvider(providerId)
      } else {
        await signInWithPopup(auth, provider)
        await refreshLinkedProviders()
        setStatus('Welcome to DANJI. +125 XP awarded: +100 first login and +25 signup bonus.')
      }
    } catch (providerError) {
      setError(cleanAuthError(providerError))
    } finally {
      setBusyProvider('')
    }
  }

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setStatus('')
    setBusyProvider('password')

    try {
      if (auth.currentUser) {
        if (linkedSet.has('password')) {
          setStatus('Email/password is already linked to this DANJI profile.')
          return
        }

        const credential = EmailAuthProvider.credential(email.trim(), password)
        await linkWithCredential(auth.currentUser, credential)
        await refreshLinkedProviders()
        await awardProvider('password')
      } else if (emailMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
        await refreshLinkedProviders()
        setStatus('DANJI membership created. +125 XP awarded: +100 first login and +25 signup bonus.')
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        await refreshLinkedProviders()
        setStatus('Signed in to DANJI.')
      }

      setPassword('')
    } catch (emailError) {
      setError(cleanAuthError(emailError))
    } finally {
      setBusyProvider('')
    }
  }

  const getRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'danji-phone-recaptcha', {
        size: 'normal',
      })
    }

    return recaptchaRef.current
  }

  const resetRecaptcha = () => {
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
  }

  const handleSendPhoneCode = async () => {
    setError('')
    setStatus('')
    setBusyProvider('phone')

    try {
      const verifier = getRecaptcha()
      const linking = Boolean(auth.currentUser)
      phoneLinkingRef.current = linking

      const confirmation = linking && auth.currentUser
        ? await linkWithPhoneNumber(auth.currentUser, phoneNumber.trim(), verifier)
        : await signInWithPhoneNumber(auth, phoneNumber.trim(), verifier)

      setPhoneConfirmation(confirmation)
      setStatus('Verification code sent. Enter the SMS code below.')
    } catch (phoneError) {
      resetRecaptcha()
      setError(cleanAuthError(phoneError))
    } finally {
      setBusyProvider('')
    }
  }

  const handleConfirmPhone = async () => {
    if (!phoneConfirmation) return

    setError('')
    setStatus('')
    setBusyProvider('phone')

    try {
      await phoneConfirmation.confirm(smsCode.trim())
      await refreshLinkedProviders()

      if (phoneLinkingRef.current) {
        await awardProvider('phone')
      } else {
        setStatus('Phone verified. +125 XP awarded: +100 first login and +25 signup bonus.')
      }

      setSmsCode('')
      setPhoneConfirmation(null)
      resetRecaptcha()
    } catch (phoneError) {
      setError(cleanAuthError(phoneError))
    } finally {
      setBusyProvider('')
    }
  }

  const handleProviderClick = (provider: ProviderOption) => {
    if (provider.kind === 'native') {
      setError('')
      setStatus(
        provider.id === 'playgames.google.com'
          ? 'Play Games sign-in is available in DANJI Android/Unity builds, not the web build.'
          : 'Game Center sign-in is available in DANJI iOS builds, not the web build.',
      )
      return
    }

    if (provider.kind === 'email') {
      setPanel(panel === 'email' ? null : 'email')
      return
    }

    if (provider.kind === 'phone') {
      setPanel(panel === 'phone' ? null : 'phone')
      return
    }

    void handlePopupProvider(provider.id)
  }

  return (
    <section className="recruitment-page">
      <div className="recruitment-wrap">
        <div className="eyebrow">
          <span>03</span>
          RECRUITMENT
        </div>

        <div className="recruitment-hero recruitment-auth-hero">
          <div>
            <p className="kicker">DANJI // MEMBER ACCESS</p>
            <h1>{user ? 'Your DANJI ID.' : 'Join DANJI.'}</h1>
            <p>
              First login earns <strong>100 leaderboard XP</strong>, signing up adds
              <strong> +25 XP</strong>, and each new sign-in method linked to the same
              DANJI profile earns another <strong>+25 XP</strong>.
            </p>
          </div>

          <div className="recruitment-score-rules">
            <div><strong>+100</strong><span>FIRST LOGIN</span></div>
            <div><strong>+25</strong><span>SIGN UP / LINK ACCOUNT</span></div>
          </div>
        </div>

        <div className="recruitment-auth-layout">
          <article className="recruitment-card recruitment-card-main recruitment-account-card">
            <span className="card-label">MEMBERSHIP STATUS</span>
            {user ? (
              <>
                <div className="member-status-line">
                  <span className="status-dot" />
                  ACTIVE MEMBER
                </div>
                <div className="recruitment-profile">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{(user.displayName || user.email || 'D').slice(0, 1).toUpperCase()}</span>
                  )}
                  <div>
                    <h2>{user.displayName || 'DANJI Member'}</h2>
                    <p>{user.email || user.phoneNumber || 'Authenticated DANJI account'}</p>
                  </div>
                </div>
                <div className="recruitment-actions">
                  <button className="recruitment-primary" type="button" onClick={onOpenSasha}>
                    TALK TO SASHA <span>↗</span>
                  </button>
                  <button className="recruitment-secondary" type="button" onClick={() => signOut(auth)}>
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
                <h2>Choose how to join.</h2>
                <p>
                  Use any supported web provider below. After your first login,
                  return here to connect more sign-in methods to the same profile.
                </p>
              </>
            )}
          </article>

          <aside className="recruitment-card recruitment-info">
            <span className="card-label">LINK REWARDS</span>
            <strong>ONE DANJI PROFILE.</strong>
            <p>
              Linked providers share the same Firebase user ID, leaderboard score
              and Sasha access. Each supported provider can receive its +25 link
              bonus once.
            </p>
            <div className="recruitment-rule" />
            <span className="recruitment-note">SECURE SERVER-SIDE XP AWARDS</span>
          </aside>
        </div>

        <section className="recruitment-provider-section">
          <div className="recruitment-provider-heading">
            <div>
              <span className="card-label">SIGN-IN PROVIDERS</span>
              <h2>{user ? 'Add another account.' : 'Become a DANJI member.'}</h2>
            </div>
            <span>{linkedProviders.length} LINKED</span>
          </div>

          <div className="provider-grid">
            {providers.map((provider) => {
              const linked = linkedSet.has(provider.id)
              const nativeOnly = provider.kind === 'native'

              return (
                <button
                  type="button"
                  className={[
                    'provider-card',
                    linked ? 'linked' : '',
                    nativeOnly ? 'native-only' : '',
                  ].filter(Boolean).join(' ')}
                  key={provider.id}
                  onClick={() => handleProviderClick(provider)}
                  disabled={busyProvider === provider.id || linked}
                >
                  <span className="provider-icon">{provider.short}</span>
                  <span className="provider-name">
                    <strong>{provider.label}</strong>
                    <small>
                      {linked
                        ? 'LINKED'
                        : nativeOnly
                          ? provider.note
                          : user
                            ? 'LINK +25 XP'
                            : 'SIGN IN'}
                    </small>
                  </span>
                  <span className="provider-arrow">{linked ? '✓' : '↗'}</span>
                </button>
              )
            })}
          </div>

          {panel === 'email' && (
            <form className="auth-detail-panel" onSubmit={handleEmail}>
              <div className="auth-detail-head">
                <div>
                  <span className="card-label">EMAIL / PASSWORD</span>
                  <strong>{user ? 'Link email credentials' : 'Email access'}</strong>
                </div>
                {!user && (
                  <div className="auth-mode-switch">
                    <button
                      type="button"
                      className={emailMode === 'signup' ? 'active' : ''}
                      onClick={() => setEmailMode('signup')}
                    >
                      SIGN UP
                    </button>
                    <button
                      type="button"
                      className={emailMode === 'login' ? 'active' : ''}
                      onClick={() => setEmailMode('login')}
                    >
                      LOG IN
                    </button>
                  </div>
                )}
              </div>
              <div className="auth-fields">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email address"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={user ? 'Create password' : 'Password'}
                  minLength={6}
                  required
                />
                <button type="submit" disabled={busyProvider === 'password'}>
                  {user ? 'LINK +25 XP' : emailMode === 'signup' ? 'CREATE DANJI ID' : 'LOG IN'}
                </button>
              </div>
            </form>
          )}

          {panel === 'phone' && (
            <div className="auth-detail-panel">
              <div className="auth-detail-head">
                <div>
                  <span className="card-label">PHONE</span>
                  <strong>{user ? 'Link a phone number' : 'Phone sign-in'}</strong>
                </div>
              </div>
              <div className="auth-fields phone-fields">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+44..."
                  disabled={Boolean(phoneConfirmation)}
                />
                {!phoneConfirmation ? (
                  <button
                    type="button"
                    onClick={handleSendPhoneCode}
                    disabled={busyProvider === 'phone' || !phoneNumber.trim()}
                  >
                    SEND CODE
                  </button>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={smsCode}
                      onChange={(event) => setSmsCode(event.target.value)}
                      placeholder="6-digit code"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmPhone}
                      disabled={busyProvider === 'phone' || !smsCode.trim()}
                    >
                      VERIFY {user ? '+25 XP' : ''}
                    </button>
                  </>
                )}
              </div>
              <div id="danji-phone-recaptcha" className="danji-phone-recaptcha" />
              <p className="phone-auth-note">
                SMS rates may apply. Phone authentication uses Firebase reCAPTCHA
                protection and your Firebase SMS region policy.
              </p>
            </div>
          )}

          {(status || error) && (
            <div className={error ? 'recruitment-auth-message error' : 'recruitment-auth-message success'}>
              {error || status}
            </div>
          )}
        </section>

        <section className={partyUnlocked ? 'party-drop unlocked' : 'party-drop'}>
          <div className="party-drop-heading">
            <div>
              <span className="card-label">PARTY-EXCLUSIVE DROP</span>
              <h2>{partyUnlocked ? 'Your exclusive DANJI set.' : 'Enter an event code.'}</h2>
              <p>
                These cosmetics are not part of the normal unlock track. A valid private
                event code unlocks the collection permanently on your DANJI account.
              </p>
            </div>
            <span className={partyUnlocked ? 'party-drop-badge unlocked' : 'party-drop-badge'}>
              {partyUnlocked ? 'UNLOCKED' : 'CODE REQUIRED'}
            </span>
          </div>

          {!user ? (
            <div className="party-drop-locked">
              <strong>SIGN IN REQUIRED</strong>
              <p>Become a DANJI member or sign in before redeeming an event code.</p>
            </div>
          ) : !partyUnlocked ? (
            <form className="party-code-form" onSubmit={redeemPartyCode}>
              <label>
                <span>PRIVATE EVENT CODE</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={partyCode}
                  onChange={(event) => setPartyCode(event.target.value)}
                  placeholder="Enter code"
                  maxLength={64}
                />
              </label>
              <button type="submit" disabled={partyBusy || !partyCode.trim()}>
                {partyBusy ? 'CHECKING…' : 'REDEEM ITEMS'}
              </button>
            </form>
          ) : (
            <>
              <div className="party-equipped-summary">
                <span>
                  <small>HAT SLOT</small>
                  <strong>
                    {partyCosmetics.find((item) => item.id === equippedPartyHat)?.label || 'None equipped'}
                  </strong>
                </span>
                <span>
                  <small>BODY SLOT</small>
                  <strong>
                    {partyCosmetics.find((item) => item.id === equippedPartyBody)?.label || 'None equipped'}
                  </strong>
                </span>
              </div>

              <div className="party-cosmetic-grid">
                {partyCosmetics
                  .filter((item) => partyItems.includes(item.id))
                  .map((item) => {
                    const equipped =
                      item.slot === 'hat'
                        ? equippedPartyHat === item.id
                        : equippedPartyBody === item.id

                    return (
                      <article className={equipped ? 'party-cosmetic-card equipped' : 'party-cosmetic-card'} key={item.id}>
                        <div
                          className="party-cosmetic-thumb"
                          style={{ backgroundPosition: `center ${item.spriteY}%` }}
                          aria-label={item.label}
                          role="img"
                        />
                        <div className="party-cosmetic-copy">
                          <span>{item.slot === 'hat' ? 'EXCLUSIVE HAT' : 'EXCLUSIVE BODY'}</span>
                          <strong>{item.label}</strong>
                          <small>PARTY DROP // CODE EXCLUSIVE</small>
                        </div>
                        <button
                          type="button"
                          disabled={partyBusy || equipped}
                          onClick={() => void equipPartyItem(item)}
                        >
                          {equipped ? 'EQUIPPED ✓' : 'EQUIP'}
                        </button>
                      </article>
                    )
                  })}
              </div>
            </>
          )}

          {(partyMessage || partyError) && (
            <div className={partyError ? 'party-drop-feedback error' : 'party-drop-feedback success'}>
              {partyError || partyMessage}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default Recruitment
