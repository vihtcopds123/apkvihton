import React, { useState, useEffect, useRef } from 'react'
import {
  Panel,
  FormItem,
  Input,
  Button,
  Box,
  Text,
  Headline,
  Spacing
} from '@vkontakte/vkui'
import { useAuthStore } from '../store/useAuthStore'

interface LoginPanelProps {
  id: string
}

export const LoginPanel: React.FC<LoginPanelProps> = ({ id }) => {
  const [isRegister, setIsRegister] = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)
  const [recoverySuccess, setRecoverySuccess] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')

  const [showUsername, setShowUsername] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const usernameFieldRef = useRef<HTMLDivElement | null>(null)
  const emailFieldRef = useRef<HTMLDivElement | null>(null)
  const passwordFieldRef = useRef<HTMLDivElement | null>(null)
  const confirmPasswordFieldRef = useRef<HTMLDivElement | null>(null)

  const {
    signIn,
    signUp,
    resetPassword,
    loading,
    error,
    clearError,
    emailToVerify,
    verifyOtpCode,
    resendOtpCode,
    cancelVerification
  } = useAuthStore()

  const [otpCode, setOtpCode] = useState('')
  const [resendTimer, setResendTimer] = useState(60)

  useEffect(() => {
    if (!emailToVerify || resendTimer === 0) return
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(interval)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [emailToVerify, resendTimer])

  useEffect(() => {
    if (emailToVerify) {
      setOtpCode('')
      setResendTimer(60)
    }
  }, [emailToVerify])

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpCode.length < 6) return
    await verifyOtpCode(otpCode)
  }

  const handleResendClick = async () => {
    if (resendTimer > 0) return
    const success = await resendOtpCode()
    if (success) {
      setResendTimer(60)
    }
  }

  useEffect(() => {
    if (fullName.trim().length >= 3) {
      setTimeout(() => setShowUsername(true), 200)
    }
  }, [fullName])

  useEffect(() => {
    if (username.trim().length >= 3) {
      setTimeout(() => setShowEmail(true), 200)
    }
  }, [username])

  useEffect(() => {
    if (email.trim().length >= 5 && email.includes('@')) {
      setTimeout(() => setShowPassword(true), 200)
    }
  }, [email])

  useEffect(() => {
    if (password.length >= 6) {
      setTimeout(() => setShowConfirmPassword(true), 200)
    }
  }, [password])

  useEffect(() => {
    if (!isRegister) return

    const target = showConfirmPassword
      ? confirmPasswordFieldRef.current
      : showPassword
        ? passwordFieldRef.current
        : showEmail
          ? emailFieldRef.current
          : showUsername
            ? usernameFieldRef.current
            : null

    if (!target) return

    const timeoutId = window.setTimeout(() => {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)

    return () => window.clearTimeout(timeoutId)
  }, [isRegister, showUsername, showEmail, showPassword, showConfirmPassword])

  const handleToggleMode = () => {
    setIsRegister(!isRegister)
    setIsRecovery(false)
    setRecoverySuccess(false)
    clearError()
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setUsername('')
    setFullName('')
    setShowUsername(false)
    setShowEmail(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleForgotPassword = () => {
    setIsRecovery(true)
    setRecoverySuccess(false)
    clearError()
  }

  const handleBackToLogin = () => {
    setIsRecovery(false)
    setRecoverySuccess(false)
    clearError()
  }

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    const success = await resetPassword(email)
    if (success) {
      setRecoverySuccess(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    if (isRegister) {
      if (!username || !fullName || !confirmPassword) return
      if (password !== confirmPassword) {
        useAuthStore.setState({ error: 'Пароли не совпадают' })
        return
      }
      
      // Валидация тега пользователя
      if (username.length < 4) {
        useAuthStore.setState({ error: 'Тег пользователя должен быть не менее 4 символов' })
        return
      }
      if (username.startsWith('-') || username.endsWith('-')) {
        useAuthStore.setState({ error: 'Тег пользователя не может начинаться или заканчиваться дефисом (-)' })
        return
      }
      if (!/[a-z]/.test(username)) {
        useAuthStore.setState({ error: 'Тег пользователя должен содержать хотя бы одну латинскую букву' })
        return
      }

      await signUp(email, password, username, fullName)
    } else {
      await signIn(email, password)
    }
  }

  const isSubmitDisabled = loading || (isRecovery
    ? !email
    : (isRegister
      ? (!fullName || !username || !email || !password || !confirmPassword)
      : (!email || !password)))

  return (
    <Panel id={id} className="auth-panel">
      {/* Animated Background */}
      <div className="auth-bg">
        <div className="auth-bg-blob blob-1"></div>
        <div className="auth-bg-blob blob-2"></div>
        <div className="auth-bg-blob blob-3"></div>
      </div>

      {/* Header */}
      <div className="auth-header">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0077ff" />
                  <stop offset="100%" stopColor="#aa3bff" />
                </linearGradient>
              </defs>
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#logo-gradient)" />
              <path d="M2 17l10 5 10-5" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="auth-logo-text">Vihton</span>
        </div>
      </div>

      {/* Content */}
      <div className="auth-content">
        <div className="auth-group">
          <div className="auth-card">
            {emailToVerify ? (
              <form onSubmit={handleVerifySubmit} className="auth-form">
                <Box className="auth-card-header" style={{ textAlign: 'center' }}>
                  <Headline level="1" weight="2" className="auth-card-title">
                    Подтверждение почты
                  </Headline>
                  <Text className="auth-card-subtitle" style={{ marginTop: 8 }}>
                    Код подтверждения отправлен на **{emailToVerify}**. Пожалуйста, введите его ниже для завершения регистрации.
                  </Text>
                </Box>

                <Spacing size={28} />

                <div className="field-wrapper">
                  <FormItem htmlFor="otpCode" className="field-label" style={{ textAlign: 'center' }}>Код подтверждения</FormItem>
                  <Input
                    id="otpCode"
                    type="text"
                    maxLength={10}
                    placeholder="Введите код"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={loading}
                    className="auth-input"
                    style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: '22px', fontWeight: 'bold' }}
                  />
                </div>

                {error && (
                  <div className="auth-error" style={{ marginTop: 16 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {error}
                  </div>
                )}

                <Spacing size={24} />

                <Button
                  className="auth-submit-btn"
                  size="l"
                  stretched
                  type="submit"
                  disabled={otpCode.length < 6 || loading}
                  loading={loading}
                >
                  Подтвердить код
                </Button>

                <Spacing size={16} />

                <div style={{ textAlign: 'center' }}>
                  {resendTimer > 0 ? (
                    <Text style={{ color: 'var(--vkui--color_text_secondary)', fontSize: '14px' }}>
                      Отправить код повторно через {resendTimer} сек
                    </Text>
                  ) : (
                    <Button
                      mode="link"
                      onClick={handleResendClick}
                      disabled={loading}
                      style={{ fontSize: '14px', padding: 0 }}
                    >
                      Отправить код повторно
                    </Button>
                  )}
                </div>

                <Spacing size={20} />

                <Button
                  mode="secondary"
                  className="auth-toggle-btn"
                  onClick={cancelVerification}
                  disabled={loading}
                >
                  Изменить почту / Назад
                </Button>
              </form>
            ) : (
              <>
                <Box className="auth-card-header">
                  <Headline level="1" weight="2" className="auth-card-title">
                    {isRecovery 
                      ? (recoverySuccess ? 'Ссылка отправлена' : 'Восстановление пароля')
                      : (isRegister ? 'Создайте аккаунт' : 'Добро пожаловать')}
                  </Headline>
                  <Text className="auth-card-subtitle">
                    {isRecovery
                      ? (recoverySuccess 
                          ? `Инструкции по восстановлению отправлены на ${email}` 
                          : 'Введите электронную почту для получения ссылки')
                      : (isRegister 
                          ? 'Присоединено к сообществу Vihton' 
                          : 'Войдите в свой аккаунт')}
                  </Text>
                </Box>

                <Spacing size={28} />

                {/* Progress dots for registration */}
                {isRegister && (
                  <div className="auth-progress">
                    <div className={`auth-progress-dot ${fullName.trim().length >= 3 ? 'active' : ''}`}></div>
                    <div className={`auth-progress-dot ${showUsername ? 'active' : ''}`}></div>
                    <div className={`auth-progress-dot ${showEmail ? 'active' : ''}`}></div>
                    <div className={`auth-progress-dot ${showPassword ? 'active' : ''}`}></div>
                    <div className={`auth-progress-dot ${showConfirmPassword ? 'active' : ''}`}></div>
                  </div>
                )}

                <form onSubmit={isRecovery ? handleRecoverySubmit : handleSubmit} className="auth-form">
                  {error && (
                    <div className="auth-error">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      {error}
                    </div>
                  )}

                  {isRecovery ? (
                    <>
                      {!recoverySuccess && (
                        <div className="field-wrapper">
                          <FormItem htmlFor="email" className="field-label">Электронная почта</FormItem>
                          <div className="auth-input-container">
                            <div className="auth-input-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </svg>
                            </div>
                            <Input
                              id="email"
                              type="email"
                              placeholder="name@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              disabled={loading}
                              className="auth-input"
                            />
                          </div>
                        </div>
                      )}

                      <Spacing size={24} />

                      {!recoverySuccess && (
                        <Button
                          className="auth-submit-btn"
                          size="l"
                          stretched
                          type="submit"
                          disabled={isSubmitDisabled}
                          loading={loading}
                        >
                          Восстановить пароль
                        </Button>
                      )}

                      <Spacing size={16} />

                      <Button
                        mode="secondary"
                        className="auth-toggle-btn"
                        onClick={handleBackToLogin}
                        disabled={loading}
                      >
                        Назад к входу
                      </Button>
                    </>
                  ) : isRegister ? (
                    <>
                      <div className="field-wrapper">
                        <FormItem htmlFor="fullName" className="field-label">Имя и фамилия</FormItem>
                        <div className="auth-input-container">
                          <div className="auth-input-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                          </div>
                          <Input
                            id="fullName"
                            type="text"
                            placeholder="Введите ваше имя"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            disabled={loading}
                            className="auth-input"
                          />
                        </div>
                      </div>

                      {showUsername && (
                        <div ref={usernameFieldRef} className="field-wrapper field-appear">
                          <FormItem htmlFor="username" className="field-label">Тег пользователя</FormItem>
                          <div className="auth-input-container">
                            <div className="auth-input-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="4"/>
                                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
                              </svg>
                            </div>
                            <Input
                              id="username"
                              type="text"
                              placeholder="user-tag"
                              value={username}
                              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                              required
                              disabled={loading}
                              className="auth-input"
                            />
                          </div>
                        </div>
                      )}

                      {showEmail && (
                        <div ref={emailFieldRef} className="field-wrapper field-appear">
                          <FormItem htmlFor="email" className="field-label">Электронная почта</FormItem>
                          <div className="auth-input-container">
                            <div className="auth-input-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </svg>
                            </div>
                            <Input
                              id="email"
                              type="email"
                              placeholder="name@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              disabled={loading}
                              className="auth-input"
                            />
                          </div>
                        </div>
                      )}

                      {showPassword && (
                        <div ref={passwordFieldRef} className="field-wrapper field-appear">
                          <FormItem htmlFor="password" className="field-label">Пароль</FormItem>
                          <div className="auth-input-container">
                            <div className="auth-input-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                            </div>
                            <Input
                              id="password"
                              type="password"
                              placeholder="Придумайте пароль"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              disabled={loading}
                              className="auth-input"
                            />
                          </div>
                        </div>
                      )}

                      {showConfirmPassword && (
                        <div ref={confirmPasswordFieldRef} className="field-wrapper field-appear">
                          <FormItem htmlFor="confirmPassword" className="field-label">Повторите пароль</FormItem>
                          <div className="auth-input-container">
                            <div className="auth-input-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                            </div>
                            <Input
                              id="confirmPassword"
                              type="password"
                              placeholder="Повторите пароль"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                              disabled={loading}
                              className="auth-input"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="field-wrapper">
                        <FormItem htmlFor="email" className="field-label">Электронная почта</FormItem>
                        <div className="auth-input-container">
                          <div className="auth-input-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                              <polyline points="22,6 12,13 2,6"/>
                            </svg>
                          </div>
                          <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            className="auth-input"
                          />
                        </div>
                      </div>

                      <div className="field-wrapper">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span className="field-label" style={{ margin: 0 }}>Пароль</span>
                          <span
                            onClick={handleForgotPassword}
                            style={{
                              fontSize: '12px',
                              color: 'var(--vkui--color_text_link, #a855f7)',
                              cursor: 'pointer',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              transition: 'opacity 0.2s ease',
                            }}
                          >
                            Восстановить пароль
                          </span>
                        </div>
                        <div className="auth-input-container">
                          <div className="auth-input-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          </div>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="auth-input"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <Spacing size={24} />

                  {!isRecovery && (
                    <Button
                      className="auth-submit-btn"
                      size="l"
                      stretched
                      type="submit"
                      disabled={isSubmitDisabled}
                      loading={loading}
                    >
                      {isRegister ? 'Зарегистрироваться' : 'Войти'}
                    </Button>
                  )}

                  {!isRecovery && (
                    <>
                      <Spacing size={16} />

                      <Box className="auth-divider">
                        <span className="auth-divider-line"></span>
                        <span className="auth-divider-text">или</span>
                        <span className="auth-divider-line"></span>
                      </Box>

                      <Spacing size={16} />

                      <Button
                        mode="secondary"
                        className="auth-toggle-btn"
                        onClick={handleToggleMode}
                        disabled={loading}
                      >
                        {isRegister ? 'Уже есть аккаунт? Войти' : 'Создать аккаунт'}
                      </Button>
                    </>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}
