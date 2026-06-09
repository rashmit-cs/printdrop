import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api.js'

const STEPS = ['PAID', 'PRINTING', 'PRINTED']

const INFO = {
  PAID:     { icon: '✅', title: 'Payment Received!', msg: 'Your document is queued for printing...', color: 'text-blue-400' },
  PRINTING: { icon: '🖨️', title: 'Printing Now!',    msg: 'Your document is being printed right now.', color: 'text-purple-400' },
  PRINTED:  { icon: '🎉', title: 'Ready to Collect!', msg: 'Your print is done. Collect from the shopkeeper!', color: 'text-green-400' },
  FAILED:   { icon: '❌', title: 'Print Failed',       msg: 'Something went wrong. Please contact the shopkeeper.', color: 'text-red-400' },
  PENDING_PAYMENT: { icon: '⏳', title: 'Awaiting Payment', msg: 'Payment not confirmed yet.', color: 'text-yellow-400' },
}

export default function OrderStatusPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get(`/order/${orderId}/status`)
        setOrder(data)
      } catch { /* ignore */ }
    }
    poll()
    const interval = setInterval(poll, 4000)
    return () => clearInterval(interval)
  }, [orderId])

  if (!order) return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="text-muted text-sm">Loading order status...</div>
    </div>
  )

  const info = INFO[order.status] || INFO['PAID']
  const currentStep = STEPS.indexOf(order.status)
  const isFailed = order.status === 'FAILED'

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full fade-up text-center">
        
        <div className="text-6xl mb-4">{info.icon}</div>
        <h1 className={`font-display font-extrabold text-2xl mb-2 ${info.color}`}>{info.title}</h1>
        <p className="text-muted text-sm mb-8">{info.msg}</p>

        {/* Progress bar */}
        {!isFailed && (
          <div className="flex items-center gap-2 mb-8 justify-center">
            {['Paid', 'Printing', 'Done'].map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    i <= currentStep
                      ? 'bg-accent border-accent text-white'
                      : 'border-white/20 text-muted'
                  }`}>
                    {i <= currentStep ? '✓' : i + 1}
                  </div>
                  <span className="text-xs text-muted">{label}</span>
                </div>
                {i < 2 && (
                  <div className={`flex-1 h-0.5 mb-4 transition-all ${i < currentStep ? 'bg-accent' : 'bg-white/10'}`} style={{ width: 32 }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Order summary */}
        <div className="bg-surface border border-white/8 rounded-2xl p-4 text-sm text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">File</span>
            <span className="text-paper text-xs truncate max-w-[180px]">{order.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Type</span>
            <span className="text-paper">{order.printType === 'COLOR' ? '🎨 Color' : '⬛ B&W'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Copies</span>
            <span className="text-paper">{order.copies}</span>
          </div>
          <div className="flex justify-between font-display font-bold border-t border-white/8 pt-2 mt-2">
            <span>Paid</span>
            <span className="text-accent">₹{order.amount}</span>
          </div>
        </div>

        {order.status !== 'PRINTED' && !isFailed && (
          <p className="text-xs text-muted mt-4 animate-pulse">Auto-refreshing every 4 seconds...</p>
        )}

        {order.status === 'PRINTED' && (
          <div className="mt-6 bg-green-400/10 border border-green-400/20 rounded-2xl p-4 text-green-400 text-sm font-medium">
            Show this screen to the shopkeeper to collect your print!
          </div>
        )}
      </div>
    </div>
  )
}
