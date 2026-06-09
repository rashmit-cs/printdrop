import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api.js'

const ALLOWED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
const IS_DEV = import.meta.env.DEV // true on localhost, false on production

export default function CustomerPage() {
  const { shopId } = useParams()
  const nav = useNavigate()

  const [shop, setShop] = useState(null)
  const [shopError, setShopError] = useState('')
  const [file, setFile] = useState(null)
  const [printType, setPrintType] = useState('BW')
  const [copies, setCopies] = useState(1)
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState('upload')
  const [order, setOrder] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    api.get(`/shop/${shopId}/public`)
      .then(({ data }) => setShop(data))
      .catch(() => setShopError('Shop not found or link is invalid.'))
  }, [shopId])

  const pickFile = e => {
    const f = e.target.files[0]
    if (f) setFile(f)
  }

  const estimatedCost = () => {
    if (!shop) return 0
    const price = printType === 'COLOR' ? shop.colorPrice : shop.bwPrice
    return (price * copies).toFixed(0)
  }

  const uploadAndPay = async () => {
    if (!file) { setError('Please select a file'); return }
    setError(''); setUploading(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('printType', printType)
      fd.append('copies', copies)
      fd.append('customerPhone', phone)

      const { data: orderData } = await api.post(`/order/upload/${shopId}`, fd)
      setOrder(orderData)
      setStep('confirm')
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Try again.')
    } finally { setUploading(false) }
  }

  // ─── REAL RAZORPAY PAYMENT ────────────────────────────────────────────────
  const pay = async () => {
    setStep('paying')
    setError('')
    try {
      const { data: rzp } = await api.post('/payment/create-order', { orderId: order.orderId })

      if (!window.Razorpay) {
        throw new Error('Razorpay script not loaded. Check internet connection.')
      }

      const options = {
        key: rzp.keyId,
        amount: rzp.amount,
        currency: 'INR',
        name: shop.name,
        description: `Print: ${order.fileName}`,
        order_id: rzp.razorpayOrderId,
        prefill: { contact: phone },
        theme: { color: '#FF5C00' },
        handler: async (response) => {
          try {
            await api.post('/payment/verify', {
              ...response,
              orderId: order.orderId
            })
            nav(`/order/${order.orderId}`)
          } catch (err) {
            setError('Payment done but verification failed. Show order ID to shopkeeper: ' + order.orderId)
            setStep('confirm')
          }
        },
        modal: {
          ondismiss: () => {
            setStep('confirm')
          }
        }
      }

      const rzpInstance = new window.Razorpay(options)
      rzpInstance.on('payment.failed', function(response) {
        setError('Payment failed: ' + (response.error?.description || 'Unknown error'))
        setStep('confirm')
      })
      rzpInstance.open()
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Payment failed to initialize.'
      setError(msg)
      setStep('confirm')
    }
  }

  // ─── DEV TEST MODE: SKIP PAYMENT, MARK AS PAID DIRECTLY ──────────────────
  const devTestPay = async () => {
    setStep('paying')
    try {
      await api.post('/payment/dev-confirm', { orderId: order.orderId })
      nav(`/order/${order.orderId}`)
    } catch (e) {
      setError(e.response?.data?.error || 'Dev pay failed')
      setStep('confirm')
    }
  }

  if (shopError) return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-4xl mb-3">🔗</div>
        <div className="text-muted">{shopError}</div>
      </div>
    </div>
  )

  if (!shop) return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="text-muted text-sm">Loading...</div>
    </div>
  )

  if (!shop.isOpen) return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">🔒</div>
        <div className="font-display font-bold text-xl mb-2">{shop.name}</div>
        <div className="text-muted">Shop is currently closed. Come back later!</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Shop header */}
      <div className="bg-surface border-b border-white/5 px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-accent/20 rounded-xl flex items-center justify-center text-accent font-display font-bold text-sm">
          {shop.name[0]}
        </div>
        <div>
          <div className="font-display font-semibold text-sm">{shop.name}</div>
          <div className="text-xs text-green-400">● Open</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full">

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="fade-up space-y-5">
            <div>
              <h1 className="font-display font-bold text-2xl">Print a Document</h1>
              <p className="text-muted text-sm mt-1">Upload your file, pay online, collect print.</p>
            </div>

            {/* File drop area */}
            <div
              onClick={() => fileRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                file ? 'border-accent/50 bg-accent/5' : 'border-white/15 hover:border-white/25'
              }`}
            >
              <div className="text-3xl mb-2">{file ? '📄' : '📁'}</div>
              {file
                ? <div>
                    <div className="font-display font-semibold text-sm text-paper">{file.name}</div>
                    <div className="text-xs text-muted mt-0.5">{(file.size / 1024).toFixed(0)} KB</div>
                  </div>
                : <div>
                    <div className="text-sm text-muted">Tap to select file</div>
                    <div className="text-xs text-white/30 mt-1">PDF, DOCX, JPG, PNG · Max 20MB</div>
                  </div>
              }
              <input ref={fileRef} type="file" accept={ALLOWED_TYPES} onChange={pickFile} className="hidden" />
            </div>

            {/* Print type */}
            <div>
              <label className="text-xs text-muted block mb-2">Print Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'BW', label: '⬛ Black & White', price: shop.bwPrice },
                  { val: 'COLOR', label: '🎨 Color', price: shop.colorPrice },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setPrintType(opt.val)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      printType === opt.val
                        ? 'border-accent bg-accent/10'
                        : 'border-white/10 bg-surface hover:border-white/25'
                    }`}
                  >
                    <div className="text-sm font-display font-semibold">{opt.label}</div>
                    <div className="text-xs text-muted mt-0.5">₹{opt.price}/page</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Copies */}
            <div>
              <label className="text-xs text-muted block mb-2">Copies</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setCopies(c => Math.max(1, c - 1))} className="w-9 h-9 rounded-xl bg-surface border border-white/10 text-lg hover:border-white/25 transition-colors">−</button>
                <span className="font-display font-bold text-xl w-8 text-center">{copies}</span>
                <button onClick={() => setCopies(c => Math.min(20, c + 1))} className="w-9 h-9 rounded-xl bg-surface border border-white/10 text-lg hover:border-white/25 transition-colors">+</button>
              </div>
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="text-xs text-muted block mb-1.5">Your Phone (optional)</label>
              <input
                type="tel" placeholder="9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

            <button
              onClick={uploadAndPay}
              disabled={uploading || !file}
              className="w-full bg-accent text-white font-display font-bold py-4 rounded-2xl text-lg hover:bg-orange-600 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:scale-100"
            >
              {uploading ? 'Uploading...' : `Continue → ₹${estimatedCost()}`}
            </button>
          </div>
        )}

        {/* STEP: CONFIRM */}
        {step === 'confirm' && order && (
          <div className="fade-up space-y-5">
            <div>
              <h1 className="font-display font-bold text-2xl">Confirm Order</h1>
              <p className="text-muted text-sm mt-1">Review before paying</p>
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3 text-sm">
              {[
                { label: 'File', val: order.fileName },
                { label: 'Type', val: order.printType === 'COLOR' ? '🎨 Color' : '⬛ Black & White' },
                { label: 'Copies', val: order.copies },
                { label: 'Shop', val: order.shopName },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-muted">{r.label}</span>
                  <span className="text-paper font-medium">{r.val}</span>
                </div>
              ))}
              <div className="border-t border-white/8 pt-3 flex justify-between font-display font-bold">
                <span>Total</span>
                <span className="text-accent text-lg">₹{order.amount}</span>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

            {/* Real payment button */}
            <button
              onClick={pay}
              className="w-full bg-accent text-white font-display font-bold py-4 rounded-2xl text-lg hover:bg-orange-600 transition-all hover:scale-[1.01] active:scale-95"
            >
              Pay ₹{order.amount} via UPI / Card →
            </button>

            {/* DEV ONLY: skip payment button */}
            {IS_DEV && (
              <button
                onClick={devTestPay}
                className="w-full border-2 border-dashed border-yellow-400/40 text-yellow-400 font-display font-semibold py-3 rounded-2xl text-sm hover:bg-yellow-400/5 transition-all"
              >
                🧪 DEV: Skip Payment (Test Only)
              </button>
            )}

            <p className="text-xs text-muted text-center">
              Accepts GPay · PhonePe · UPI · Cards
            </p>

            <button onClick={() => setStep('upload')} className="w-full text-muted text-sm hover:text-paper transition-colors">
              ← Go back
            </button>
          </div>
        )}

        {/* STEP: PAYING */}
        {step === 'paying' && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <div className="text-muted text-sm">Processing payment...</div>
          </div>
        )}
      </div>
    </div>
  )
}
