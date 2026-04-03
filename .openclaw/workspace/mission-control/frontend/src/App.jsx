import { useEffect, useState, useRef } from 'react'

// Prevent ALL horizontal scroll on mobile
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    * { box-sizing: border-box; max-width: 100%; }
    body { overflow-x: hidden; }
    svg { max-width: 100%; height: auto; }
  `
  document.head.appendChild(style)
}

const API_BASE = ''

const fetchState = async () => {
  const res = await fetch(`${API_BASE}/state`)
  if (!res.ok) throw new Error(`Failed to load state: ${res.status}`)
  return res.json()
}

function formatCurrency(num) {
  if (typeof num !== 'number') return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { hour12: false })
}

const formatRelativeMinutes = (minutes) => {
  if (minutes == null) return null
  if (minutes < 60) {
    const precision = minutes < 10 ? 1 : 0
    return `${minutes.toFixed(precision)}m ago`
  }
  const hours = minutes / 60
  const precision = hours < 10 ? 1 : 0
  return `${hours.toFixed(precision)}h ago`
}

const describeSessionKey = (session = {}) => {
  const key = session.key || ''
  if (!key) return 'Session'
  if (key.includes('whatsapp:group')) return 'WhatsApp group'
  if (key.includes('whatsapp:direct')) return 'WhatsApp DM'
  if (key.includes('cron')) return 'Cron job'
  if (key.endsWith(':main')) return 'Main DM'
  if (session.kind === 'group') return 'Group chat'
  if (session.kind === 'direct') return 'Direct chat'
  return key
}

// ── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: '#0a0a0f',
    color: '#ffffff',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    overflow: 'hidden',
  },
  sidebar: {
    width: 220,
    minWidth: 220,
    background: '#0d0d14',
    borderRight: '1px solid #ffffff10',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    flexShrink: 0,
  },
  sidebarLogo: {
    padding: '24px 20px 20px',
    borderBottom: '1px solid #ffffff10',
  },
  logoText: {
    fontSize: 15,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 3,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  nav: {
    padding: '12px 0',
    flex: 1,
  },
  navItem: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? '#3b82f6' : '#9ca3af',
    background: active ? '#3b82f615' : 'transparent',
    borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
    transition: 'all 0.15s ease',
    userSelect: 'none',
  }),
  sidebarBottom: {
    padding: '16px 20px',
    borderTop: '1px solid #ffffff10',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#9ca3af',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 8px #22c55e44',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#0a0a0f',
  },
  topBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    padding: '20px 24px',
    borderBottom: '1px solid #ffffff10',
    flexShrink: 0,
  },
  statCard: {
    background: '#111118',
    border: '1px solid #ffffff15',
    borderRadius: 10,
    padding: '14px 16px',
    boxShadow: '0 2px 8px #00000040',
  },
  statLabel: {
    fontSize: 11,
    color: '#9ca3af',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: 600,
    display: 'block',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
    display: 'block',
    lineHeight: 1.2,
  },
  statSub: {
    fontSize: 12,
    color: '#9ca3af',
    display: 'block',
    marginTop: 4,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderLeft: '3px solid #3b82f6',
    paddingLeft: 10,
  },
  card: {
    background: '#111118',
    border: '1px solid #ffffff15',
    borderRadius: 10,
    padding: '16px',
    boxShadow: '0 2px 8px #00000040',
  },
  pill: (color) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  }),
  progressBar: (pct, color) => ({
    background: '#ffffff15',
    borderRadius: 999,
    height: 4,
    overflow: 'hidden',
    marginTop: 8,
    position: 'relative',
    inner: {
      width: `${Math.min(100, Math.max(0, pct))}%`,
      height: '100%',
      background: color || '#3b82f6',
      borderRadius: 999,
      transition: 'width 0.4s ease',
    },
  }),
}

const statusColor = (status) => {
  if (!status) return '#9ca3af'
  const s = status.toLowerCase()
  if (s === 'active' || s === 'complete' || s === 'done' || s === 'online') return '#22c55e'
  if (s === 'in-progress' || s === 'in_progress' || s === 'running') return '#f97316'
  if (s === 'pending' || s === 'queued') return '#9ca3af'
  if (s === 'error' || s === 'failed') return '#ef4444'
  return '#3b82f6'
}

// ── Components ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }) {
  const clamped = Math.min(100, Math.max(0, pct ?? 0))
  const [displayPct, setDisplayPct] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDisplayPct(clamped))
    return () => cancelAnimationFrame(frame)
  }, [clamped])

  const bar = S.progressBar(clamped, color)
  return (
    <div style={bar}>
      <div style={{ ...bar.inner, width: `${displayPct}%` }} />
    </div>
  )
}

function Pill({ status }) {
  const color = statusColor(status)
  const lower = (status || '').toLowerCase()
  const style = {
    ...S.pill(color),
    ...(lower === 'online' ? { boxShadow: '0 0 8px #22c55e44' } : {}),
  }
  return <span style={style}>{status || 'unknown'}</span>
}

function TopStatCard({ label, children }) {
  return (
    <div style={S.statCard}>
      <span style={S.statLabel}>{label}</span>
      {children}
    </div>
  )
}

function MetricCard({ title, children }) {
  return (
    <div
      style={{
        ...S.card,
        background: 'linear-gradient(135deg, #111118, #1a1a2e)',
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

function RevenueProgressChart({ current = 0, target = 100000 }) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0
  const size = 150
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct / 100)

  return (
    <MetricCard title="Revenue Progress">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1f2937" strokeWidth={strokeWidth} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
          <text
            x="50%"
            y="50%"
            dy="5"
            textAnchor="middle"
            fontSize="20"
            fontWeight="700"
            fill="#ffffff"
          >
            {Math.round(pct)}%
          </text>
        </svg>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          {formatCurrency(current)} / {formatCurrency(target)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>Revenue</div>
      </div>
    </MetricCard>
  )
}

function TaskStatusDonut({ todo = 0, inProgress = 0, done = 0 }) {
  const total = Math.max(todo + inProgress + done, 1)
  const size = 150
  const strokeWidth = 18
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const segments = [
    { label: 'Done', value: done, color: '#22c55e' },
    { label: 'In Progress', value: inProgress, color: '#f97316' },
    { label: 'Todo', value: todo, color: '#6b7280' },
  ]

  let cumulative = 0

  return (
    <MetricCard title="Task Status">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1f2937" strokeWidth={strokeWidth} fill="none" />
          {segments.map((segment) => {
            if (!segment.value) return null
            const dash = (segment.value / total) * circumference
            const dashOffset = circumference - cumulative - dash
            cumulative += dash
            return (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            )
          })}
          <circle cx={size / 2} cy={size / 2} r={radius - strokeWidth} fill="#0a0a0f" stroke="none" />
          <text x="50%" y="50%" dy="-2" textAnchor="middle" fontSize="18" fontWeight="700" fill="#ffffff">
            {todo + inProgress + done}
          </text>
          <text x="50%" y="50%" dy="20" textAnchor="middle" fontSize="11" fill="#9ca3af">
            tasks
          </text>
        </svg>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {segments.map((segment) => (
            <div key={segment.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#d1d5db' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: segment.color }} />
                {segment.label}
              </span>
              <span>{segment.value}</span>
            </div>
          ))}
        </div>
      </div>
    </MetricCard>
  )
}

function OutreachPipelineBar({ segments = [] }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0) || 1

  return (
    <MetricCard title="Outreach Pipeline">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            height: 32,
            borderRadius: 999,
            overflow: 'hidden',
            background: '#ffffff10',
          }}
        >
          {segments.map((segment, idx) => (
            <div
              key={segment.label}
              style={{
                width: `${(segment.count / total) * 100}%`,
                background: segment.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: '#ffffffdd',
                borderRight: idx === segments.length - 1 ? 'none' : '1px solid #0f172a',
              }}
            >
              {segment.count}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {segments.map((segment) => (
            <div key={segment.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#ffffff' }}>{segment.label}</span>
              <span>{segment.note}</span>
            </div>
          ))}
          <div style={{ fontWeight: 600, color: '#d1d5db', marginTop: 4 }}>Total {total} contacts</div>
        </div>
      </div>
    </MetricCard>
  )
}

// ── SVG Charts ───────────────────────────────────────────────────────────────

function ArcGauge({ pct, label, value, size = 120 }) {
  const r = 44, cx = 60, cy = 60
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const filled = arc * Math.min(pct / 100, 1)
  const offset = circ * 0.125
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff10" strokeWidth={10}
          strokeDasharray={`${arc} ${circ}`} strokeDashoffset={-offset} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth={10}
          strokeDasharray={`${filled} ${circ}`} strokeDashoffset={-offset} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">{Math.round(pct)}%</text>
      </svg>
      {value && <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{value}</div>}
      {label && <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>}
    </div>
  )
}

function DonutChart({ segments, size = 100 }) {
  const r = 36, cx = 50, cy = 50, circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = -circ * 0.25
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={14}
          strokeDasharray={`${dash - 2} ${circ}`} strokeDashoffset={-offset} />
        offset += dash
        return el
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">{total}</text>
    </svg>
  )
}

// ── Roadmap View ─────────────────────────────────────────────────────────────

const PHASES = [
  {
    id: 1, label: 'Phase 1 — First Revenue', days: 'Days 1–30', color: '#ef4444',
    goal: '3 paying clients. Prove the model works.',
    target: '$750–$1,800 MRR',
    actions: [
      { text: 'Fix outreach channel (Zoho or alternative SMTP)', done: false },
      { text: 'Send 54-lead batch via email', done: false },
      { text: 'Follow up within 48h on all opens', done: false },
      { text: 'Book 5 discovery calls', done: false },
      { text: 'Close 3 pilots at $250–$600', done: false },
    ],
  },
  {
    id: 2, label: 'Phase 2 — Traction', days: 'Days 31–60', color: '#f97316',
    goal: '15 clients. Establish repeatable sales motion.',
    target: '$9,000–$18,000 MRR',
    actions: [
      { text: 'Systematize outreach — 50 new leads/week via Bulcha', done: false },
      { text: 'Build case studies from Phase 1 pilots', done: false },
      { text: 'Launch X/Twitter content (3 posts/day)', done: false },
      { text: 'Set up LinkedIn outreach tool (Dripify or Expandi)', done: false },
      { text: 'Activate second execution agent if needed', done: false },
    ],
  },
  {
    id: 3, label: 'Phase 3 — Scale', days: 'Days 61–90', color: '#3b82f6',
    goal: '40 clients. Systematize delivery.',
    target: '$24,000–$48,000 MRR',
    actions: [
      { text: 'Build delivery playbook (standardized sprint templates)', done: false },
      { text: 'Automate onboarding and reporting', done: false },
      { text: 'Expand to new lead segments (African startups, DeFi infra)', done: false },
      { text: 'Upsell clients from Starter → Growth → Scale', done: false },
    ],
  },
  {
    id: 4, label: 'Phase 4 — $100K', days: 'Days 91–180', color: '#22c55e',
    goal: '83+ clients at blended $1,200 avg.',
    target: '$100,000+ MRR',
    actions: [
      { text: 'Build productized delivery — reduce custom work per client', done: false },
      { text: 'Add inbound channel (SEO, content, referrals)', done: false },
      { text: 'Expand agent team (Research Agent, Content Agent)', done: false },
      { text: 'Partner with 2–3 agencies for deal flow', done: false },
    ],
  },
]

function RoadmapView() {
  const [blockers, setBlockers] = useState([])
  const [revenue, setRevenue] = useState({ current: 0, target: 100000 })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/state')
        if (res.ok) {
          const data = await res.json()
          setBlockers(data.blockers || [])
          setRevenue({
            current: data.strategic?.revenue?.currentMonthly ?? 0,
            target: data.strategic?.revenue?.targetMonthly ?? 100000,
          })
        }
      } catch (e) {}
    }
    load()
    const interval = setInterval(load, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ ...S.card, background: 'linear-gradient(135deg, #111118, #1a1a2e)', borderLeft: '4px solid #22c55e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>🗺️ Path to $100K/month</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>ATXO Labs · Autonomous Revenue Desk · CEO: Selam</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: revenue.current > 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(revenue.current)}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>of {formatCurrency(revenue.target)} target</div>
            <div style={{ background: '#ffffff15', borderRadius: 4, height: 6, width: 160, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (revenue.current / revenue.target) * 100)}%`, height: '100%', background: '#22c55e', borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Blockers — live from state.json */}
      <div style={S.card}>
        <div style={S.sectionTitle}><span>🚨</span> Current Blockers</div>
        {blockers.length === 0 ? (
          <div style={{ color: '#22c55e', fontSize: 13 }}>✅ No blockers — all clear</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blockers.map((b, i) => {
              const color = b.status === 'blocked' ? '#ef4444' : b.status === 'active' ? '#f97316' : '#9ca3af'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: `${color}10`, borderRadius: 8, border: `1px solid ${color}20` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}20`, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{b.priority}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: '#f3f4f6' }}>{b.text}</span>
                    {b.owner && <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 8 }}>→ {b.owner}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ fontSize: 10, color: '#4b5563', marginTop: 10 }}>Updates every minute from live state</div>
      </div>

      {/* Phases */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {PHASES.map((phase) => (
          <div key={phase.id} style={{ ...S.card, borderTop: `3px solid ${phase.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{phase.label}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{phase.days}</div>
              </div>
              <span style={{ fontSize: 10, color: phase.color, background: `${phase.color}20`, padding: '3px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {phase.target}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>{phase.goal}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {phase.actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: a.done ? '#6b7280' : '#d1d5db' }}>
                  <span style={{ color: a.done ? '#22c55e' : '#4b5563', marginTop: 1, flexShrink: 0 }}>{a.done ? '✓' : '○'}</span>
                  <span style={{ textDecoration: a.done ? 'line-through' : 'none' }}>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div style={S.card}>
        <div style={S.sectionTitle}><span>💰</span> Pricing Tiers</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { name: 'Starter', price: '$250/mo', target: 'SMB, early traction', clients: 400 },
            { name: 'Growth', price: '$600/mo', target: 'Series A companies', clients: 167 },
            { name: 'Scale', price: '$1,200/mo', target: 'High-volume operators', clients: 83 },
          ].map((tier, i) => (
            <div key={i} style={{ padding: '14px', background: '#ffffff06', borderRadius: 8, border: '1px solid #ffffff10', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{tier.name}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>{tier.price}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>{tier.target}</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{tier.clients} clients = $100K</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Token Status ─────────────────────────────────────────────────────────────

function TokenStatus() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/token-status')
        if (res.ok) setData(await res.json())
      } catch (e) {}
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  const barColor = (pct) => {
    if (pct >= 80) return '#ef4444'
    if (pct >= 50) return '#f97316'
    return '#22c55e'
  }

  const sessions = data?.sessions || []

  return (
    <div style={S.card}>
      <div style={S.sectionTitle}>
        <span>🧠</span> Token Usage
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>
          Claude Max · OAuth
        </span>
      </div>
      {sessions.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sessions.map((s, idx) => (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: 11, color: barColor(s.contextPct), fontWeight: 600 }}>
                  {s.contextPct}%
                </span>
              </div>
              {/* Context bar */}
              <div style={{ background: '#ffffff15', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  width: `${Math.min(s.contextPct, 100)}%`,
                  height: '100%',
                  background: barColor(s.contextPct),
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
                <span>{s.contextTokens?.toLocaleString()} / {s.contextLimit?.toLocaleString()} ctx tokens</span>
                <span style={{ color: '#9ca3af' }}>{s.model}</span>
              </div>
              {s.totalTokens > 0 && (
                <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                  {s.inputTokens?.toLocaleString()} in · {s.outputTokens?.toLocaleString()} out
                </div>
              )}
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#4b5563', borderTop: '1px solid #ffffff08', paddingTop: 8 }}>
            ⚠️ Claude Max rate-limits by request, not daily tokens. Context % shows how full each session is.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Agent Comms Live ─────────────────────────────────────────────────────────

// ── Shared helpers ───────────────────────────────────────────────────────────
const agentProfile = (name) => {
  if (name === 'Selam')  return { color: '#3b82f6', avatar: '/avatars/selam.svg',  initials: 'S', border: '#3b82f6' }
  if (name === 'Bulcha') return { color: '#f97316', avatar: '/avatars/bulcha.svg', initials: 'B', border: '#f97316' }
  if (name === 'Merry')  return { color: '#a855f7', avatar: '/avatars/merry.svg',  initials: 'M', border: '#a855f7' }
  if (name === 'Mikael') return { color: '#facc15', avatar: '/avatars/mikael.jpg', initials: 'MK', border: '#facc15' }
  return { color: '#6b7280', avatar: null, initials: '?', border: '#6b7280' }
}

const relTime = (ts) => {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function AgentAvatar({ name, size = 36 }) {
  const p = agentProfile(name)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${p.border}`, flexShrink: 0, overflow: 'hidden', background: p.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: p.color }}>
      {p.avatar
        ? <img src={p.avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} />
        : p.initials}
    </div>
  )
}

// ── Team Chat — natural inter-agent communication ────────────────────────────
function TeamChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/team-chat')
        if (res.ok) {
          const data = await res.json()
          const msgs = (data.messages || []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          setMessages(msgs)
        }
      } catch (e) { /* silent */ }
      finally { setLoading(false) }
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={S.sectionTitle}>
        <span>💬</span> Team Chat
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#22c55e', fontWeight: 400 }}>● LIVE</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 12, padding: '12px 0' }}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>📭 No messages yet</div>
        ) : messages.map((msg, idx) => {
          const p = agentProfile(msg.sender)
          const isBlocker = (msg.text || '').includes('🚨') || (msg.text || '').toUpperCase().includes('BLOCKER')
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, padding: '8px 4px', borderRadius: 8, background: isBlocker ? '#ef444408' : 'transparent' }}>
              <AgentAvatar name={msg.sender} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{msg.sender}</span>
                  {msg.to && <span style={{ fontSize: 10, color: '#4b5563' }}>→ {msg.to}</span>}
                  <span style={{ fontSize: 10, color: '#374151', marginLeft: 'auto' }}>{relTime(msg.timestamp)}</span>
                  {isBlocker && <span style={{ fontSize: 9, color: '#ef4444', background: '#ef444420', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>BLOCKER</span>}
                </div>
                <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.55, wordBreak: 'break-word' }}>{msg.text}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: '#374151', marginTop: 8, textAlign: 'right' }}>Refreshes every 30s</div>
    </div>
  )
}

// ── Token VU Meter — sidebar live token usage bars ───────────────────────────
function TokenVUMeter() {
  const [sessions, setSessions] = useState([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/token-status')
        if (res.ok) {
          const data = await res.json()
          setSessions(data.sessions || [])
        }
      } catch (e) {}
    }
    load()
    const dataIv = setInterval(load, 15000)
    // Flicker tick every 800ms for VU animation
    const tickIv = setInterval(() => setTick(t => t + 1), 800)
    return () => { clearInterval(dataIv); clearInterval(tickIv) }
  }, [])

  const agents = ['Selam', 'Bulcha', 'Merry']
  const agentData = agents.map(name => {
    const s = sessions.find(s => s.label === name) || {}
    const pct = s.contextPct || 0
    // Flicker: add small random delta on each tick to simulate live activity
    const flicker = s.label ? (Math.sin(tick * 1.7 + agents.indexOf(name) * 2.1) * 2.5) : 0
    const displayPct = Math.min(100, Math.max(0, pct + (pct > 0 ? flicker : 0)))
    return { name, pct, displayPct, tokens: s.totalTokens || 0 }
  })

  const barColor = (pct) => {
    if (pct >= 75) return '#ef4444'
    if (pct >= 45) return '#f59e0b'
    return '#22c55e'
  }

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #ffffff08' }}>
      <div style={{ fontSize: 9, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
        Token Usage
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agentData.map(({ name, pct, displayPct, tokens }) => {
          const p = agentProfile(name)
          const color = barColor(pct)
          return (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: p.color }}>{name}</span>
                <span style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>
                  {pct > 0 ? `${Math.round(pct)}%` : '—'}
                </span>
              </div>
              {/* VU bar — segmented */}
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: 20 }).map((_, i) => {
                  const threshold = (i + 1) * 5
                  const lit = displayPct >= threshold
                  const segColor = threshold > 75 ? '#ef4444' : threshold > 45 ? '#f59e0b' : '#22c55e'
                  return (
                    <div key={i} style={{
                      flex: 1, height: 6, borderRadius: 2,
                      background: lit ? segColor : '#1e293b',
                      boxShadow: lit ? `0 0 4px ${segColor}88` : 'none',
                      transition: 'all 0.15s ease',
                    }} />
                  )
                })}
              </div>
              {tokens > 0 && (
                <div style={{ fontSize: 8, color: '#374151', marginTop: 2, fontFamily: 'monospace' }}>
                  {(tokens / 1000).toFixed(1)}k tokens
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Live Activity — execution log / terminal style ───────────────────────────
function LiveActivity() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/agent-comms')
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        }
      } catch (e) { /* silent */ }
      finally { setLoading(false) }
    }
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [])

  const agentTag = (name) => {
    const p = agentProfile(name)
    return (
      <span style={{
        display: 'inline-block',
        fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
        color: p.color, background: p.color + '18',
        border: `1px solid ${p.color}44`,
        borderRadius: 3, padding: '1px 5px', marginRight: 6,
        letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0
      }}>{name}</span>
    )
  }

  return (
    <div style={{ background: '#0a0e1a', borderRadius: 10, border: '1px solid #1e293b', overflow: 'hidden' }}>
      {/* Terminal header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#111827', borderBottom: '1px solid #1e293b' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: '#4b5563', fontFamily: 'monospace', letterSpacing: '0.05em' }}>agent-activity.log</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#22c55e' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          LIVE
        </span>
      </div>
      {/* Log entries */}
      <div style={{ overflowY: 'auto', maxHeight: 300, padding: '8px 0', fontFamily: 'monospace' }}>
        {loading ? (
          <div style={{ color: '#374151', fontSize: 11, padding: '12px 14px' }}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 11, padding: '12px 14px' }}>$ waiting for activity...</div>
        ) : messages.map((msg, idx) => {
          const ts = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''
          const text = (msg.text || '').slice(0, 180)
          const p = agentProfile(msg.sender)
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'flex-start', gap: 0,
              padding: '3px 14px',
              borderBottom: '1px solid #0f172a',
              background: idx % 2 === 0 ? 'transparent' : '#ffffff03',
            }}>
              <span style={{ fontSize: 9, color: '#374151', fontFamily: 'monospace', marginRight: 10, flexShrink: 0, paddingTop: 2 }}>{ts}</span>
              {agentTag(msg.sender)}
              <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {text}{(msg.text || '').length > 180 ? <span style={{ color: '#4b5563' }}>…</span> : ''}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '6px 14px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#374151', fontFamily: 'monospace' }}>$ _</span>
        <span style={{ fontSize: 9, color: '#1e293b', marginLeft: 'auto' }}>refreshes every 20s</span>
      </div>
    </div>
  )
}

// ── Combined panel: Team Chat + Live Activity side by side ───────────────────
function AgentCommsLive() {
  return <TeamChat />
}

// ── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ state, setView = () => {}, isMobile }) {
  const activity = Array.isArray(state?.activity)
    ? state.activity
    : state?.activity
    ? [state.activity]
    : []
  const commits = state?.git?.commits || []
  const tasks = state?.tasks || []
  const normalize = (status) => (status || '').toLowerCase()
  const todoTasks = tasks.filter((t) => ['pending', 'queued', 'todo'].includes(normalize(t.status)))
  const inProgressTasks = tasks.filter((t) => ['active', 'in-progress', 'in_progress', 'running'].includes(normalize(t.status)))
  const doneTasks = tasks.filter((t) => ['complete', 'done'].includes(normalize(t.status)))
  const revenue = state?.strategic?.revenue
  const currentRevenue = revenue?.currentMonthly ?? 0
  const targetRevenue = revenue?.targetMonthly ?? 100000
  const pipelineBatch = state?.pipeline?.batch_20260326 || {}
  const pipelineSegments = [
    {
      label: `Sent (${pipelineBatch.emailsSent ?? 0})`,
      count: pipelineBatch.emailsSent ?? 0,
      note: `${pipelineBatch.replies ?? 0} replies · ${pipelineBatch.callsBooked ?? 0} calls`,
      color: '#22c55e'
    },
    {
      label: `Ready (${(pipelineBatch.total ?? 54) - (pipelineBatch.emailsSent ?? 0)})`,
      count: (pipelineBatch.total ?? 54) - (pipelineBatch.emailsSent ?? 0),
      note: `${pipelineBatch.aGrade ?? 36} A-grade · SMTP blocked`,
      color: '#f97316'
    },
  ].filter(s => s.count > 0)
  const sessions = state?.operations?.sessions || []
  const sessionsMeta = state?.operations?.sessionsMeta || {}
  const displaySessions = sessions.slice(0, isMobile ? 4 : 6)

  // Mobile dashboard — full content, mobile-optimized layout
  if (isMobile) {
    const liveAgents = state?.liveActivities?.agents || []
    const queue = state?.liveActivities?.queue || []
    const agentColors = { Selam: '#3b82f6', Bulcha: '#f97316', Merry: '#a855f7' }
    const agentIcons = { Selam: '⚙️', Bulcha: '📬', Merry: '💼' }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Revenue — full width slim bar */}
        <div style={{ ...S.card, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>💰 Revenue</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>$0 <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>/ $100K</span></span>
          </div>
          <div style={{ background: '#ffffff15', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: '0%', height: '100%', background: '#22c55e', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
            <span>Phase 1 of 4 — First Revenue</span>
            <span>0%</span>
          </div>
        </div>

        {/* Task status — inline row */}
        <div style={{ ...S.card, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>📋 Tasks</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
            {[
              { label: 'To Do', value: todoTasks.length, color: '#6b7280' },
              { label: 'Active', value: inProgressTasks.length, color: '#f97316' },
              { label: 'Done', value: doneTasks.length, color: '#22c55e' },
            ].map((t, i) => (
              <div key={i} style={{ background: '#ffffff06', borderRadius: 8, padding: '10px 4px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.color }}>{t.value}</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline numbers */}
        <div style={{ ...S.card, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📬 Outreach</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
            {[
              { label: 'Leads', value: pipelineBatch.total ?? 54, color: '#3b82f6' },
              { label: 'Sent', value: pipelineBatch.emailsSent ?? 0, color: '#22c55e' },
              { label: 'Replies', value: pipelineBatch.replies ?? 0, color: '#f97316' },
              { label: 'Calls', value: pipelineBatch.callsBooked ?? 0, color: '#a855f7' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#ffffff06', borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Status */}
        <div style={{ ...S.card, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🤖 Agent Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {liveAgents.map((agent, i) => {
              const color = agentColors[agent.name] || '#9ca3af'
              const icon = agentIcons[agent.name] || '🤖'
              const statusColor = agent.status === 'active' ? '#22c55e' : agent.status === 'blocked' ? '#ef4444' : '#9ca3af'
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>{agent.name}</span>
                      <span style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>{agent.status?.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>{agent.currentTask}</div>
                    {agent.blockers && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠️ {agent.blockers}</div>}
                    {agent.progress != null && (
                      <div style={{ background: '#ffffff15', borderRadius: 4, height: 3, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${agent.progress}%`, height: '100%', background: color }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Team Chat */}
        <TeamChat />

        {/* Live Activity */}
        <LiveActivity />

        {/* Queue */}
        {queue.length > 0 && (
          <div style={{ ...S.card, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Priority Queue</div>
            {queue.map((q, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < queue.length - 1 ? '1px solid #ffffff08' : 'none' }}>
                <span style={{ fontSize: 12, color: '#d1d5db', flex: 1, paddingRight: 8 }}>{q.task}</span>
                <span style={{ fontSize: 10, color: q.priority === 'urgent' ? '#ef4444' : '#f97316', fontWeight: 700, whiteSpace: 'nowrap' }}>{q.assignee}</span>
              </div>
            ))}
          </div>
        )}

        {/* Gateway Sessions */}
        {displaySessions.length > 0 && (
          <div style={{ ...S.card, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔌 Sessions</div>
            {displaySessions.map((session, idx) => (
              <div key={idx} style={{ padding: '6px 0', borderBottom: idx < displaySessions.length - 1 ? '1px solid #ffffff08' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#d1d5db' }}>{describeSessionKey(session)}</span>
                  <Pill status={session.kind || session.agent} />
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{session.model} · {formatDateTime(session.updatedAt)}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    )
  }

  const metricsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
    marginBottom: 24,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={metricsGridStyle}>
        <RevenueProgressChart current={currentRevenue} target={targetRevenue} />
        <TaskStatusDonut
          todo={todoTasks.length}
          inProgress={inProgressTasks.length}
          done={doneTasks.length}
        />
        <OutreachPipelineBar segments={pipelineSegments} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
        {/* Left column — Team Chat */}
        <AgentCommsLive />

        {/* Right column — Agent Status + Token + Commits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Live Activity */}
          <LiveActivity />

          {/* Token Usage */}
          <TokenStatus />

          {/* Git commits */}
          <div style={S.card}>
            <div style={S.sectionTitle}>
              <span>📦</span> Recent Commits
            </div>
            {commits.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 14 }}>No commits tracked.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {commits.slice(0, 5).map((c, idx) => (
                  <div key={idx} style={{ fontSize: 13, color: '#d1d5db', padding: '6px 0', borderBottom: '1px solid #ffffff08' }}>
                    <span style={{ color: '#3b82f6', fontFamily: 'monospace', marginRight: 8, fontSize: 11 }}>
                      {c.sha?.slice(0, 7) || '—'}
                    </span>
                    {c.message || c.msg || c}
                    {c.author && <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{c.author}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gateway sessions */}
          <div style={S.card}>
            <div style={S.sectionTitle}>
              <span>🔌</span> Gateway Sessions
            </div>
            {displaySessions.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Waiting for live session data.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {displaySessions.map((session, idx) => {
                  const tokenCount = session.totalTokens ?? session.inputTokens ?? session.outputTokens
                  return (
                    <div
                      key={session.key || idx}
                      style={{
                        padding: '8px 0',
                        borderBottom: idx === displaySessions.length - 1 ? 'none' : '1px solid #ffffff08',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{describeSessionKey(session)}</div>
                        <Pill status={session.kind || session.agent} />
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {session.model || '—'} · {formatDateTime(session.updatedAt)}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {formatRelativeMinutes(session.ageMinutes) || '—'}
                        {tokenCount != null && (
                          <span> · {tokenCount.toLocaleString()} tokens</span>
                        )}
                      </div>
                      {session.key && (
                        <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2, fontFamily: 'monospace' }}>{session.key}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {sessionsMeta.retrievedAt && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 12 }}>
                Updated {formatDateTime(sessionsMeta.retrievedAt)} · {sessions.length} total
              </div>
            )}
          </div>

          {/* Quick links */}
          <div style={S.card}>
            <div style={S.sectionTitle}>
              <span>🔗</span> Quick Links
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Workshop Queue', view: 'workshop', icon: '🛠️' },
                { label: 'Agents', view: 'agents', icon: '🤖' },
                { label: 'Documents', view: 'documents', icon: '📄' },
                { label: 'Cron Jobs', view: 'cron', icon: '⏱️' },
              ].map((link) => (
                <a
                  key={link.label}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setView(link.view)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    background: '#ffffff06',
                    borderRadius: 8,
                    border: '1px solid #ffffff0a',
                    color: '#9ca3af',
                    fontSize: 13,
                    textDecoration: 'none',
                    transition: 'color 0.15s',
                  }}
                >
                  <span>{link.icon}</span>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Agents View ──────────────────────────────────────────────────────────────

const SELAM = {
  name: 'Selam',
  role: 'CEO',
  icon: '⚙️',
  status: 'active',
  focus: 'Building autonomous revenue systems to $100K/month.',
  mission: 'Build and operate systems that generate $100k/month in revenue. Lead all AI workers, originate ideas, execute with speed.',
  activeTask: 'Mission Control dashboard + outreach pipeline',
  progress: 68,
  avatar: '/avatars/selam.svg',
}

const CHAIRMAN = {
  name: 'Mikael',
  role: 'Chairman & Founder',
  icon: '👑',
  status: 'principal',
  focus: 'Sets direction, capital strategy, and oversight.',
  avatar: '/avatars/mikael.jpg',
}

const BULCHA_AGENT = {
  name: 'Bulcha',
  role: 'Director, Outreach Ops',
  icon: '📬',
  status: 'active',
  focus: 'Lead sourcing, enrichment & send logging',
  avatar: '/avatars/bulcha.svg',
}

const MERRY_AGENT = {
  name: 'Merry',
  role: 'Closer Agent',
  icon: '💼',
  status: 'active',
  focus: 'Converts warm replies to booked calls & closed pilots',
  avatar: '/avatars/merry.svg',
}

const FUTURE_AGENTS = [
  { name: 'Research Agent', role: 'Head of Research', icon: '🔬', status: 'hiring', focus: 'Hiring — insights + enrichment engine' },
  { name: 'Content Agent', role: 'Head of Content', icon: '✍️', status: 'hiring', focus: 'Hiring — narrative + distribution' },
]

// All execution agents under Selam
const EXECUTION_AGENTS = [BULCHA_AGENT, MERRY_AGENT, ...FUTURE_AGENTS]

function OrgCard({ agent, isMobile }) {
  const status = (agent.status || '').toLowerCase()
  const palette = {
    principal: { color: '#facc15', bg: '#facc1522', border: '#facc1544' },
    active: { color: '#22c55e', bg: '#22c55e22', border: '#22c55e44' },
    hiring: { color: '#9ca3af', bg: '#9ca3af22', border: '#9ca3af44' },
  }
  const tone = palette[status] || { color: '#3b82f6', bg: '#3b82f622', border: '#3b82f644' }
  const statusLabel = agent.statusLabel || (agent.status ? agent.status.charAt(0).toUpperCase() + agent.status.slice(1) : 'Status')

  return (
    <div
      style={{
        ...S.card,
        width: isMobile ? '100%' : 180,
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
        padding: 16,
        background: 'linear-gradient(135deg, #111118, #1a1a2e)',
        opacity: status === 'hiring' ? 0.85 : 1,
      }}
    >
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        {agent.avatar ? (
          <img src={agent.avatar} alt={agent.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tone.border}` }}
            onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
          />
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#0f172a', border: `2px solid ${tone.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
            {agent.icon || '🤖'}
          </div>
        )}
        {status !== 'hiring' && (
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: tone.color, boxShadow: `0 0 6px ${tone.color}`, border: '2px solid #111118' }} />
        )}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{agent.name}</div>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>{agent.role}</div>
      <span
        style={{
          padding: '4px 12px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: tone.bg,
          color: tone.color,
          border: `1px solid ${tone.border}`,
        }}
      >
        {statusLabel}
      </span>
      {agent.focus && <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.4 }}>{agent.focus}</div>}
    </div>
  )
}

function OrgConnector({ orientation = 'vertical', length = 32, style = {} }) {
  const sizeValue = typeof length === 'number' ? `${length}px` : length
  if (orientation === 'horizontal') {
    return (
      <div
        style={{
          width: sizeValue,
          borderTop: '2px solid #ffffff20',
          ...style,
        }}
      />
    )
  }
  return (
    <div
      style={{
        height: sizeValue,
        borderLeft: '2px solid #ffffff20',
        ...style,
      }}
    />
  )
}

function AgentCard({ agent }) {
  const sc = statusColor(agent.status)
  const pillColor = agent.status === 'hiring' ? '#6b7280' : agent.status === 'principal' ? '#f59e0b' : sc
  const avatarSrc = agent.avatar || null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px', background: agent.status === 'hiring' ? '#0d0d14' : '#111118', border: `1px solid ${agent.status === 'hiring' ? '#ffffff0a' : '#ffffff20'}`, borderRadius: 12, opacity: agent.status === 'hiring' ? 0.55 : 1, minWidth: 140, maxWidth: 160 }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        {avatarSrc ? (
          <img src={avatarSrc} alt={agent.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${pillColor}44` }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1a1a2e', border: `2px solid ${pillColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
            {agent.icon}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: pillColor, boxShadow: `0 0 6px ${pillColor}`, border: '2px solid #0d0d14' }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'center' }}>{agent.name}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>{agent.role}</div>
      <span style={{ ...S.pill(pillColor), fontSize: 10 }}>{agent.status}</span>
      {agent.focus && <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', lineHeight: 1.4 }}>{agent.focus}</div>}
    </div>
  )
}

function Connector({ horizontal }) {
  return horizontal
    ? <div style={{ width: 48, height: 2, background: '#ffffff20', alignSelf: 'center' }} />
    : <div style={{ width: 2, height: 24, background: '#ffffff20', margin: '0 auto' }} />
}

function AgentsView({ state, isMobile }) {
  const selamLive = state?.operations?.ai_workers?.find(w => w.name === 'Selam')
  // OrgCard shows mission, not operational log
  const ceo = { ...SELAM, status: selamLive?.status || SELAM.status }
  const orgAgents = [ceo, BULCHA_AGENT, MERRY_AGENT]
  const directReports = [BULCHA_AGENT, MERRY_AGENT, ...FUTURE_AGENTS]
  const [liveActivity, setLiveActivity] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/live-activity')
        if (res.ok) {
          const data = await res.json()
          setLiveActivity(data.agents || {})
        }
      } catch (e) {}
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const relativeTime = (ts) => {
    if (!ts) return ''
    const diff = (Date.now() - new Date(ts).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <div style={S.sectionTitle}>
          <span>🏗️</span> Corporate Structure
        </div>
        <div style={{ ...S.card, padding: isMobile ? 16 : 32 }}>

          {/* Mikael — above the structure, human owner */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: '#facc15', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              👑 Human Principal
            </div>
            <div style={{ ...S.card, background: 'linear-gradient(135deg, #1a1500, #2a2000)', border: '1px solid #facc1540', padding: '16px 32px', textAlign: 'center', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/avatars/mikael.jpg" alt="Mikael" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #facc15' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Mikael</div>
                  <div style={{ fontSize: 12, color: '#facc15' }}>Chairman & Founder</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Sets direction. Final authority.</div>
                </div>
              </div>
            </div>
            <div style={{ width: 2, height: 24, background: '#facc1540', margin: '0 auto' }} />
            <div style={{ fontSize: 10, color: '#4b5563', fontStyle: 'italic' }}>AI Agents operate autonomously below</div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px dashed #ffffff15', marginBottom: 24 }} />

          {/* AI Agent org chart */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <OrgCard agent={ceo} isMobile={isMobile} />
            <OrgConnector length={isMobile ? 20 : 32} />
            <div style={{ width: '100%', maxWidth: 720 }}>
              {!isMobile && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <OrgConnector orientation="horizontal" length="70%" style={{ marginBottom: 16 }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'flex-start', justifyContent: 'center', gap: 16 }}>
                {directReports.map((agent) => (
                  <div key={agent.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: isMobile ? '100%' : 'auto' }}>
                    <OrgConnector length={24} />
                    <OrgCard agent={agent} isMobile={isMobile} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={S.sectionTitle}>
          <span>📡</span> Live Activity by Agent
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {orgAgents.map((agent) => {
            const live = liveActivity[agent.name] || {}
            return (
              <div key={agent.name} style={{ ...S.card, background: 'linear-gradient(135deg,#111118,#1a1a2e)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {agent.avatar
                    ? <img src={agent.avatar} alt={agent.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none' }} />
                    : <span style={{ fontSize: 24 }}>{agent.icon}</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{agent.role}</div>
                  </div>
                  <Pill status={live.status || agent.status} />
                </div>
                {live.lastMessage ? (
                  <div>
                    <div style={{ fontSize: 13, color: '#e5e7eb', lineHeight: 1.6 }}>
                      {live.lastMessage}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                      {relativeTime(live.timestamp)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>{agent.focus}</div>
                )}
              </div>
            )
          })}
          {FUTURE_AGENTS.map((agent) => (
            <div key={agent.name} style={{ ...S.card, opacity: 0.5, borderStyle: 'dashed' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{agent.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{agent.role}</div>
                </div>
                <Pill status="hiring" />
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Position open — {agent.focus}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


// ── Workshop View ────────────────────────────────────────────────────────────

function WorkshopView({ state }) {
  const tasks = state?.tasks || []

  const fallbackTasks = [
    { title: 'Mission Control Dashboard', status: 'in-progress', priority: 'high', description: 'Build full dark-themed React dashboard for AI ops visibility.', progress: 85 },
    { title: 'Outreach Pipeline', status: 'pending', priority: 'high', description: 'Automate lead discovery, enrichment, and first-touch outreach.', progress: 10 },
    { title: 'State API Integration', status: 'complete', priority: 'medium', description: 'Connect frontend to backend /state endpoint with 30s polling.', progress: 100 },
  ]

  const items = tasks.length > 0 ? tasks : fallbackTasks

  const taskColor = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'complete' || s === 'done') return '#22c55e'
    if (s === 'in-progress' || s === 'in_progress' || s === 'active' || s === 'running') return '#f97316'
    return '#9ca3af'
  }

  const prioColor = (p) => {
    if (!p) return '#9ca3af'
    const s = p.toLowerCase()
    if (s === 'high' || s === 'urgent') return '#ef4444'
    if (s === 'medium') return '#f97316'
    return '#9ca3af'
  }

  return (
    <div>
      <div style={S.sectionTitle}>Workshop — {items.length} tasks</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {items.map((task, idx) => (
          <div key={idx} style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{task.title}</div>
              <Pill status={task.status} />
            </div>
            {task.priority && (
              <div style={{ fontSize: 12 }}>
                <span style={{ color: '#9ca3af' }}>Priority: </span>
                <span style={{ color: prioColor(task.priority), fontWeight: 600 }}>{task.priority}</span>
              </div>
            )}
            {task.description && (
              <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>{task.description}</div>
            )}
            {task.owner && (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Owner: <span style={{ color: '#d1d5db' }}>{task.owner}</span> {task.due && <span>· Due {task.due}</span>}</div>
            )}
            {/* Sub-activities */}
            {task.activities && task.activities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Activities</div>
                {task.activities.map((act, ai) => (
                  <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: act.done ? '#6b7280' : '#d1d5db' }}>
                    <span style={{ fontSize: 10, color: act.done ? '#22c55e' : '#f97316' }}>{act.done ? '✓' : '○'}</span>
                    <span style={{ textDecoration: act.done ? 'line-through' : 'none' }}>{act.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
                <span>Progress</span>
                <span>{task.progress ?? 0}%</span>
              </div>
              <ProgressBar pct={task.progress ?? 0} color={taskColor(task.status)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Cron Jobs View ───────────────────────────────────────────────────────────

function CronView({ state }) {
  const cronJobs = state?.operations?.cron || []
  const cronMeta = state?.operations?.cronMeta || {}

  const fallbackCrons = [
    {
      name: 'Heartbeat',
      description: 'Periodic health check and context sync for Selam.',
      schedule: 'Every 20 minutes',
      nextRun: 'In ~12 min',
      status: 'active',
    },
    {
      name: 'Samri Nudge',
      description: 'Scheduled follow-up nudge for Samri outreach.',
      schedule: '2026-03-26 19:41 EAT',
      nextRun: '2026-03-26 19:41 EAT',
      status: 'pending',
    },
  ]

  const items = cronJobs.length > 0 ? cronJobs : fallbackCrons

  return (
    <div>
      <div style={S.sectionTitle}>Cron Jobs — {items.length} scheduled</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {items.map((job, idx) => (
          <div key={idx} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{job.name}</div>
              <Pill status={job.status} />
            </div>
            {job.description && (
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12, lineHeight: 1.5 }}>{job.description}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <span style={{ color: '#9ca3af', minWidth: 72 }}>Schedule</span>
                <span style={{ color: '#d1d5db', fontFamily: 'monospace' }}>{job.schedule || job.cron || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <span style={{ color: '#9ca3af', minWidth: 72 }}>Next run</span>
                <span style={{ color: '#3b82f6' }}>{job.nextRun || job.next_run || '—'}</span>
              </div>
              {job.lastRun && (
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#9ca3af', minWidth: 72 }}>Last run</span>
                  <span style={{ color: '#d1d5db' }}>{formatDateTime(job.lastRun)}</span>
                </div>
              )}
              {job.lastRunStatus && (
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#9ca3af', minWidth: 72 }}>Last status</span>
                  <span style={{ color: job.lastRunStatus === 'ok' ? '#22c55e' : '#f97316' }}>{job.lastRunStatus}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {cronMeta.retrievedAt && (
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>
          Updated {formatDateTime(cronMeta.retrievedAt)} · {cronMeta.count ?? items.length} jobs total
        </div>
      )}
    </div>
  )
}

// ── Documents View ───────────────────────────────────────────────────────────

function DocumentsView({ state }) {
  const docs = state?.documents || []

  return (
    <div>
      <div style={S.sectionTitle}>Documents</div>

      {/* Upload area */}
      <div
        style={{
          ...S.card,
          marginBottom: 24,
          border: '2px dashed #3b82f640',
          textAlign: 'center',
          padding: '32px 24px',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Drop files here to upload</div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>or click to browse — PDF, Markdown, TXT supported</div>
        <div style={{ marginTop: 16 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              background: '#3b82f620',
              border: '1px solid #3b82f640',
              borderRadius: 8,
              color: '#3b82f6',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Browse Files
          </span>
        </div>
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
          No documents cataloged yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {docs.map((doc, idx) => (
            <div
              key={idx}
              style={{
                ...S.card,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 16px',
              }}
            >
              <span style={{ fontSize: 24 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                  {doc.title || doc.slug || doc.path}
                </div>
                {doc.summary && <div style={{ fontSize: 12, color: '#9ca3af' }}>{doc.summary}</div>}
              </div>
              {doc.updated && <div style={{ fontSize: 11, color: '#9ca3af' }}>Updated {doc.updated}</div>}
              <a
                href={`${API_BASE}/docs/${doc.slug}`}
                download
                style={{
                  fontSize: 12,
                  color: '#3b82f6',
                  textDecoration: 'none',
                  padding: '4px 12px',
                  border: '1px solid #3b82f640',
                  borderRadius: 6,
                }}
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Conventions View ─────────────────────────────────────────────────────────

function ConventionsView() {
  const [conventions, setConventions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedSections, setExpandedSections] = useState(new Set())

  useEffect(() => {
    const loadConventions = async () => {
      try {
        const res = await fetch(`${API_BASE}/conventions`)
        if (!res.ok) throw new Error(`Failed to load conventions: ${res.status}`)
        const data = await res.json()
        setConventions(data)
        // Expand all sections by default
        setExpandedSections(new Set(data.sections?.map((_, i) => i) || []))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadConventions()
  }, [])

  const toggleSection = (idx) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedSections(newExpanded)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#9ca3af' }}>
        Loading conventions...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ef4444' }}>
        Error loading conventions: {error}
      </div>
    )
  }

  return (
    <div>
      <div style={S.sectionTitle}>
        <span>📐</span> Communication Conventions
      </div>
      
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
        {conventions?.overview}
        {conventions?.lastUpdated && (
          <span style={{ marginLeft: 8, color: '#6b7280' }}>
            (Updated: {conventions.lastUpdated})
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {conventions?.sections?.map((section, idx) => {
          const isExpanded = expandedSections.has(idx)
          return (
            <div key={idx} style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              {/* Section Header */}
              <div
                onClick={() => toggleSection(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 20px',
                  background: '#111118',
                  borderBottom: isExpanded ? '1px solid #ffffff10' : 'none',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 20 }}>{section.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
                  {section.title}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>

              {/* Section Content */}
              {isExpanded && (
                <div style={{ padding: '16px 20px' }}>
                  {/* Agent Hierarchy */}
                  {section.content && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {section.content.map((item, i) => (
                        <div key={i} style={{ 
                          padding: '12px 16px', 
                          background: '#ffffff06', 
                          borderRadius: 8,
                          borderLeft: `3px solid ${item.level === 1 ? '#facc15' : item.level === 2 ? '#3b82f6' : '#22c55e'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.role}</span>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>Level {item.level}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{item.description}</div>
                          <div style={{ fontSize: 11, color: '#3b82f6' }}>{item.communication}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Communication Channels */}
                  {section.channels && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {section.channels.map((channel, i) => (
                        <div key={i} style={{ padding: '12px 16px', background: '#ffffff06', borderRadius: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{channel.name}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}><strong>Method:</strong> {channel.method}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}><strong>Use for:</strong> {channel.useFor}</div>
                          <div style={{ fontSize: 12, color: '#3b82f6' }}><strong>Format:</strong> {channel.format}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Format Standards */}
                  {section.standards && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {section.standards.map((std, i) => (
                        <div key={i} style={{ padding: '12px 16px', background: '#ffffff06', borderRadius: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{std.type}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{std.from}</div>
                          <code style={{ 
                            display: 'block',
                            fontSize: 11, 
                            color: '#22c55e', 
                            background: '#0d0d14',
                            padding: '8px 12px',
                            borderRadius: 4,
                            fontFamily: 'ui-monospace, monospace'
                          }}>{std.format}</code>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Escalation Rules */}
                  {section.rules && (
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#d1d5db', fontSize: 13, lineHeight: 1.8 }}>
                      {section.rules.map((rule, i) => (
                        <li key={i}>{rule}</li>
                      ))}
                    </ul>
                  )}

                  {/* File Naming Conventions */}
                  {section.patterns && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {section.patterns.map((pat, i) => (
                        <div key={i} style={{ padding: '12px 16px', background: '#ffffff06', borderRadius: 8 }}>
                          <code style={{ 
                            fontSize: 12, 
                            color: '#f97316', 
                            background: '#0d0d14',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontFamily: 'ui-monospace, monospace'
                          }}>{pat.pattern}</code>
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{pat.use}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Response Protocols */}
                  {section.protocols && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {section.protocols.map((proto, i) => (
                        <div key={i} style={{ padding: '12px 16px', background: '#ffffff06', borderRadius: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Trigger: {proto.trigger}</div>
                          <div style={{ fontSize: 12, color: '#22c55e' }}>{proto.response}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Assignments View ─────────────────────────────────────────────────────────

const SELAM_TASKS = [
  {
    id: 'selam-1',
    title: 'Unblock Email Outreach',
    description: 'Zoho SMTP blocked. Bulcha setting up SendGrid. Once live, authorize send of 54 leads from batch_20260326.',
    priority: 'urgent',
    status: 'in-progress',
    due: '2026-03-31',
    category: 'Revenue',
    progress: 40,
  },
  {
    id: 'selam-2',
    title: 'Permanent URL — mc.atxo.me',
    description: 'Cloudflare tunnel configured. mc.atxo.me live. Monitor uptime and ensure auto-restart works.',
    priority: 'high',
    status: 'complete',
    due: '2026-03-30',
    category: 'Infrastructure',
    progress: 100,
  },
  {
    id: 'selam-3',
    title: 'Activate Merry (Closer Agent)',
    description: 'Merry onboarded, cron monitoring inbox every 30min. Waiting on first lead replies to qualify and convert.',
    priority: 'high',
    status: 'complete',
    due: '2026-03-30',
    category: 'Operations',
    progress: 100,
  },
  {
    id: 'selam-4',
    title: 'Book First Discovery Call',
    description: 'Target: at least 1 discovery call booked by April 5. Depends on email outreach going live.',
    priority: 'high',
    status: 'pending',
    due: '2026-04-05',
    category: 'Revenue',
    progress: 0,
  },
  {
    id: 'selam-5',
    title: 'Close First Pilot',
    description: 'Target $250–$1,200 pilot deal. Coordinate with Merry on qualified leads. Define sprint scope and onboard first client.',
    priority: 'high',
    status: 'pending',
    due: '2026-04-30',
    category: 'Revenue',
    progress: 0,
  },
]

const MERRY_TASKS = [
  {
    id: 'merry-1',
    title: 'Monitor Inbox — selam@atxo.me',
    description: 'Check for replies to Bulcha\'s outreach every 30 minutes. Qualify each lead using the fit framework.',
    priority: 'high',
    status: 'active',
    due: 'ongoing',
    category: 'Closing',
    progress: 10,
  },
  {
    id: 'merry-2',
    title: 'Book 2 Discovery Calls',
    description: 'First 2 qualified calls booked. Use playbook: interest → qualify → schedule 20-min call.',
    priority: 'high',
    status: 'pending',
    due: '2026-04-07',
    category: 'Closing',
    progress: 0,
  },
  {
    id: 'merry-3',
    title: 'Close First Pilot Deal',
    description: 'Convert 1 call into a signed pilot at $600 Growth tier. Handle objections, send proposal, confirm payment.',
    priority: 'high',
    status: 'pending',
    due: '2026-04-30',
    category: 'Revenue',
    progress: 0,
  },
]

const BULCHA_TASKS = [
  {
    id: 'bulcha-1',
    title: 'Lead Research — Tier 1 Targets',
    description: 'Research d.light, Gebeya, Chipper Cash, Nala, Ampersand. Find decision makers, verify emails, identify recent triggers.',
    priority: 'high',
    status: 'pending',
    due: '2026-03-30',
    category: 'Outreach',
    progress: 0,
  },
  {
    id: 'bulcha-2',
    title: 'Lead Research — Tier 2 Targets',
    description: 'Research Apollo Agriculture, BasiGo, Sun King, Twiga Foods, Wasoko. Same drill: contacts, emails, triggers.',
    priority: 'medium',
    status: 'pending',
    due: '2026-04-02',
    category: 'Outreach',
    progress: 0,
  },
  {
    id: 'bulcha-3',
    title: 'Outreach Send Log Maintenance',
    description: 'Track all sent emails, opens, clicks, replies. Update CSV log daily. Flag bounces and invalid emails.',
    priority: 'high',
    status: 'pending',
    due: 'ongoing',
    category: 'Operations',
    progress: 30,
  },
  {
    id: 'bulcha-4',
    title: 'Email Sequence A/B Testing',
    description: 'Set up 2 variants of Email 1. Track open rates, reply rates. Report weekly to Selam with recommendations.',
    priority: 'medium',
    status: 'pending',
    due: '2026-04-07',
    category: 'Optimization',
    progress: 0,
  },
  {
    id: 'bulcha-5',
    title: 'CRM Data Hygiene',
    description: 'Clean up pipeline/accounts.json. Standardize company names, verify all 20 targets have complete profiles.',
    priority: 'medium',
    status: 'pending',
    due: '2026-03-31',
    category: 'Data',
    progress: 50,
  },
]

function TaskCard({ task, agentColor }) {
  const prioColor = (p) => {
    if (!p) return '#9ca3af'
    const s = p.toLowerCase()
    if (s === 'high' || s === 'urgent') return '#ef4444'
    if (s === 'medium') return '#f97316'
    return '#9ca3af'
  }

  const statusColor = (s) => {
    if (!s) return '#9ca3af'
    const st = s.toLowerCase()
    if (st === 'complete' || st === 'done') return '#22c55e'
    if (st === 'in-progress' || st === 'in_progress' || st === 'active') return '#3b82f6'
    return '#6b7280'
  }

  const progress = task.progress ?? 0
  const progressColor = progress >= 80 ? '#22c55e' : progress >= 40 ? '#f97316' : '#6b7280'

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${agentColor}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{task.title}</div>
        <span style={{ ...S.pill(prioColor(task.priority)), fontSize: 10 }}>{task.priority}</span>
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{task.description}</div>
      
      {/* Progress Bar */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Progress</span>
          <span style={{ fontSize: 11, color: progressColor, fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ background: '#ffffff15', borderRadius: 999, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: progressColor, borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{task.category}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{task.due}</span>
          <span style={{ ...S.pill(statusColor(task.status)), fontSize: 10 }}>{task.status}</span>
        </div>
      </div>
    </div>
  )
}

function AssignmentsView({ state, isMobile }) {
  const selamLive = state?.operations?.ai_workers?.find(w => w.name === 'Selam')
  const selamStatus = selamLive?.status || 'active'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ ...S.card, background: 'linear-gradient(135deg, #111118, #1a1a2e)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📋 Task Assignments</div>
        <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
          Selam handles strategy, product, and high-value work. Bulcha executes outreach ops, lead research, and data hygiene.
          Daily async updates via Mission Control.
        </div>
      </div>

      {/* Selam's Column */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3b82f622', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            ⚙️
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Selam</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>CEO · Strategy + Product + Oversight</div>
          </div>
          <Pill status={selamStatus} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {SELAM_TASKS.map((task) => (
            <TaskCard key={task.id} task={task} agentColor="#3b82f6" />
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #ffffff10', margin: '8px 0' }} />

      {/* Bulcha */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f9731622', border: '2px solid #f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📬</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Bulcha</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Director, Outreach Ops</div>
          </div>
          <Pill status="blocked" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {BULCHA_TASKS.map((task) => (
            <TaskCard key={task.id} task={task} agentColor="#f97316" />
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #ffffff10', margin: '8px 0' }} />

      {/* Merry */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#a855f722', border: '2px solid #a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💼</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Merry</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Closer Agent</div>
          </div>
          <Pill status="active" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {MERRY_TASKS.map((task) => (
            <TaskCard key={task.id} task={task} agentColor="#a855f7" />
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}>{SELAM_TASKS.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>Selam</div>
        </div>
        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f97316' }}>{BULCHA_TASKS.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>Bulcha</div>
        </div>
        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#a855f7' }}>{MERRY_TASKS.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>Merry</div>
        </div>
        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>
            {[...SELAM_TASKS, ...BULCHA_TASKS, ...MERRY_TASKS].filter(t => t.status === 'complete' || t.status === 'done').length}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>Done</div>
        </div>
      </div>
    </div>
  )
}

// ── Conversations View ───────────────────────────────────────────────────────

// Helper to format message content with code blocks
function formatMessageContent(content) {
  if (!content) return null
  
  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)
  
  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // Extract language and code
      const match = part.match(/^```(\w+)?\n?([\s\S]*?)```$/)
      const language = match?.[1] || ''
      const code = match?.[2] || part.slice(3, -3)
      
      return (
        <div key={idx} style={{ margin: '8px 0' }}>
          {language && (
            <div style={{
              fontSize: 10,
              color: '#9ca3af',
              background: '#1a1a2e',
              padding: '4px 8px',
              borderRadius: '4px 4px 0 0',
              borderBottom: '1px solid #ffffff10',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}>
              {language}
            </div>
          )}
          <pre style={{
            margin: 0,
            padding: '12px',
            background: '#0d0d14',
            borderRadius: language ? '0 0 4px 4px' : 4,
            border: '1px solid #ffffff15',
            overflowX: 'auto',
            fontSize: 12,
            lineHeight: 1.4,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
            color: '#d1d5db',
          }}>
            <code>{code.trim()}</code>
          </pre>
        </div>
      )
    }
    
    // Handle inline code
    const inlineParts = part.split(/(`[^`]+`)/g)
    return (
      <span key={idx}>
        {inlineParts.map((inline, i) => {
          if (inline.startsWith('`') && inline.endsWith('`')) {
            return (
              <code key={i} style={{
                background: '#1a1a2e',
                padding: '2px 5px',
                borderRadius: 3,
                fontSize: '0.9em',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                color: '#f97316',
                border: '1px solid #ffffff15',
              }}>
                {inline.slice(1, -1)}
              </code>
            )
          }
          return <span key={i}>{inline}</span>
        })}
      </span>
    )
  })
}

function ConversationsView({ isMobile }) {
  const [bulchaSessions, setBulchaSessions] = useState([])
  const [selamSessions, setSelamSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionDetail, setSessionDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedMessages, setExpandedMessages] = useState(new Set())
  const messagesEndRef = useRef(null)

  // Filter sessions to show those from past 7 days
  const filterRecentSessions = (sessions) => {
    const sevenDaysAgo = Date.now() / 1000 - (7 * 24 * 3600)
    return sessions.filter(session => session.lastModified > sevenDaysAgo)
  }

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true)
        
        // Get the base URL from window location
        const baseUrl = window.location.origin
        
        // Load Bulcha's conversations
        const bulchaUrl = new URL('/conversations/bulcha', baseUrl).toString()
        const bulchaRes = await fetch(bulchaUrl)
        if (bulchaRes.ok) {
          const bulchaData = await bulchaRes.json()
          setBulchaSessions(filterRecentSessions(bulchaData.sessions || []))
        }
        
        // Load Selam's conversations
        const selamUrl = new URL('/conversations/selam', baseUrl).toString()
        const selamRes = await fetch(selamUrl)
        if (selamRes.ok) {
          const selamData = await selamRes.json()
          setSelamSessions(filterRecentSessions(selamData.sessions || []))
        }
        
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadConversations()
    const interval = setInterval(loadConversations, 300000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Scroll to bottom when session detail loads or updates
  useEffect(() => {
    if (sessionDetail && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [sessionDetail])

  const loadSessionDetail = async (sessionId, agent) => {
    try {
      const baseUrl = window.location.origin
      const url = new URL(`/conversations/${agent}/${sessionId}`, baseUrl).toString()
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setSessionDetail(data)
        setSelectedSession({ id: sessionId, agent })
        setExpandedMessages(new Set()) // Reset expanded state
      }
    } catch (err) {
      console.error('Failed to load session:', err)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    }
    
    return date.toLocaleString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const formatRelativeTime = (mtime) => {
    if (!mtime) return ''
    const diff = Date.now() / 1000 - mtime
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const toggleMessageExpand = (idx) => {
    const newExpanded = new Set(expandedMessages)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedMessages(newExpanded)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#9ca3af' }}>
        Loading conversations...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ef4444' }}>
        Error loading conversations: {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={S.sectionTitle}>
        <span>💬</span> Live Conversations
      </div>

      {/* Session List */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Bulcha Sessions */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <img src="/avatars/bulcha.svg" alt="Bulcha" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Bulcha's Sessions</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{bulchaSessions.length} recent</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bulchaSessions.map((session) => (
              <div
                key={session.sessionId}
                onClick={() => loadSessionDetail(session.sessionId, 'bulcha')}
                style={{
                  padding: '10px 12px',
                  background: selectedSession?.id === session.sessionId ? '#3b82f622' : '#ffffff06',
                  borderRadius: 8,
                  border: `1px solid ${selectedSession?.id === session.sessionId ? '#3b82f6' : '#ffffff10'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#d1d5db', fontFamily: 'monospace' }}>
                    {session.sessionId.slice(0, 8)}...
                  </span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {formatRelativeTime(session.lastModified)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {session.entryCount} entries · {session.messages?.length || 0} messages
                </div>
              </div>
            ))}
            {bulchaSessions.length === 0 && (
              <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                No Bulcha sessions found
              </div>
            )}
          </div>
        </div>

        {/* Selam Sessions */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <img src="/avatars/selam.svg" alt="Selam" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Selam's Sessions</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{selamSessions.length} recent</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selamSessions.map((session) => (
              <div
                key={session.sessionId}
                onClick={() => loadSessionDetail(session.sessionId, 'selam')}
                style={{
                  padding: '10px 12px',
                  background: selectedSession?.id === session.sessionId ? '#3b82f622' : '#ffffff06',
                  borderRadius: 8,
                  border: `1px solid ${selectedSession?.id === session.sessionId ? '#3b82f6' : '#ffffff10'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#d1d5db', fontFamily: 'monospace' }}>
                    {session.sessionId.slice(0, 8)}...
                  </span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {formatRelativeTime(session.lastModified)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {session.entryCount} entries · {session.messages?.length || 0} messages
                </div>
              </div>
            ))}
            {selamSessions.length === 0 && (
              <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                No Selam sessions found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Session Detail */}
      {sessionDetail && (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 20px',
            background: '#111118',
            borderBottom: '1px solid #ffffff10',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
                💬 Conversation
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                {sessionDetail.messages?.length || 0} messages · {selectedSession.agent} · {selectedSession.id.slice(0, 12)}...
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => copyToClipboard(sessionDetail.messages?.map(m => `${m.role}: ${m.content}`).join('\n\n---\n\n') || '')}
                style={{
                  padding: '8px 14px',
                  background: '#3b82f620',
                  border: '1px solid #3b82f640',
                  borderRadius: 6,
                  color: '#3b82f6',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                📋 Copy All
              </button>
              <button
                onClick={() => setSessionDetail(null)}
                style={{
                  padding: '8px 14px',
                  background: '#ffffff10',
                  border: '1px solid #ffffff20',
                  borderRadius: 6,
                  color: '#9ca3af',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2,
            maxHeight: '600px',
            overflowY: 'auto',
            padding: '20px',
            background: '#0a0a0f',
          }}>
            {sessionDetail.messages?.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const senderName = isUser 
                ? (selectedSession.agent === 'bulcha' ? 'Mikael' : 'You')
                : selectedSession.agent
              const isExpanded = expandedMessages.has(idx)
              const shouldTruncate = msg.content && msg.content.length > 500 && !isExpanded
              const displayContent = shouldTruncate 
                ? msg.content.slice(0, 500) + '...'
                : msg.content

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    marginBottom: 16,
                  }}
                >
                  {/* Sender label */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                    padding: '0 4px',
                  }}>
                    <span style={{ 
                      fontSize: 12, 
                      fontWeight: 600,
                      color: isUser ? '#3b82f6' : '#22c55e',
                    }}>
                      {senderName}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  {/* Message bubble */}
                  <div style={{
                    maxWidth: isMobile ? '95%' : '85%',
                    padding: '14px 18px',
                    background: isUser 
                      ? 'linear-gradient(135deg, #3b82f620, #3b82f610)' 
                      : 'linear-gradient(135deg, #22c55e15, #22c55e08)',
                    borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    border: `1px solid ${isUser ? '#3b82f630' : '#22c55e25'}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    {/* Message content */}
                    <div style={{ 
                      fontSize: 14, 
                      color: '#f3f4f6',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {formatMessageContent(displayContent)}
                    </div>

                    {/* Expand/Collapse button for long messages */}
                    {msg.content && msg.content.length > 500 && (
                      <button
                        onClick={() => toggleMessageExpand(idx)}
                        style={{
                          marginTop: 10,
                          padding: '4px 10px',
                          background: 'transparent',
                          border: '1px solid #ffffff20',
                          borderRadius: 4,
                          color: '#9ca3af',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={() => copyToClipboard(msg.content)}
                    style={{
                      marginTop: 4,
                      padding: '2px 8px',
                      background: 'transparent',
                      border: 'none',
                      color: '#6b7280',
                      fontSize: 10,
                      cursor: 'pointer',
                      opacity: 0.6,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.6}
                  >
                    Copy
                  </button>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
        Auto-refreshes every 5 minutes
      </div>
    </div>
  )
}

// ── Communications View ───────────────────────────────────────────────────────

function CommunicationsView({ isMobile }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/team-chat')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        // Sort newest first
        const sorted = (data.messages || []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        setMessages(sorted)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const getAgentColor = (sender) => {
    if (!sender) return '#9ca3af'
    const s = sender.toLowerCase()
    if (s.includes('selam')) return '#6366f1'
    if (s.includes('bulcha')) return '#f59e0b'
    if (s.includes('merry')) return '#22c55e'
    return '#9ca3af'
  }

  const getAgentIcon = (sender) => {
    if (!sender) return '💬'
    const s = sender.toLowerCase()
    if (s.includes('selam')) return '👩‍💼'
    if (s.includes('bulcha')) return '⚡'
    if (s.includes('merry')) return '🎯'
    return '💬'
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    try {
      const d = new Date(ts)
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    } catch { return ts }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#9ca3af' }}>
        Loading communications...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}>
        Error loading comms: {error}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div style={{ padding: '40px', color: '#6b7280', textAlign: 'center' }}>
        No agent communications yet.
      </div>
    )
  }

  return (
    <div>
      <div style={S.sectionTitle}>
        <span>📡</span> Agent Communications
        <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8, fontWeight: 400 }}>
          {messages.length} messages · live
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, idx) => {
          const color = getAgentColor(msg.sender || msg.agent)
          const icon = getAgentIcon(msg.sender || msg.agent)
          const name = msg.sender || msg.agent || 'Unknown'

          return (
            <div key={idx} style={{ ...S.card, borderLeft: `3px solid ${color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15 }}>{icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>{name}</span>
                  {msg.to && (
                    <span style={{ fontSize: 11, color: '#6b7280' }}>→ {msg.to}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{formatTime(msg.timestamp)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.text}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
        Real-time agent activity feed · refreshes every 30s
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
  { id: 'assignments', label: 'Assignments', icon: '📋' },
  { id: 'cron', label: 'Cron Jobs', icon: '⏱️' },
  { id: 'documents', label: 'Docs', icon: '📄' },
  { id: 'conventions', label: 'Conventions', icon: '📐' },
]

export default function App() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Sync tasks from real agent logs every 5 minutes
  useEffect(() => {
    const sync = async () => {
      try {
        await fetch('/task-sync')
      } catch (e) {}
    }
    sync()
    const interval = setInterval(sync, 300000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchState()
        if (!cancelled) {
          setState(data)
          setError(null)
          setLastRefresh(new Date().toLocaleTimeString())
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Top bar data
  const tasks = state?.tasks || []
  const activeTasks = tasks.filter((t) => ['active', 'in-progress', 'in_progress', 'running'].includes((t.status || '').toLowerCase()))
  const queuedTasks = tasks.filter((t) => ['pending', 'queued'].includes((t.status || '').toLowerCase()))
  const doneTasks = tasks.filter((t) => ['complete', 'done'].includes((t.status || '').toLowerCase()))
  const aiWorkers = state?.operations?.ai_workers || []
  const revenue = state?.strategic?.revenue
  const currentRevenue = revenue?.currentMonthly ?? 0
  const targetRevenue = revenue?.targetMonthly ?? 100000
  const revPct = Math.round((currentRevenue / targetRevenue) * 100)

  const renderView = () => {
    switch (view) {
      case 'agents': return <AgentsView state={state} isMobile={isMobile} />
      case 'assignments': return <AssignmentsView state={state} isMobile={isMobile} />
      case 'conversations': return <ConversationsView isMobile={isMobile} />
      case 'roadmap': return <RoadmapView />
      case 'communications': return <CommunicationsView isMobile={isMobile} />
      case 'workshop': return <WorkshopView state={state} />
      case 'cron': return <CronView state={state} />
      case 'documents': return <DocumentsView state={state} />
      case 'conventions': return <ConventionsView />
      default: return <DashboardView state={state} setView={setView} isMobile={isMobile} />
    }
  }

  const statusCards = (gridCols) => (
    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 8 : 16, padding: isMobile ? '12px 12px 0' : '20px 24px', borderBottom: isMobile ? 'none' : '1px solid #ffffff10', flexShrink: 0 }}>
      <TopStatCard label="Status">
        <span style={{ ...S.statValue, color: '#22c55e', fontSize: isMobile ? 16 : 20 }}>Online</span>
        <span style={S.statSub}>
          {loading ? 'Loading…' : error ? '⚠️ ' + error.slice(0, 30) : 'Ready'}
        </span>
      </TopStatCard>

      <TopStatCard label="Workshop">
        <span style={{ ...S.statValue, fontSize: isMobile ? 16 : 20 }}>{tasks.length}</span>
        <span style={S.statSub}>
          <span style={{ color: '#f97316' }}>{activeTasks.length} active</span>
          {' · '}
          <span style={{ color: '#22c55e' }}>{doneTasks.length} done</span>
        </span>
      </TopStatCard>

      <TopStatCard label="Agents">
        <span style={{ ...S.statValue, fontSize: isMobile ? 16 : 20 }}>{aiWorkers.length || 1}</span>
        <span style={S.statSub}>
          {aiWorkers.length === 0
            ? 'Selam active'
            : `${aiWorkers.filter((w) => w.status === 'active').length} active`}
        </span>
      </TopStatCard>

      <TopStatCard label="Revenue">
        <span style={{ ...S.statValue, fontSize: isMobile ? 16 : 20 }}>{formatCurrency(currentRevenue)}</span>
        <span style={S.statSub}>
          <span style={{ color: revPct >= 100 ? '#22c55e' : revPct > 50 ? '#f97316' : '#9ca3af' }}>
            {revPct}%
          </span>
          {' of '}{formatCurrency(targetRevenue)}
        </span>
      </TopStatCard>
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', maxWidth: '100vw', background: '#0a0a0f', color: '#ffffff', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", overflow: 'hidden' }}>
        {/* Mobile Header */}
        <header style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #ffffff10', background: '#111118', flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Mission Control</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            Live
          </span>
        </header>

        {/* Top nav — scrollable tab bar */}
        <nav style={{ display: 'flex', borderBottom: '1px solid #ffffff10', background: '#0d0d14', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                flex: '0 0 auto',
                minWidth: 58,
                padding: '10px 6px 8px',
                background: 'none',
                border: 'none',
                borderBottom: view === item.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: view === item.id ? '#3b82f6' : '#6b7280',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                fontSize: 9,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Main scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px' }}>
          {renderView()}
        </main>
      </div>
    )
  }

  // Desktop layout
  return (
    <div style={S.page}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <div style={S.logoText}>
            <span>⚙️</span>
            Mission Control
          </div>
          <div style={S.logoSub}>AI Operations</div>
        </div>

        <nav style={S.nav}>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              onClick={() => setView(item.id)}
              style={S.navItem(view === item.id)}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        {/* Token VU Meter */}
        <TokenVUMeter />

        <div style={S.sidebarBottom}>
          <div style={S.greenDot} />
          <span>Online</span>
          {lastRefresh && (
            <span style={{ fontSize: 11, marginLeft: 'auto', color: '#9ca3af88' }}>{lastRefresh}</span>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        {/* Top status bar — 4 in a row on desktop */}
        {statusCards('repeat(4, 1fr)')}

        {/* Page content */}
        <div style={S.content}>
          {renderView()}
        </div>
      </main>
    </div>
  )
}

// cache bust 1775078105
