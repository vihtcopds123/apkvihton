const BOT_TOKEN = '8949101826:AAFG1feLFdrnY-rioZWshB5WRPUBwt4suqI'
const BASE_URL = '/tg-api'

// We will dynamically update the target chat ID.
export let TELEGRAM_CHAT_ID = localStorage.getItem('vh_tg_chat_id') || '-1004292795079'

export const setTelegramChatId = (id: string) => {
  TELEGRAM_CHAT_ID = id
  localStorage.setItem('vh_tg_chat_id', id)
}

/**
 * Uploads any file or blob to Telegram channel and returns a direct proxy URL.
 */
export async function uploadToTelegram(
  file: File | Blob, 
  fileName: string, 
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  const formData = new FormData()
  formData.append('chat_id', TELEGRAM_CHAT_ID)
  
  // Use document type to preserve original format and size up to 2GB
  formData.append('document', file, fileName)

  const uploadResult = await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      abortSignal.addEventListener('abort', () => {
        xhr.abort()
        reject(new DOMException('Aborted', 'AbortError'))
      })
    }

    xhr.open('POST', `${BASE_URL}/bot${BOT_TOKEN}/sendDocument`)

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          onProgress(percent)
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch (err) {
          reject(new Error('Failed to parse response from Telegram API'))
        }
      } else {
        reject(new Error(`Failed to upload to Telegram: ${xhr.statusText} (${xhr.responseText})`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload to Telegram'))
    xhr.send(formData)
  })

  if (!uploadResult.ok) {
    throw new Error(`Telegram error: ${uploadResult.description}`)
  }

  // Handle case where any media object is returned (document, video, photo, voice, video_note, animation, audio)
  const resMsg = uploadResult.result
  const mediaObj = resMsg.document || 
                   resMsg.audio ||
                   resMsg.video || 
                   resMsg.photo || 
                   resMsg.voice || 
                   resMsg.video_note || 
                   resMsg.animation
                   
  const doc = Array.isArray(mediaObj) ? mediaObj[mediaObj.length - 1] : mediaObj
  if (!doc || !doc.file_id) {
    throw new Error('No valid media object or file_id returned from Telegram: ' + JSON.stringify(resMsg))
  }
  
  const fileId = doc.file_id

  // Retrieve file_path to construct a direct download link
  const fileInfoResponse = await fetch(`${BASE_URL}/bot${BOT_TOKEN}/getFile?file_id=${fileId}`, {
    signal: abortSignal
  })
  if (!fileInfoResponse.ok) {
    throw new Error('Failed to get file info from Telegram')
  }

  const fileInfoResult = await fileInfoResponse.json()
  if (!fileInfoResult.ok) {
    throw new Error(`Telegram getFile error: ${fileInfoResult.description}`)
  }

  let filePath = fileInfoResult.result.file_path

  // In --local mode, filePath can be absolute (e.g. /var/lib/telegram-bot-api/<token>/videos/file_4)
  // We need to keep only the relative portion (e.g. videos/file_4)
  const tokenPrefix = `${BOT_TOKEN}/`
  const botTokenPrefix = `bot${BOT_TOKEN}/`

  if (filePath.includes(tokenPrefix)) {
    filePath = filePath.substring(filePath.indexOf(tokenPrefix) + tokenPrefix.length)
  } else if (filePath.includes(botTokenPrefix)) {
    filePath = filePath.substring(filePath.indexOf(botTokenPrefix) + botTokenPrefix.length)
  } else {
    const match = filePath.match(/\/var\/lib\/telegram-bot-api\/[^/]+\/(.+)$/)
    if (match) {
      filePath = match[1]
    }
  }

  // Construct direct link served by local Bot API via Nginx HTTPS proxy
  return `${window.location.origin}/tg-api/file/bot${BOT_TOKEN}/${filePath}?file_id=${fileId}`
}
