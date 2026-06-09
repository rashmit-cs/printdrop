import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import LandingPage     from './pages/LandingPage.jsx'
import LoginPage       from './pages/LoginPage.jsx'
import SignupPage      from './pages/SignupPage.jsx'
import DashboardPage   from './pages/DashboardPage.jsx'
import SetupPage       from './pages/SetupPage.jsx'
import CustomerPage    from './pages/CustomerPage.jsx'
import OrderStatusPage from './pages/OrderStatusPage.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/"                  element={<LandingPage />} />
      <Route path="/login"             element={<LoginPage />} />
      <Route path="/signup"            element={<SignupPage />} />
      <Route path="/dashboard"         element={<DashboardPage />} />
      <Route path="/setup"             element={<SetupPage />} />
      <Route path="/shop/:shopId"      element={<CustomerPage />} />
      <Route path="/order/:orderId"    element={<OrderStatusPage />} />
    </Routes>
  </BrowserRouter>
)
