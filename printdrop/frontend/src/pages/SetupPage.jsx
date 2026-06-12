import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'

export default function SetupPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ colorPrice: 10, bwPrice: 2, upiId: '', isOpen: true })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/shop/me').then(({ data }) => {
      setForm({
        colorPrice: data.colorPrice, bwPrice: data.bwPrice,
        upiId: data.upiId || '', isOpen: data.isOpen
      })
    }).catch(() => nav('/login'))
  }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setLoading(true)
    try {
      await api.put('/shop/settings', form)
      setSaved(true)
      setTimeout(() => nav('/dashboard'), 1200)
    } catch {
      alert('Failed to save settings')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink px-4 py-10">
      <div className="max-w-lg mx-auto fade-up">
        <h1 className="font-display font-bold text-3xl mb-1">Shop Setup</h1>
        <p className="text-muted text-sm mb-8">Set your pricing and where customers should pay you.</p>

        <div className="space-y-6">
          {/* UPI */}
          <div className="bg-surface border border-white/8 rounded-2xl p-5">
            <h2 className="font-display font-semibold mb-1 text-sm text-muted uppercase tracking-wider">Your UPI ID</h2>
            <p className="text-xs text-muted mb-3">
              Customer payments go DIRECTLY to this UPI ID. PrintDrop never touches this money.
            </p>
            <input
              type="text" placeholder="yourname@paytm / yourname@ybl"
              value={form.upiId} onChange={set('upiId')}
              className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors font-mono"
            />
            {!form.upiId && (
              <p className="text-xs text-yellow-400 mt-2">⚠️ Without UPI ID, customers will be told to pay you in cash.</p>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-surface border border-white/8 rounded-2xl p-5">
            <h2 className="font-display font-semibold mb-4 text-sm text-muted uppercase tracking-wider">Pricing (per page)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted block mb-1.5">Color Print (₹)</label>
                <input type="number" min="1" value={form.colorPrice} onChange={set('colorPrice')}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm focus:outline-none focus:border-accent/50 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1.5">B&W Print (₹)</label>
                <input type="number" min="1" value={form.bwPrice} onChange={set('bwPrice')}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm focus:outline-none focus:border-accent/50 transition-colors" />
              </div>
            </div>
          </div>

          {/* Open toggle */}
          <div className="bg-surface border border-white/8 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="font-display font-semibold text-sm">Shop Open</div>
              <div className="text-xs text-muted mt-0.5">Customers can place orders</div>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, isOpen: !f.isOpen }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.isOpen ? 'bg-accent' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isOpen ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="bg-blue-400/10 border border-blue-400/20 rounded-2xl p-4 text-xs text-blue-300">
            🖨️ Printers are auto-detected once you run the PC Agent. Go to Dashboard → PC Agent tab after saving.
          </div>

          {saved
            ? <div className="text-center py-4 text-green-400 font-display font-semibold">✓ Saved! Redirecting...</div>
            : <button onClick={save} disabled={loading}
                className="w-full bg-accent text-white font-display font-bold py-3.5 rounded-xl hover:bg-orange-600 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50">
                {loading ? 'Saving...' : 'Save & Generate QR →'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}
