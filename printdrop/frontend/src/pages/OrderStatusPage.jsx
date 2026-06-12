import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api.js'

const STEPS = ['AWAITING_CONFIRMATION', 'PAID', 'PRINTING', 'PRINTED']

const INFO = {
  PENDING_PAYMENT:       { icon: '⏳', title: 'Awaiting Payment',  msg: 'Please complete payment to the shop.', color: 'text-yellow-400' },
  AWAITING_CONFIRMATION: { icon: '📨', title: 'Sent to Shop!',     msg: "We've notified the shopkeeper. Waiting for them to confirm your payment.", color: 'text-blue-400' },
  PAID:                  { icon: '✅', title: 'Confirmed!',        msg: 'Payment confirmed. Your document is queued for printing...', color: 'text-blue-400' },
  PRINTING:              { icon: '🖨️', title: 'Printing Now!',     msg: 'Your document is being printed right now.', color: 'text-purple-400' },
  PRINTED:               { icon: '🎉', title: 'Ready to Collect!', msg: 'Your print is done. Collect from the shopkeeper!', color: 'text-green-400' },
  FAILED:                { icon: '❌', title: 'Print Failed',      msg: 'Something went wrong. Please contact the shopkeeper.', color: 'text-red-400' },
  REJECTED:              { icon: '🚫', title: 'Payment Not Found', msg: 'Shopkeeper could not confirm your payment. Please check with them.', color: 'text-red-400' },
}

export default function OrderStatusPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get(`/order/${orderId}/status`)
        setOrder(data)
      } catch {}
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

  const info = INFO[order.status] || INFO['AWAITING_CONFIRMATION']
  const currentStep = STEPS.indexOf(order.status)
  const isTerminal = ['FAILED', 'REJECTED'].includes(order.status)

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full fade-up text-center">
        <div className="text-6xl mb-4">{info.icon}</div>
        <h1 className={`font-display font-extrabold text-2xl mb-2 ${info.color}`}>{info.title}</h1>
        <p className="text-muted text-sm mb-8">{info.msg}</p>

        {!isTerminal && currentStep >= 0 && (
          <div className="flex items-center gap-2 mb-8 justify-center">
            {['Sent', 'Confirmed', 'Printing', 'Done'].map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    i <= currentStep ? 'bg-accent border-accent text-white' : 'border-white/20 text-muted'
                  }`}>
                    {i <= currentStep ? '✓' : i + 1}
                  </div>
                  <span className="text-xs text-muted">{label}</span>
                </div>
                {i < 3 && <div className={`h-0.5 mb-4 transition-all ${i < currentStep ? 'bg-accent' : 'bg-white/10'}`} style={{ width: 24 }} />}
              </React.Fragment>
            ))}
          </div>
        )}

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
            <span>Amount</span>
            <span className="text-accent">₹{order.amount}</span>
          </div>
        </div>

        {!isTerminal && order.status !== 'PRINTED' && (
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
