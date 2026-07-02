type GuardOptions = {
  userId?: string | null
  action: string
  scope?: string
  text?: string
  minIntervalMs: number
  maxActions: number
  windowMs: number
  duplicateWindowMs?: number
}

type GuardEntry = {
  timestamps: number[]
  lastText?: string
  lastTextAt?: number
}

const STORAGE_KEY = 'vihton-interaction-guards-v1'

let memoryState: Record<string, GuardEntry> = {}

function getStorage(): Record<string, GuardEntry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return memoryState
    const parsed = JSON.parse(raw) as Record<string, GuardEntry>
    memoryState = parsed
    return parsed
  } catch {
    return memoryState
  }
}

function saveStorage(next: Record<string, GuardEntry>) {
  memoryState = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage quota/privacy mode issues and keep in-memory fallback.
  }
}

function normalizeText(text?: string) {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function formatWait(ms: number) {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000))
  if (totalSeconds < 60) {
    return `${totalSeconds} сек.`
  }
  const minutes = Math.ceil(totalSeconds / 60)
  return `${minutes} мин.`
}

export function validateContentSafety(text: string, maxLinks = 2) {
  const normalized = normalizeText(text)
  const linksCount = (normalized.match(/(https?:\/\/|www\.)/g) || []).length

  if (linksCount > maxLinks) {
    return 'Слишком много ссылок в одном сообщении. Уберите лишние ссылки.'
  }

  if (/(.)\1{9,}/.test(normalized)) {
    return 'Слишком много повторяющихся символов. Сделайте текст короче и понятнее.'
  }

  if (/(\b\w+\b)(\s+\1){5,}/i.test(normalized)) {
    return 'Похоже на спам из повторяющихся слов. Измените текст.'
  }

  return null
}

export function checkInteractionGuard({
  userId,
  action,
  scope = 'global',
  text,
  minIntervalMs,
  maxActions,
  windowMs,
  duplicateWindowMs = minIntervalMs * 3
}: GuardOptions) {
  const actorKey = userId || 'guest'
  const storageKey = `${actorKey}:${action}:${scope}`
  const store = getStorage()
  const current = store[storageKey] || { timestamps: [] }
  const now = Date.now()
  const recentTimestamps = current.timestamps.filter((ts) => now - ts < windowMs)

  const lastActionAt = recentTimestamps[recentTimestamps.length - 1]
  if (lastActionAt && now - lastActionAt < minIntervalMs) {
    return {
      allowed: false,
      message: `Слишком часто. Подождите ${formatWait(minIntervalMs - (now - lastActionAt))} и попробуйте снова.`
    }
  }

  if (recentTimestamps.length >= maxActions) {
    const oldestTs = recentTimestamps[0]
    return {
      allowed: false,
      message: `Лимит действий временно достигнут. Попробуйте снова через ${formatWait(windowMs - (now - oldestTs))}.`
    }
  }

  const normalized = normalizeText(text)
  if (
    normalized &&
    current.lastText &&
    normalized === current.lastText &&
    current.lastTextAt &&
    now - current.lastTextAt < duplicateWindowMs
  ) {
    return {
      allowed: false,
      message: 'Похоже на повтор одного и того же текста. Подождите немного перед повторной отправкой.'
    }
  }

  return { allowed: true, message: null }
}

export function recordInteraction({
  userId,
  action,
  scope = 'global',
  text,
  windowMs
}: Pick<GuardOptions, 'userId' | 'action' | 'scope' | 'text' | 'windowMs'>) {
  const actorKey = userId || 'guest'
  const storageKey = `${actorKey}:${action}:${scope}`
  const store = getStorage()
  const current = store[storageKey] || { timestamps: [] }
  const now = Date.now()

  const nextEntry: GuardEntry = {
    timestamps: [...current.timestamps.filter((ts) => now - ts < windowMs), now],
    lastText: normalizeText(text),
    lastTextAt: text?.trim() ? now : current.lastTextAt
  }

  saveStorage({
    ...store,
    [storageKey]: nextEntry
  })
}
