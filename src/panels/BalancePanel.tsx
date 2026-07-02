import React, { useState } from 'react'
import {
  Panel,
  Text,
  Button,
  Snackbar
} from '@vkontakte/vkui'
import { Icon28CheckCircleOutline, Icon24Dismiss } from '@vkontakte/icons'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'

interface BalancePanelProps {
  id: string
}

export const BalancePanel: React.FC<BalancePanelProps> = ({ id }) => {
  const { profile } = useAuthStore()
  const { setStory } = useAppStore()
  
  const [selectedPack, setSelectedPack] = useState<number | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>('card')
  const [snackbar, setSnackbar] = useState<React.ReactNode | null>(null)

  const packs = [
    { amount: 100, price: 200, discount: null },
    { amount: 500, price: 900, discount: '10%' },
    { amount: 1000, price: 1600, discount: '20%' },
    { amount: 5000, price: 7000, discount: '30%' }
  ]

  const paymentMethods = [
    { id: 'card', name: 'Банковская карта', icon: '💳' },
    { id: 'sbp', name: 'Система быстрых платежей (СБП)', icon: '📲' },
    { id: 'stars', name: 'Telegram Stars', icon: '⭐' },
    { id: 'crypto', name: 'Криптовалюта (TON/USDT)', icon: '💎' }
  ]

  const handlePayClick = () => {
    if (selectedPack === null) {
      setSnackbar(
        <Snackbar
          onClose={() => setSnackbar(null)}
          onClosed={() => setSnackbar(null)}
          before={<Icon24Dismiss fill="#ff3b30" />}
          style={{
            zIndex: 999999,
            background: 'var(--vkui--color_background_modal, #1c1c1e)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}
        >
          Выберите количество Vihton для пополнения
        </Snackbar>
      )
      return
    }

    setSnackbar(
      <Snackbar
        onClose={() => setSnackbar(null)}
        onClosed={() => setSnackbar(null)}
        before={<Icon28CheckCircleOutline fill="#ff9500" />}
        style={{
          zIndex: 999999,
          background: 'var(--vkui--color_background_modal, #1c1c1e)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
        }}
      >
        Платежная система находится в тестовом режиме. Пополнение недоступно.
      </Snackbar>
    )
  }

  const goBack = () => {
    setStory('feed')
    window.history.pushState(null, '', '/news')
  }

  return (
    <Panel id={id} style={{ background: 'var(--vkui--color_background_page)' }}>
      <div className="settings-custom-header">
        <button 
          onClick={goBack}
          className="settings-back-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span className="settings-header-title">Мой кошелек</span>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: 640, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* VIP Balance Card */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #1f1f2e 0%, #0d0d15 100%)',
          borderRadius: 24,
          padding: '24px 20px',
          border: '1px solid rgba(255, 149, 0, 0.25)',
          boxShadow: '0 12px 40px rgba(255, 149, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
          overflow: 'hidden',
          marginBottom: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          {/* Glowing Background Radial */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 30%, rgba(255, 149, 0, 0.15), transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          {/* Premium Chip/Logo */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffb347 0%, #ffcc33 100%)',
            boxShadow: '0 8px 24px rgba(255, 149, 0, 0.35)',
            marginBottom: 16
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>

          <Text style={{ position: 'relative', zIndex: 1, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, color: '#ff9500', fontWeight: 700, marginBottom: 6 }}>
            Личный счет
          </Text>

          <Text style={{ position: 'relative', zIndex: 1, fontSize: 32, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.5px' }}>
            {profile?.balance ?? 1000} <span style={{ color: '#ff9500' }}>Vihton</span>
          </Text>

          {profile?.username && (
            <Text style={{ position: 'relative', zIndex: 1, fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginTop: 8 }}>
              владелец: <span style={{ color: '#ffffff', fontWeight: 600 }}>@{profile.username}</span>
            </Text>
          )}
        </div>

        {/* Top-up Options */}
        <Text style={{ fontSize: 16, fontWeight: 750, color: 'var(--vkui--color_text_primary)', marginBottom: 12, display: 'block' }}>
          Пополнение баланса
        </Text>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
          {packs.map((pack) => {
            const isSelected = selectedPack === pack.amount
            return (
              <div
                key={pack.amount}
                onClick={() => setSelectedPack(pack.amount)}
                style={{
                  position: 'relative',
                  background: isSelected ? 'rgba(255, 149, 0, 0.08)' : 'var(--vkui--color_background_content)',
                  border: isSelected ? '2px solid #ff9500' : '1px solid var(--vkui--color_separator_primary)',
                  borderRadius: 16,
                  padding: '16px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transition: 'all 0.23s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  boxShadow: isSelected ? '0 4px 15px rgba(255, 149, 0, 0.15)' : 'none',
                  transform: isSelected ? 'scale(1.02)' : 'none'
                }}
              >
                {pack.discount && (
                  <span style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: '#ff3b30',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 8,
                    textTransform: 'uppercase'
                  }}>
                    -{pack.discount}
                  </span>
                )}
                
                <Text style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', marginBottom: 4 }}>
                  {pack.amount} Vihton
                </Text>
                <Text style={{ fontSize: 13, color: isSelected ? '#ff9500' : 'var(--vkui--color_text_secondary)', fontWeight: 600 }}>
                  {pack.price} ₽
                </Text>
              </div>
            )
          })}
        </div>

        {/* Payment Methods */}
        <Text style={{ fontSize: 16, fontWeight: 750, color: 'var(--vkui--color_text_primary)', marginBottom: 12, display: 'block' }}>
          Способ оплаты
        </Text>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {paymentMethods.map((method) => {
            const isSelected = selectedMethod === method.id
            return (
              <div
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'var(--vkui--color_background_content)',
                  borderRadius: 16,
                  border: isSelected ? '1px solid #ff9500' : '1px solid var(--vkui--color_separator_primary)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{method.icon}</span>
                  <Text style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                    {method.name}
                  </Text>
                </div>
                
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: isSelected ? '5px solid #ff9500' : '2px solid var(--vkui--color_separator_primary)',
                  boxSizing: 'border-box',
                  background: isSelected ? '#ffffff' : 'transparent',
                  transition: 'all 0.15s ease'
                }} />
              </div>
            )
          })}
        </div>

        {/* Action Button */}
        <Button
          size="l"
          stretched
          onClick={handlePayClick}
          style={{
            background: 'linear-gradient(135deg, #ff9500 0%, #ff5e3a 100%)',
            boxShadow: '0 6px 20px rgba(255, 149, 0, 0.25)',
            borderRadius: 16,
            height: 48,
            fontSize: 16,
            fontWeight: 700,
            border: 'none',
            color: '#ffffff'
          }}
        >
          Перейти к оплате
        </Button>

        {/* Fake Transaction History */}
        <div style={{ marginTop: 36 }}>
          <Text style={{ fontSize: 16, fontWeight: 750, color: 'var(--vkui--color_text_primary)', marginBottom: 12, display: 'block' }}>
            История операций
          </Text>

          <div style={{ background: 'var(--vkui--color_background_content)', borderRadius: 20, border: '1px solid var(--vkui--color_separator_primary)', padding: '6px 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--vkui--color_separator_primary)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Приветственный бонус Vihton</Text>
                <Text style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>Приветственный подарок при регистрации</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 14, fontWeight: 800, color: '#34c759' }}>+1000 V</Text>
                <Text style={{ fontSize: 10, color: 'var(--vkui--color_text_secondary)', marginTop: 2 }}>Выполнено</Text>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', opacity: 0.8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Пример списания (покупка стикеров)</Text>
                <Text style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>Демонстрационная транзакция</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 14, fontWeight: 800, color: '#ff3b30' }}>-100 V</Text>
                <Text style={{ fontSize: 10, color: 'var(--vkui--color_text_secondary)', marginTop: 2 }}>Демо</Text>
              </div>
            </div>
          </div>
        </div>

      </div>
      {snackbar}
    </Panel>
  )
}
