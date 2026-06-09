import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../api.js'

const STATUS_COLORS = {
  PENDING_PAYMENT: 'text-yellow-400 bg-yellow-400/10',
  PAID:            'text-blue-400 bg-blue-400/10',
  PRINTING:        'text-purple-400 bg-purple-400/10',
  PRINTED:         'text-green-400 bg-green-400/10',
  FAILED:          'text-red-400 bg-red-400/10',
}
const STATUS_LABEL = {
  PENDING_PAYMENT: 'Awaiting Payment',
  PAID:            'Paid — Queued',
  PRINTING:        'Printing...',
  PRINTED:         'Done ✓',
  FAILED:          'Failed',
}

export default function DashboardPage() {
  const nav = useNavigate()
  const qrRef = useRef()
  const [shop, setShop] = useState(null)
  const [stats, setStats] = useState({})
  const [orders, setOrders] = useState([])
  const [agentInfo, setAgentInfo] = useState(null)
  const [tab, setTab] = useState('overview')
  const [copied, setCopied] = useState('')

  const shopUrl = shop ? `${window.location.origin}/shop/${shop.id}` : ''

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { nav('/login'); return }

    const load = async () => {
      try {
        const [shopRes, statsRes, ordersRes, agentRes] = await Promise.all([
          api.get('/shop/me'),
          api.get('/shop/stats'),
          api.get('/order/shop/list'),
          api.get('/shop/agent-info'),
        ])
        setShop(shopRes.data)
        setStats(statsRes.data)
        setOrders(ordersRes.data)
        setAgentInfo(agentRes.data)
      } catch {
        nav('/login')
      }
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  const logout = () => { localStorage.removeItem('token'); nav('/') }

  const copy = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'printdrop-qr.svg'; a.click()
  }

  if (!shop) return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="text-muted">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ink">
      <nav className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <span className="font-display font-bold text-lg">Print<span className="text-accent">Drop</span></span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted hidden sm:block">{shop.name}</span>
          <Link to="/setup" className="text-xs text-muted hover:text-paper border border-white/10 px-3 py-1.5 rounded-lg transition-colors">Settings</Link>
          <button onClick={logout} className="text-xs text-muted hover:text-red-400 transition-colors">Logout</button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-surface rounded-xl p-1 mb-6 w-fit flex-wrap">
          {['overview', 'qr', 'agent', 'orders'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-display font-semibold transition-all capitalize ${
                tab === t ? 'bg-accent text-white' : 'text-muted hover:text-paper'
              }`}
            >
              {t === 'agent' ? '🖥 PC Agent' : t === 'qr' ? 'Your QR' : t}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="fade-up space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Today', value: stats.todayOrders ?? 0, sub: 'prints done' },
                { label: 'Total', value: stats.totalOrders ?? 0, sub: 'all time' },
                { label: 'Pending', value: stats.pendingOrders ?? 0, sub: 'in queue' },
                { label: 'Revenue', value: `₹${stats.totalRevenue ?? 0}`, sub: 'total earned' },
              ].map(s => (
                <div key={s.label} className="bg-surface border border-white/8 rounded-2xl p-4">
                  <div className="text-xs text-muted mb-1">{s.label}</div>
                  <div className="font-display font-bold text-2xl text-paper">{s.value}</div>
                  <div className="text-xs text-muted mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="font-display font-semibold">Shop Status</div>
                <div className="text-xs text-muted mt-0.5">Customers can {shop.isOpen ? '' : 'NOT '}place orders</div>
              </div>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${shop.isOpen ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                {shop.isOpen ? '● Open' : '● Closed'}
              </span>
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 text-sm text-muted space-y-1">
              <div>🎨 Color: <span className="text-paper">₹{shop.colorPrice}/page</span> → <span className="text-white/40">{shop.colorPrinter}</span></div>
              <div>⬛ B&W: <span className="text-paper">₹{shop.bwPrice}/page</span> → <span className="text-white/40">{shop.bwPrinter}</span></div>
            </div>
          </div>
        )}

        {/* QR */}
        {tab === 'qr' && (
          <div className="fade-up flex flex-col items-center gap-5">
            <p className="text-muted text-sm text-center">Print this QR and stick it in your shop. Customers scan to upload and pay.</p>
            <div ref={qrRef} className="bg-paper rounded-3xl p-6 shadow-xl">
              <QRCodeSVG value={shopUrl} size={220} bgColor="#F5F0E8" fgColor="#0A0A0F" level="H" />
            </div>
            <div className="text-xs text-muted text-center bg-surface border border-white/8 rounded-xl px-4 py-3 max-w-sm break-all">
              {shopUrl}
            </div>
            <div className="flex gap-3">
              <button onClick={downloadQR} className="bg-accent text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-all text-sm">
                Download QR
              </button>
              <button onClick={() => copy(shopUrl, 'link')} className="border border-white/10 text-paper px-6 py-2.5 rounded-xl hover:bg-white/5 transition-all text-sm">
                {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}

        {/* PC AGENT SETUP */}
        {tab === 'agent' && agentInfo && (
          <div className="fade-up space-y-4">
            <div>
              <h2 className="font-display font-bold text-xl">PC Agent Setup</h2>
              <p className="text-muted text-sm mt-1">Run this on the shop computer to enable auto-printing.</p>
            </div>

            {/* Step 1 */}
            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
              <div className="font-display font-semibold text-sm">Step 1 — Your config values</div>
              <p className="text-xs text-muted">Copy these into the <code className="text-accent">config.env</code> file in the pc-agent folder.</p>

              {[
                { label: 'PRINTDROP_SERVER', value: agentInfo.serverUrl, key: 'server' },
                { label: 'PRINTDROP_SHOP_ID', value: agentInfo.shopId, key: 'shopid' },
                { label: 'PRINTDROP_SECRET', value: agentInfo.agentSecret, key: 'secret' },
              ].map(item => (
                <div key={item.key} className="bg-ink rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted mb-0.5">{item.label}</div>
                    <div className="text-xs text-paper font-mono truncate">{item.value}</div>
                  </div>
                  <button
                    onClick={() => copy(item.value, item.key)}
                    className="text-xs text-accent border border-accent/30 px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors shrink-0"
                  >
                    {copied === item.key ? '✓' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>

            {/* Step 2 */}
            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-2">
              <div className="font-display font-semibold text-sm">Step 2 — Run the agent</div>
              <p className="text-xs text-muted">Open terminal in the pc-agent folder and run:</p>
              <div className="bg-ink rounded-xl p-3 font-mono text-xs text-green-400">
                pip install requests schedule pywin32<br/>
                python agent.py
              </div>
              <p className="text-xs text-muted">You'll see "PrintDrop PC Agent started" — leave it running!</p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-2">
              <div className="font-display font-semibold text-sm">Step 3 — Set printer names</div>
              <p className="text-xs text-muted">In config.env, set printer names exactly as shown in Windows → Settings → Bluetooth & devices → Printers</p>
              <div className="bg-ink rounded-xl p-3 font-mono text-xs text-paper">
                COLOR_PRINTER=HP Color LaserJet Pro M254<br/>
                BW_PRINTER=Canon LBP2900B
              </div>
              <p className="text-xs text-muted">Use <span className="text-accent">default</span> to use whatever printer is set as default in Windows.</p>
            </div>

            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4 text-xs text-yellow-400">
              ⚡ Agent must be running on the shop PC whenever the shop is open. When customer pays, agent auto-detects and prints within 5 seconds.
            </div>
          </div>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <div className="fade-up space-y-3">
            {orders.length === 0
              ? <div className="text-center text-muted py-12">No orders yet. Share your QR!</div>
              : orders.map(o => (
                <div key={o.id} className="bg-surface border border-white/8 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-sm truncate">{o.fileName}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {o.printType} · {o.copies} copy · ₹{o.amount} · {new Date(o.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full w-fit ${STATUS_COLORS[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
