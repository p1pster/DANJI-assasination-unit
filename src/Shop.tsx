import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

type ShopProps = {
  user: User | null
  onJoin: () => void
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

const cleanFunctionError = (error: unknown) => {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : ''

  return (
    message
      .replace(/^Firebase:\s*/i, '')
      .replace(/^FirebaseError:\s*/i, '')
      .replace(/^functions\//i, '') ||
    'The promo code could not be checked.'
  )
}

function Shop({ user, onJoin }: ShopProps) {
  const [promoCode, setPromoCode] = useState('')
  const [partyUnlocked, setPartyUnlocked] = useState(false)
  const [partyItems, setPartyItems] = useState<string[]>([])
  const [equippedPartyHat, setEquippedPartyHat] = useState('')
  const [equippedPartyBody, setEquippedPartyBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
        console.error('Shop cosmetic status failed', statusError)
      })
  }, [user])

  const redeemPromoCode = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !promoCode.trim() || busy) return

    setBusy(true)
    setMessage('')
    setError('')

    try {
      const redeem = httpsCallable<
        { code: string },
        { ok: boolean; unlocked: boolean; items: string[]; reward?: string }
      >(functions, 'redeemPromoCode')

      const result = await redeem({ code: promoCode })
      setPartyUnlocked(result.data.unlocked === true)
      setPartyItems(Array.isArray(result.data.items) ? result.data.items : [])
      setPromoCode('')
      setMessage('PROMO CODE ACCEPTED — PARTY EXCLUSIVE SET UNLOCKED')
    } catch (redeemError) {
      setError(cleanFunctionError(redeemError))
    } finally {
      setBusy(false)
    }
  }

  const equipPartyItem = async (item: PartyCosmeticItem) => {
    if (!user || !partyUnlocked || busy) return

    setBusy(true)
    setMessage('')
    setError('')

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

      setMessage(`${item.label.toUpperCase()} EQUIPPED`)
    } catch (equipError) {
      setError(cleanFunctionError(equipError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="shop-page">
      <div className="shop-wrap">
        <div className="eyebrow">
          <span>05</span>
          SHOP
        </div>

        <div className="shop-heading">
          <div>
            <p className="kicker">DANJI // ITEM EXCHANGE</p>
            <h1>Shop.</h1>
            <p>
              Redeem private event promo codes and manage exclusive DANJI cosmetics
              attached to your member account.
            </p>
          </div>
          <div className="shop-status">
            <span>◆</span>
            <strong>PROMO SYSTEM</strong>
            <small>{user ? 'ACCOUNT READY' : 'SIGN IN REQUIRED'}</small>
          </div>
        </div>

        <section className={partyUnlocked ? 'party-drop unlocked' : 'party-drop'}>
          <div className="party-drop-heading">
            <div>
              <span className="card-label">PROMO CODES</span>
              <h2>{partyUnlocked ? 'Party exclusive unlocked.' : 'Redeem a private code.'}</h2>
              <p>
                Promo codes are checked securely by DANJI. Event codes are not
                displayed publicly in the shop and can be shared privately with guests.
              </p>
            </div>
            <span className={partyUnlocked ? 'party-drop-badge unlocked' : 'party-drop-badge'}>
              {partyUnlocked ? 'UNLOCKED' : 'PROMO CODE'}
            </span>
          </div>

          {!user ? (
            <div className="party-drop-locked shop-signin-card">
              <div>
                <strong>SIGN IN REQUIRED</strong>
                <p>Sign in to a DANJI member account before redeeming a promo code.</p>
              </div>
              <button type="button" onClick={onJoin}>SIGN IN / JOIN DANJI</button>
            </div>
          ) : (
            <form className="party-code-form shop-promo-form" onSubmit={redeemPromoCode}>
              <label>
                <span>PROMO CODE</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder="Enter promo code"
                  maxLength={64}
                />
              </label>
              <button type="submit" disabled={busy || !promoCode.trim()}>
                {busy ? 'CHECKING…' : 'REDEEM PROMO CODE'}
              </button>
            </form>
          )}

          {(message || error) && (
            <div className={error ? 'party-drop-feedback error' : 'party-drop-feedback success'}>
              {error || message}
            </div>
          )}
        </section>

        <section className="shop-exclusive-section">
          <div className="shop-exclusive-heading">
            <div>
              <span className="card-label">PARTY EXCLUSIVES</span>
              <h2>Code-only cosmetics.</h2>
            </div>
            <span>{partyUnlocked ? '7 ITEMS OWNED' : 'LOCKED'}</span>
          </div>

          {!partyUnlocked ? (
            <div className="shop-locked-grid">
              {partyCosmetics.map((item) => (
                <article className="party-cosmetic-card locked" key={item.id}>
                  <div
                    className="party-cosmetic-thumb"
                    style={{ backgroundPosition: `center ${item.spriteY}%` }}
                    aria-label={item.label}
                    role="img"
                  />
                  <div className="party-cosmetic-copy">
                    <span>{item.slot === 'hat' ? 'EXCLUSIVE HAT' : 'EXCLUSIVE BODY'}</span>
                    <strong>{item.label}</strong>
                    <small>PROMO CODE EXCLUSIVE</small>
                  </div>
                  <button type="button" disabled>LOCKED</button>
                </article>
              ))}
            </div>
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
                          <small>PARTY DROP // PROMO EXCLUSIVE</small>
                        </div>
                        <button
                          type="button"
                          disabled={busy || equipped}
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
        </section>
      </div>
    </section>
  )
}

export default Shop
