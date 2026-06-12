import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../api.js'

const STATUS_COLORS = {
  PENDING_PAYMENT:       'text-yellow-400 bg-yellow-400/10',
  AWAITING_CONFIRMATION: 'text-blue-400 bg-blue-400/10',
  PAID:                  'text-blue-400 bg-blue-400/10',
  PRINTING:              'text-purple-400 bg-purple-400/10',
  PRINTED:               'text-green-400 bg-green-400/10',
  FAILED:                'text-red-400 bg-red-400/10',
  REJECTED:              'text-red-400 bg-red-400/10',
}
const STATUS_LABEL = {
  PENDING_PAYMENT:       'Awaiting Payment',
  AWAITING_CONFIRMATION: 'Needs Confirmation',
  PAID:                  'Confirmed — Queued',
  PRINTING:              'Printing...',
  PRINTED:               'Done ✓',
  FAILED:                'Failed',
  REJECTED:              'Rejected',
}

export default function DashboardPage() {
  const nav = useNavigate()
  const qrRef = useRef()
  const [shop, setShop] = useState(null)
  const [stats, setStats] = useState({})
  const [orders, setOrders] = useState([])
  const [pending, setPending] = useState([])
  const [printers, setPrinters] = useState([])
  const [agentInfo, setAgentInfo] = useState(null)
  const [tab, setTab] = useState('overview')
  const [copied, setCopied] = useState('')

  const shopUrl = shop ? `${window.location.origin}/shop/${shop.id}` : ''

  const load = async () => {
    try {
      const [shopRes, statsRes, ordersRes, pendingRes, printersRes, agentRes] = await Promise.all([
        api.get('/shop/me'),
        api.get('/shop/stats'),
        api.get('/order/shop/list'),
        api.get('/order/shop/pending'),
        api.get('/shop/printers'),
        api.get('/shop/agent-info'),
      ])
      setShop(shopRes.data)
      setStats(statsRes.data)
      setOrders(ordersRes.data)
      setPending(pendingRes.data)
      setPrinters(printersRes.data)
      setAgentInfo(agentRes.data)
    } catch {
      nav('/login')
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { nav('/login'); return }
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [])

  const logout = () => { localStorage.removeItem('token'); nav('/') }
  const copy = (text, label) => { navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 2000) }

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'printdrop-qr.svg'; a.click()
  }

  const confirmOrder = async (id) => {
    await api.post(`/order/${id}/confirm`)
    load()
  }
  const rejectOrder = async (id) => {
    if (!confirm('Reject this order? Customer will be told payment was not received.')) return
    await api.post(`/order/${id}/reject`)
    load()
  }

  const updatePrinter = async (id, data) => {
    await api.put(`/shop/printers/${id}`, data)
    load()
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
          {['overview', 'pending', 'printers', 'qr', 'agent', 'orders'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-display font-semibold transition-all capitalize relative ${
                tab === t ? 'bg-accent text-white' : 'text-muted hover:text-paper'
              }`}>
              {t === 'agent' ? '🖥 Agent' : t === 'qr' ? 'QR' : t === 'pending' ? 'Confirm Payments' : t}
              {t === 'pending' && pending.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {pending.length}
                </span>
              )}
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
                { label: 'To Confirm', value: stats.pendingConfirm ?? 0, sub: 'need action' },
                { label: 'Revenue', value: `₹${stats.totalRevenue ?? 0}`, sub: 'total earned' },
              ].map(s => (
                <div key={s.label} className="bg-surface border border-white/8 rounded-2xl p-4">
                  <div className="text-xs text-muted mb-1">{s.label}</div>
                  <div className="font-display font-bold text-2xl text-paper">{s.value}</div>
                  <div className="text-xs text-muted mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {pending.length > 0 && (
              <div onClick={() => setTab('pending')} className="bg-blue-400/10 border border-blue-400/20 rounded-2xl p-4 cursor-pointer hover:bg-blue-400/15 transition-colors">
                <div className="font-display font-semibold text-blue-300">📨 {pending.length} payment{pending.length > 1 ? 's' : ''} waiting for confirmation</div>
                <div className="text-xs text-muted mt-1">Tap to review and confirm</div>
              </div>
            )}

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
              <div>🎨 Color: <span className="text-paper">₹{shop.colorPrice}/page</span></div>
              <div>⬛ B&W: <span className="text-paper">₹{shop.bwPrice}/page</span></div>
              <div>💰 UPI: <span className="text-paper font-mono">{shop.upiId || 'Not set — go to Settings'}</span></div>
            </div>
          </div>
        )}

        {/* PENDING CONFIRMATIONS */}
        {tab === 'pending' && (
          <div className="fade-up space-y-3">
            {pending.length === 0
              ? <div className="text-center text-muted py-12">No payments waiting for confirmation 🎉</div>
              : pending.map(o => (
                <div key={o.id} className="bg-surface border border-blue-400/20 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-sm truncate">{o.fileName}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {o.printType === 'COLOR' ? '🎨 Color' : '⬛ B&W'} · {o.copies} copy{o.copies > 1 ? 's' : ''}
                        {o.customerPhone && <> · 📞 {o.customerPhone}</>}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        Claimed {new Date(o.customerClaimedPaidAt).toLocaleTimeString('en-IN')}
                      </div>
                    </div>
                    <div className="font-display font-bold text-accent text-lg">₹{o.amount}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => confirmOrder(o.id)} className="flex-1 bg-green-500 text-white font-display font-semibold py-2.5 rounded-xl text-sm hover:bg-green-600 transition-colors">
                      ✅ Confirm Payment
                    </button>
                    <button onClick={() => rejectOrder(o.id)} className="flex-1 border border-red-400/30 text-red-400 font-display font-semibold py-2.5 rounded-xl text-sm hover:bg-red-400/10 transition-colors">
                      ❌ Not Received
                    </button>
                  </div>
                </div>
              ))
            }
            <div className="bg-surface/50 rounded-xl p-3 text-xs text-muted text-center">
              Check your UPI app (GPay/PhonePe) for the payment notification before confirming.
            </div>
          </div>
        )}

        {/* PRINTERS */}
        {tab === 'printers' && (
          <div className="fade-up space-y-3">
            <p className="text-muted text-sm mb-2">
              Printers auto-detected by PC Agent. Assign Color/B&W roles and pick defaults.
            </p>
            {printers.length === 0
              ? <div className="text-center text-muted py-12 bg-surface border border-white/8 rounded-2xl">
                  No printers found yet. Run the PC Agent (see "Agent" tab) — it auto-discovers printers within 5 seconds.
                </div>
              : printers.map(p => (
                <div key={p.id} className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-sm truncate">{p.name}</div>
                      <div className="text-xs mt-0.5">
                        <span className={p.isOnline ? 'text-green-400' : 'text-red-400'}>
                          {p.isOnline ? '● Online' : '● Offline'}
                        </span>
                      </div>
                    </div>
                    {p.isDefault && <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full font-semibold shrink-0">Default</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['BW', 'COLOR', 'BOTH'].map(t => (
                      <button key={t} onClick={() => updatePrinter(p.id, { type: t })}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          p.type === t ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-muted hover:border-white/25'
                        }`}>
                        {t === 'BW' ? '⬛ B&W only' : t === 'COLOR' ? '🎨 Color only' : '🔁 Both'}
                      </button>
                    ))}
                    <button onClick={() => updatePrinter(p.id, { isDefault: true, type: p.type })}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted hover:border-white/25 transition-colors">
                      ⭐ Set Default
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* QR */}
        {tab === 'qr' && (
          <div className="fade-up flex flex-col items-center gap-5">
            <p className="text-muted text-sm text-center">Print this QR and stick it in your shop. Customers scan to upload and pay.</p>
            <div ref={qrRef} className="bg-paper rounded-3xl p-6 shadow-xl">
              <QRCodeSVG value={shopUrl} size={220} bgColor="#F5F0E8" fgColor="#0A0A0F" level="H" />
            </div>
            <div className="text-xs text-muted text-center bg-surface border border-white/8 rounded-xl px-4 py-3 max-w-sm break-all">{shopUrl}</div>
            <div className="flex gap-3">
              <button onClick={downloadQR} className="bg-accent text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-all text-sm">Download QR</button>
              <button onClick={() => copy(shopUrl, 'link')} className="border border-white/10 text-paper px-6 py-2.5 rounded-xl hover:bg-white/5 transition-all text-sm">
                {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}

        {/* AGENT */}
        {tab === 'agent' && agentInfo && (
          <div className="fade-up space-y-4">
            <div>
              <h2 className="font-display font-bold text-xl">PC Agent Setup</h2>
              <p className="text-muted text-sm mt-1">Run on the shop computer to enable auto-printing & printer discovery.</p>
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
              <div className="font-display font-semibold text-sm">Step 1 — Edit config.env in pc-agent folder</div>
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
                  <button onClick={() => copy(item.value, item.key)} className="text-xs text-accent border border-accent/30 px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors shrink-0">
                    {copied === item.key ? '✓' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-2">
              <div className="font-display font-semibold text-sm">Step 2 — Run the agent</div>
              <div className="bg-ink rounded-xl p-3 font-mono text-xs text-green-400">
                pip install requests schedule pywin32<br/>python agent.py
              </div>
              <p className="text-xs text-muted">Agent auto-detects all printers on this PC and sends them to server. Go to "Printers" tab to assign roles.</p>
            </div>

            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4 text-xs text-yellow-400">
              ⚡ Agent must be running whenever shop is open. Printers auto-sync every 60 seconds.
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
