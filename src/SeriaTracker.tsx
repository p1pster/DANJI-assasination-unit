import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Aircraft = {
  hex?: string
  flight?: string
  r?: string
  t?: string
  lat?: number
  lon?: number
  alt_baro?: number | string
  alt_geom?: number
  gs?: number
  track?: number
  baro_rate?: number
  geom_rate?: number
  dbFlags?: number
  seen?: number
}

type Track = {
  hex: string
  callsign: string
  registration: string
  lat: number
  lon: number
  altitudeFt: number
  speedKt: number
  heading: number
  verticalFpm: number
  seen: number
}

type Position = {
  lat: number
  lon: number
  accuracy: number
}

const A380_TYPE = 'A388'

const norm = (degrees: number) => (degrees % 360 + 360) % 360
const toRad = (degrees: number) => (degrees * Math.PI) / 180
const toDeg = (radians: number) => (radians * 180) / Math.PI
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const direction = (degrees: number) =>
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
    Math.round(norm(degrees) / 45) % 8
  ]

const distanceKm = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const earthRadiusKm = 6371
  const deltaLat = toRad(bLat - aLat)
  const deltaLon = toRad(bLon - aLon)
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(deltaLon / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const bearingDeg = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat))
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.cos(toRad(bLon - aLon))

  return norm(toDeg(Math.atan2(y, x)))
}

const radarRange = (distance: number) => {
  for (const range of [10, 25, 50, 100, 200, 400, 800, 1600, 3200, 6400, 12000, 20000]) {
    if (distance <= range) return range
  }

  return 20000
}

const proximity = (distance: number) => {
  if (distance < 2) return 'OVERHEAD / VERY CLOSE'
  if (distance < 10) return 'VERY NEAR'
  if (distance < 35) return 'NEARBY'
  if (distance < 100) return 'IN YOUR REGION'
  if (distance < 400) return 'DISTANT'
  return 'LONG RANGE'
}

const activity = (track: Track) => {
  if (track.altitudeFt < 800 && track.speedKt < 55) return 'On ground / taxiing'
  if (track.verticalFpm > 600) return 'Climbing'
  if (track.verticalFpm < -600) return 'Descending'
  if (track.altitudeFt < 8000 && track.speedKt > 100) return 'Low-altitude transit'
  return 'Cruising'
}

const asTrack = (aircraft: Aircraft): Track | null => {
  if (
    (aircraft.t && aircraft.t !== A380_TYPE) ||
    typeof aircraft.lat !== 'number' ||
    typeof aircraft.lon !== 'number' ||
    aircraft.alt_baro === 'ground'
  ) {
    return null
  }

  // ADSB.lol dbFlags bit 0 indicates military. SERIA is civilian-only.
  if ((Number(aircraft.dbFlags) || 0) & 1) return null

  const altitude =
    typeof aircraft.alt_baro === 'number'
      ? aircraft.alt_baro
      : typeof aircraft.alt_geom === 'number'
        ? aircraft.alt_geom
        : 0

  return {
    hex: String(aircraft.hex || '').toUpperCase(),
    callsign: String(aircraft.flight || '').trim() || String(aircraft.r || 'A380'),
    registration: String(aircraft.r || 'UNKNOWN'),
    lat: aircraft.lat,
    lon: aircraft.lon,
    altitudeFt: Math.round(altitude),
    speedKt: Math.round(Number(aircraft.gs) || 0),
    heading: norm(Number(aircraft.track) || 0),
    verticalFpm: Math.round(Number(aircraft.baro_rate ?? aircraft.geom_rate) || 0),
    seen: Math.round(Number(aircraft.seen) || 0),
  }
}

function SeriaTracker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef(0)
  const soundRef = useRef(false)
  const audioRef = useRef<AudioContext | null>(null)
  const pingArmedRef = useRef(true)

  const [position, setPosition] = useState<Position | null>(null)
  const [target, setTarget] = useState<Track | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [feedStatus, setFeedStatus] = useState('STANDBY')
  const [feedDetail, setFeedDetail] = useState('Waiting for live A380 feed')
  const [locationStatus, setLocationStatus] = useState('Location not enabled')
  const [soundOn, setSoundOn] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const targetDistance = useMemo(
    () =>
      position && target
        ? distanceKm(position.lat, position.lon, target.lat, target.lon)
        : null,
    [position, target],
  )

  const targetBearing = useMemo(
    () =>
      position && target
        ? bearingDeg(position.lat, position.lon, target.lat, target.lon)
        : null,
    [position, target],
  )

  const playPing = useCallback(() => {
    if (!soundRef.current) return

    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioCtx) return

    const context = audioRef.current || new AudioCtx()
    audioRef.current = context

    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(980, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + 0.11)

    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.17)
  }, [])

  const chooseTarget = useCallback(
    (availableTracks: Track[], chooseDifferent = false) => {
      if (!availableTracks.length) {
        setTarget(null)
        return
      }

      const currentHex = target?.hex
      const sorted = [...availableTracks]

      if (position) {
        sorted.sort(
          (a, b) =>
            distanceKm(position.lat, position.lon, a.lat, a.lon) -
            distanceKm(position.lat, position.lon, b.lat, b.lon),
        )
      }

      const next =
        (chooseDifferent ? sorted.find((track) => track.hex !== currentHex) : undefined) ||
        sorted.find((track) => track.hex === currentHex) ||
        sorted[0]

      setTarget(next)
    },
    [position, target?.hex],
  )

  const refresh = useCallback(
    async (chooseDifferent = false) => {
      if (loading) return
      setLoading(true)
      setFeedStatus('SCANNING')

      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('/api/seria-a380', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })

        if (!response.ok) {
          throw new Error(`A380 relay returned ${response.status}`)
        }

        const data = (await response.json()) as {
          ac?: Aircraft[]
          aircraft?: Aircraft[]
        }
        const rows = Array.isArray(data.ac)
          ? data.ac
          : Array.isArray(data.aircraft)
            ? data.aircraft
            : []

        const nextTracks = rows
          .map(asTrack)
          .filter((track): track is Track => Boolean(track))

        setTracks(nextTracks)
        setLastUpdated(new Date())

        if (!nextTracks.length) {
          setTarget(null)
          setFeedStatus('NO LIVE A380')
          setFeedDetail('The live feed returned no airborne civilian A380s.')
        } else {
          chooseTarget(nextTracks, chooseDifferent)
          setFeedStatus('LIVE')
          setFeedDetail(
            `ADSB.lol relay · ${nextTracks.length} airborne civilian A380 target${nextTracks.length === 1 ? '' : 's'}`,
          )
        }
      } catch (error) {
        console.error(error)
        setTarget(null)
        setFeedStatus('OFFLINE')
        setFeedDetail(
          error instanceof Error
            ? error.message
            : 'The live aircraft feed could not be reached.',
        )
      } finally {
        window.clearTimeout(timeout)
        setLoading(false)
      }
    },
    [chooseTarget, loading],
  )

  useEffect(() => {
    void refresh(false)
    const timer = window.setInterval(() => void refresh(false), 30000)
    return () => window.clearInterval(timer)
  }, []) // initial tracker lifecycle only

  useEffect(() => {
    if (tracks.length) chooseTarget(tracks, false)
  }, [position])

  useEffect(() => {
    soundRef.current = soundOn
  }, [soundOn])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current

    if (!canvas || !wrap) return

    const context = canvas.getContext('2d')
    if (!context) return

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    resize()

    const draw = (now: number) => {
      const width = wrap.clientWidth
      const height = wrap.clientHeight
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.455
      const sweep = (now * 0.00105) % (Math.PI * 2)

      context.clearRect(0, 0, width, height)
      context.fillStyle = '#020905'
      context.fillRect(0, 0, width, height)

      context.save()
      context.translate(centerX, centerY)

      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius)
      gradient.addColorStop(0, 'rgba(25, 103, 58, .34)')
      gradient.addColorStop(1, 'rgba(0, 5, 3, .98)')
      context.fillStyle = gradient
      context.beginPath()
      context.arc(0, 0, radius, 0, Math.PI * 2)
      context.fill()

      context.strokeStyle = 'rgba(82, 255, 150, .20)'
      context.lineWidth = 1

      for (let ring = 1; ring <= 4; ring += 1) {
        context.beginPath()
        context.arc(0, 0, (radius * ring) / 4, 0, Math.PI * 2)
        context.stroke()
      }

      for (let angle = 0; angle < 360; angle += 30) {
        const radians = toRad(angle - 90)
        context.beginPath()
        context.moveTo(Math.cos(radians) * 10, Math.sin(radians) * 10)
        context.lineTo(Math.cos(radians) * radius, Math.sin(radians) * radius)
        context.stroke()
      }

      const sweepGradient = context.createRadialGradient(0, 0, 0, 0, 0, radius)
      sweepGradient.addColorStop(0, 'rgba(87, 255, 159, .17)')
      sweepGradient.addColorStop(1, 'rgba(87, 255, 159, 0)')
      context.fillStyle = sweepGradient
      context.beginPath()
      context.moveTo(0, 0)
      context.arc(0, 0, radius, sweep - 0.28, sweep)
      context.closePath()
      context.fill()

      context.strokeStyle = 'rgba(137, 255, 187, .88)'
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(0, 0)
      context.lineTo(Math.cos(sweep) * radius, Math.sin(sweep) * radius)
      context.stroke()
      context.restore()

      context.fillStyle = '#c4ffda'
      context.shadowColor = '#5dff9c'
      context.shadowBlur = 12
      context.beginPath()
      context.arc(centerX, centerY, 4, 0, Math.PI * 2)
      context.fill()
      context.shadowBlur = 0

      if (target) {
        const distance = targetDistance ?? 160
        const bearing = targetBearing ?? target.heading
        const range = radarRange(distance)
        const angle = toRad(bearing - 90)
        const plotRadius = clamp(distance / range, 0, 0.88) * radius
        const x = centerX + Math.cos(angle) * plotRadius
        const y = centerY + Math.sin(angle) * plotRadius

        context.strokeStyle = 'rgba(255, 82, 102, .28)'
        context.setLineDash([4, 6])
        context.beginPath()
        context.moveTo(centerX, centerY)
        context.lineTo(x, y)
        context.stroke()
        context.setLineDash([])

        context.fillStyle = '#ff536d'
        context.shadowColor = '#ff536d'
        context.shadowBlur = 14
        context.beginPath()
        context.arc(x, y, targetDistance !== null && targetDistance < 35 ? 7 : 5, 0, Math.PI * 2)
        context.fill()
        context.shadowBlur = 0

        context.fillStyle = '#ffd8de'
        context.font = '800 10px system-ui'
        context.fillText(target.callsign, x + 10, y - 7)

        const sweepGap = Math.abs(
          Math.atan2(Math.sin(sweep - angle), Math.cos(sweep - angle)),
        )

        if (sweepGap > 0.12) pingArmedRef.current = true
        if (pingArmedRef.current && sweepGap < 0.035) {
          pingArmedRef.current = false
          playPing()
        }
      }

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameRef.current)
    }
  }, [playPing, target, targetBearing, targetDistance])

  useEffect(
    () => () => {
      if (audioRef.current) {
        void audioRef.current.close().catch(() => undefined)
        audioRef.current = null
      }
    },
    [],
  )

  const enableLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is unavailable in this browser.')
      return
    }

    setLocationStatus('Requesting location permission…')

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const nextPosition = {
          lat: result.coords.latitude,
          lon: result.coords.longitude,
          accuracy: result.coords.accuracy,
        }

        setPosition(nextPosition)
        setLocationStatus(
          `${nextPosition.lat.toFixed(2)}°, ${nextPosition.lon.toFixed(2)}° · ±${Math.round(nextPosition.accuracy)} m`,
        )
      },
      () => setLocationStatus('Location permission denied.'),
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 10000,
      },
    )
  }

  const range = targetDistance !== null ? radarRange(targetDistance) : null

  return (
    <section className="seria-page">
      <div className="seria-wrap">
        <div className="eyebrow">
          <span>05</span>
          SERIA TRACKER
        </div>

        <div className="seria-heading">
          <div>
            <p className="kicker">CIVILIAN SIGNAL NODE // LIVE</p>
            <h1>Seria.</h1>
            <p>
              Live civilian Airbus A380-800 tracking. The tracker follows one public
              ADS-B target at a time and excludes aircraft flagged as military.
            </p>
          </div>

          <div className="seria-aircraft-badge">
            <span>✈</span>
            <strong>A380</strong>
            <small>SUPER HEAVY</small>
          </div>
        </div>

        <div className="seria-tags">
          <span>LIVE CIVILIAN ADS-B</span>
          <span>A388 ONLY</span>
          <span>ONE TARGET</span>
          <span>MILITARY EXCLUDED</span>
          <span>30 SEC REFRESH</span>
        </div>

        <div className="seria-layout">
          <article className="seria-radar-card">
            <div className="seria-radar-top">
              <span><i /> {feedStatus}</span>
              <b>{range ? `RANGE ${range.toLocaleString()} KM` : 'RANGE —'}</b>
            </div>

            <div className="seria-radar-wrap" ref={wrapRef}>
              <canvas ref={canvasRef} aria-label="Live civilian Airbus A380 radar" />
              <div className="seria-radar-glass" />
              <div className="seria-center-label">YOU</div>
            </div>

            <div className="seria-radar-bottom">
              <span>
                {targetBearing !== null
                  ? `BRG ${Math.round(targetBearing)}° ${direction(targetBearing)}`
                  : 'BRG —'}
              </span>
              <span>
                {targetDistance !== null
                  ? `DIST ${targetDistance.toFixed(1)} KM`
                  : 'DIST —'}
              </span>
              <span>{soundOn ? 'PING ON SWEEP' : 'PING MUTED'}</span>
            </div>
          </article>

          <aside className="seria-side">
            <article>
              <span className="card-label">CURRENT TRACK</span>
              <div className="seria-plane">✈</div>
              <h2>{target?.callsign || 'NO TARGET'}</h2>
              <strong>{target?.registration || 'A388 · —'}</strong>
              <small>{target ? `ICAO ${target.hex}` : 'Waiting for live feed'}</small>
            </article>

            <article>
              <span className="card-label">YOUR POSITION</span>
              <h3>{locationStatus}</h3>
              <p>
                Your exact location stays in this browser. It is used only to calculate
                bearing, distance and proximity to the selected A380.
              </p>
              <button type="button" onClick={enableLocation}>
                ◎ ENABLE MY LOCATION
              </button>
            </article>

            <article className="seria-controls">
              <button
                type="button"
                onClick={() => {
                  if (tracks.length > 1) {
                    chooseTarget(tracks, true)
                  } else {
                    void refresh(true)
                  }
                }}
              >
                ↻ FIND ANOTHER A380
              </button>
              <button type="button" onClick={() => setSoundOn((value) => !value)}>
                ◉ {soundOn ? 'SWEEP PING ON' : 'ENABLE PROXIMITY BEEP'}
              </button>
              <button type="button" onClick={() => void refresh(false)} disabled={loading}>
                {loading ? 'SCANNING…' : 'REFRESH LIVE FEED'}
              </button>
            </article>

            <article>
              <span className="card-label">FEED STATUS</span>
              <strong>{feedStatus}</strong>
              <p>{feedDetail}</p>
              <small>
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString()}`
                  : 'No successful update yet'}
              </small>
            </article>
          </aside>
        </div>

        <div className="seria-readouts">
          <article>
            <small>TRACKING</small>
            <strong>{target?.callsign || '—'}</strong>
            <span>{target ? `ICAO ${target.hex}` : '—'}</span>
          </article>
          <article>
            <small>ACTIVITY</small>
            <strong>{target ? activity(target) : '—'}</strong>
            <span>
              {target
                ? `${target.verticalFpm >= 0 ? '+' : ''}${target.verticalFpm.toLocaleString()} ft/min`
                : 'Vertical —'}
            </span>
          </article>
          <article>
            <small>DISTANCE</small>
            <strong>
              {targetDistance !== null ? `${targetDistance.toFixed(1)} km` : 'Location needed'}
            </strong>
            <span>{targetDistance !== null ? proximity(targetDistance) : 'Enable location'}</span>
          </article>
          <article>
            <small>HEADING</small>
            <strong>{target ? `${Math.round(target.heading)}°` : '—'}</strong>
            <span>{target ? direction(target.heading) : '—'}</span>
          </article>
          <article>
            <small>SPEED</small>
            <strong>{target ? `${target.speedKt.toLocaleString()} kt` : '—'}</strong>
            <span>{target ? `${Math.round(target.speedKt * 1.852)} km/h` : 'Groundspeed'}</span>
          </article>
          <article>
            <small>ALTITUDE</small>
            <strong>{target ? `${target.altitudeFt.toLocaleString()} ft` : '—'}</strong>
            <span>{target ? `Feed age ${target.seen}s` : '—'}</span>
          </article>
        </div>

        <div className="seria-note">
          <strong>LIVE CIVILIAN TRACKING ONLY</strong>
          <span>
            SERIA uses publicly broadcast civilian ADS-B data. If the provider is
            unavailable, DANJI reports the feed as offline rather than inventing a target.
          </span>
        </div>
      </div>
    </section>
  )
}

export default SeriaTracker
