import React from 'react'

interface FormattedTextProps {
  content: string | null | undefined
  images?: string[] | null
  onImageClick?: (urls: string[], index: number) => void
}

export const FormattedText: React.FC<FormattedTextProps> = ({ content, images, onImageClick }) => {
  if (!content) return null

  // 1. Split into lines to identify blockquotes and inline photos
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  
  let currentQuoteLines: string[] = []

  const flushQuote = (key: string | number) => {
    if (currentQuoteLines.length > 0) {
      blocks.push(
        <blockquote key={`quote-${key}`} style={{
          borderLeft: '3px solid #34c759', // Telegram green success border color
          backgroundColor: 'rgba(52, 199, 89, 0.06)', // Translucent light green background
          padding: '8px 14px',
          margin: '8px 0',
          borderRadius: '4px 8px 8px 4px',
          color: 'var(--vkui--color_text_primary)',
          fontSize: '14.5px',
          lineHeight: '1.5',
          fontStyle: 'normal',
          textAlign: 'left'
        }}>
          {currentQuoteLines.map((line, idx) => (
            <div key={idx} style={{ minHeight: '1.2em' }}>{parseInlineFormatting(line)}</div>
          ))}
        </blockquote>
      )
      currentQuoteLines = []
    }
  }

  lines.forEach((line, index) => {
    if (line.trim().startsWith('>')) {
      // Remove the '>' and optional leading space
      const quoteText = line.replace(/^\s*>\s?/, '')
      currentQuoteLines.push(quoteText)
      return
    }

    // Flush any pending quote
    flushQuote(index)

    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('# ')) {
      blocks.push(
        <h1 key={`h1-${index}`} style={{ fontSize: 22, fontWeight: 700, margin: '14px 0 6px 0', color: 'var(--vkui--color_text_primary)', textAlign: 'left', lineHeight: 1.3 }}>
          {parseInlineFormatting(trimmedLine.slice(2))}
        </h1>
      )
      return
    }
    if (trimmedLine.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${index}`} style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 4px 0', color: 'var(--vkui--color_text_primary)', textAlign: 'left', lineHeight: 1.3 }}>
          {parseInlineFormatting(trimmedLine.slice(3))}
        </h2>
      )
      return
    }
    if (trimmedLine.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${index}`} style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 2px 0', color: 'var(--vkui--color_text_primary)', textAlign: 'left', lineHeight: 1.3 }}>
          {parseInlineFormatting(trimmedLine.slice(4))}
        </h3>
      )
      return
    }

    // Check for inline/embedded photos within the line
    const photoRegex = /(\[photo[1-5]\])/i
    const parts = line.split(photoRegex)

    if (parts.length > 1 && images) {
      const lineElements: React.ReactNode[] = []
      parts.forEach((part, pIdx) => {
        const photoMatch = part.match(/^\[photo([1-5])\]$/i)
        if (photoMatch) {
          const photoIdx = parseInt(photoMatch[1], 10) - 1
          if (photoIdx >= 0 && photoIdx < images.length) {
            lineElements.push(
              <span key={`photo-${index}-${pIdx}`} style={{ display: 'block', margin: '12px 0', textAlign: 'center' }}>
                <img 
                  src={images[photoIdx]} 
                  style={{ maxWidth: '90%', maxHeight: 280, borderRadius: 12, display: 'block', margin: '0 auto', objectFit: 'contain', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid rgba(255, 255, 255, 0.08)', cursor: onImageClick ? 'pointer' : 'default' }} 
                  alt={`Фото ${photoIdx + 1}`}
                  onClick={() => {
                    console.log('FormattedText: img clicked', images, photoIdx, !!onImageClick)
                    if (onImageClick) onImageClick(images, photoIdx)
                  }}
                />
              </span>
            )
            return
          }
        }
        
        if (part) {
          lineElements.push(
            <span key={`text-${index}-${pIdx}`}>
              {parseInlineFormatting(part)}
            </span>
          )
        }
      })

      blocks.push(
        <div key={`p-photo-${index}`} style={{ margin: '4px 0', minHeight: '1.2em' }}>
          {lineElements}
        </div>
      )
    } else {
      blocks.push(
        <div key={`p-${index}`} style={{ margin: '4px 0', minHeight: '1.2em' }}>
          {parseInlineFormatting(line)}
        </div>
      )
    }
  })
  
  // Flush any remaining quote at the end
  flushQuote('end')

  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {blocks}
    </div>
  )
}

// Helper to map and flatten arrays of tokens
const flatMapTokens = (tokens: Token[], fn: (token: Token) => Token[]): Token[] => {
  const result: Token[] = []
  tokens.forEach(token => {
    result.push(...fn(token))
  })
  return result
}

interface Token {
  type: 'text' | 'bold' | 'italic' | 'link' | 'raw-link' | 'code' | 'strikethrough'
  text: string
  url?: string
}

// Inline formatting parser
const parseInlineFormatting = (text: string): React.ReactNode[] => {
  if (!text) return []

  let tokens: Token[] = [{ type: 'text', text }]

  // 1. Parse markdown links [label](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  tokens = flatMapTokens(tokens, (token) => {
    if (token.type !== 'text') return [token]
    const result: Token[] = []
    let lastIndex = 0
    let match
    while ((match = linkRegex.exec(token.text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: token.text.substring(lastIndex, match.index) })
      }
      result.push({ type: 'link', text: match[1], url: match[2] })
      lastIndex = linkRegex.lastIndex
    }
    if (lastIndex < token.text.length) {
      result.push({ type: 'text', text: token.text.substring(lastIndex) })
    }
    return result
  })

  // 2. Parse bold **text**
  const boldRegex = /\*\*([^*]+)\*\*/g
  tokens = flatMapTokens(tokens, (token) => {
    if (token.type !== 'text') return [token]
    const result: Token[] = []
    let lastIndex = 0
    let match
    while ((match = boldRegex.exec(token.text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: token.text.substring(lastIndex, match.index) })
      }
      result.push({ type: 'bold', text: match[1] })
      lastIndex = boldRegex.lastIndex
    }
    if (lastIndex < token.text.length) {
      result.push({ type: 'text', text: token.text.substring(lastIndex) })
    }
    return result
  })

  // 3. Parse italic *text*
  const italicRegex = /\*([^*]+)\*/g
  tokens = flatMapTokens(tokens, (token) => {
    if (token.type !== 'text') return [token]
    const result: Token[] = []
    let lastIndex = 0
    let match
    while ((match = italicRegex.exec(token.text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: token.text.substring(lastIndex, match.index) })
      }
      result.push({ type: 'italic', text: match[1] })
      lastIndex = italicRegex.lastIndex
    }
    if (lastIndex < token.text.length) {
      result.push({ type: 'text', text: token.text.substring(lastIndex) })
    }
    return result
  })

  // 4. Parse strikethrough ~~text~~
  const strikeRegex = /~~([^~]+)~~/g
  tokens = flatMapTokens(tokens, (token) => {
    if (token.type !== 'text') return [token]
    const result: Token[] = []
    let lastIndex = 0
    let match
    while ((match = strikeRegex.exec(token.text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: token.text.substring(lastIndex, match.index) })
      }
      result.push({ type: 'strikethrough', text: match[1] })
      lastIndex = strikeRegex.lastIndex
    }
    if (lastIndex < token.text.length) {
      result.push({ type: 'text', text: token.text.substring(lastIndex) })
    }
    return result
  })

  // 5. Parse inline code `text`
  const codeRegex = /`([^`]+)`/g
  tokens = flatMapTokens(tokens, (token) => {
    if (token.type !== 'text') return [token]
    const result: Token[] = []
    let lastIndex = 0
    let match
    while ((match = codeRegex.exec(token.text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: token.text.substring(lastIndex, match.index) })
      }
      result.push({ type: 'code', text: match[1] })
      lastIndex = codeRegex.lastIndex
    }
    if (lastIndex < token.text.length) {
      result.push({ type: 'text', text: token.text.substring(lastIndex) })
    }
    return result
  })

  // 6. Parse raw URLs (like anviht.ru/lk or https://google.com)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?:\/[^\s]*)?)/g
  tokens = flatMapTokens(tokens, (token) => {
    if (token.type !== 'text') return [token]
    const result: Token[] = []
    let lastIndex = 0
    let match
    while ((match = urlRegex.exec(token.text)) !== null) {
      const matchedStr = match[1]
      const index = match.index
      const charBefore = index > 0 ? token.text[index - 1] : ''
      
      // Skip email addresses
      if (charBefore === '@') {
        continue
      }
      
      if (index > lastIndex) {
        result.push({ type: 'text', text: token.text.substring(lastIndex, index) })
      }
      
      let href = matchedStr
      if (!/^https?:\/\//i.test(href)) {
        href = 'https://' + href
      }

      result.push({ type: 'raw-link', text: matchedStr, url: href })
      lastIndex = urlRegex.lastIndex
    }
    if (lastIndex < token.text.length) {
      result.push({ type: 'text', text: token.text.substring(lastIndex) })
    }
    return result
  })

  // Convert tokens to React elements
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'bold':
        return <strong key={i} style={{ fontWeight: 'bold' }}>{token.text}</strong>
      case 'italic':
        return <em key={i} style={{ fontStyle: 'italic' }}>{token.text}</em>
      case 'strikethrough':
        return <s key={i}>{token.text}</s>
      case 'code': {
        let copied = false
        return (
          <code
            key={i}
            title="Нажмите, чтобы скопировать"
            onClick={(e) => {
              const el = e.currentTarget
              if (copied) return
              copied = true
              navigator.clipboard.writeText(token.text).catch(() => {})
              const prev = el.style.background
              el.style.background = 'rgba(0,200,100,0.25)'
              el.style.color = '#34c759'
              setTimeout(() => {
                el.style.background = prev
                el.style.color = ''
                copied = false
              }, 1200)
            }}
            style={{
              fontFamily: '"SF Mono", "Fira Mono", Menlo, Monaco, Consolas, monospace',
              fontSize: '0.88em',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 5,
              padding: '1px 6px',
              cursor: 'pointer',
              userSelect: 'all',
              transition: 'background 0.2s, color 0.2s',
              whiteSpace: 'pre'
            }}
          >
            {token.text}
          </code>
        )
      }
      case 'link':
      case 'raw-link':
        return (
          <a
            key={i}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0077ff', textDecoration: 'none', fontWeight: 500 }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            {token.text}
          </a>
        )
      default:
        return <React.Fragment key={i}>{token.text}</React.Fragment>
    }
  })
}
