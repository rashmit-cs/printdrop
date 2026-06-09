import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api.js'

export default function SignupPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', ownerName: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/signup', form)
      localStorage.setItem('token', data.token)
      nav('/setup')
    } catch (e) {
      setError(e.response?.data?.error || 'Signup failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-up">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl">
            Print<span className="text-accent">Drop</span>
          </Link>
          <p className="text-muted mt-2 text-sm">Register your print shop</p>
        </div>

        <div className="bg-surface border border-white/8 rounded-2xl p-6 space-y-4">
          {[
            { label: 'Shop Name', key: 'name', placeholder: 'Raj Xerox Center' },
            { label: 'Your Name', key: 'ownerName', placeholder: 'Rajesh Kumar' },
            { label: 'Email', key: 'email', placeholder: 'raj@gmail.com', type: 'email' },
            { label: 'Phone', key: 'phone', placeholder: '9876543210', type: 'tel' },
            { label: 'Password', key: 'password', placeholder: '••••••••', type: 'password' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-muted block mb-1.5 font-medium">{f.label}</label>
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={set(f.key)}
                className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-accent text-white font-display font-semibold py-3 rounded-xl hover:bg-orange-600 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:scale-100 mt-2"
          >
            {loading ? 'Creating account...' : 'Create Shop →'}
          </button>
        </div>

        <p className="text-center text-sm text-muted mt-4">
          Already registered?{' '}
          <Link to="/login" className="text-accent hover:underline">Login</Link>
        </p>
      </div>
    </div>
  )
}
