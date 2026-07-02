import React, { useEffect, useState } from "react"
import { Spinner } from "@vkontakte/vkui"
import { supabase } from "../supabaseClient"
import { useAuthStore } from "../store/useAuthStore"
import { CustomAvatar } from "./CustomAvatar"

interface ChannelPost {
  id: string
  content: string | null
  images: string[] | null
}

interface ChannelShareSheetProps {
  post: ChannelPost
  channelId: string
  channelName: string
  channelAvatar?: string | null
  onClose: () => void
}

interface Contact {
  id: string
  convId?: string
  full_name: string | null
  avatar_url: string | null
  isSaved?: boolean
}

export const ChannelShareSheet: React.FC<ChannelShareSheetProps> = ({
  post, channelId, channelName, channelAvatar, onClose
}) => {
  const { profile } = useAuthStore()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 320)
  }

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      setLoading(true)
      try {
        const { data: convData } = await supabase
          .from("conversations")
          .select(`id, participant_1:profiles!conversations_participant_1_fkey(id, full_name, avatar_url), participant_2:profiles!conversations_participant_2_fkey(id, full_name, avatar_url)`)
          .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
          .order("updated_at", { ascending: false })
          .limit(60)

        const convList: Contact[] = []
        const convUserIds = new Set<string>()
        let savedMessagesContact: Contact | null = null

        if (convData) {
          convData.forEach((item: any) => {
            const isSaved = item.participant_1.id === item.participant_2.id
            const other = item.participant_1.id === profile.id ? item.participant_2 : item.participant_1
            
            const contactItem: Contact = { 
              id: other.id, 
              convId: item.id, 
              full_name: isSaved ? "Избранное" : other.full_name, 
              avatar_url: isSaved ? null : other.avatar_url,
              isSaved
            }

            if (isSaved) {
              savedMessagesContact = contactItem
            } else {
              convList.push(contactItem)
              convUserIds.add(other.id)
            }
          })
        }

        if (!savedMessagesContact) {
          savedMessagesContact = {
            id: profile.id,
            full_name: "Избранное",
            avatar_url: null,
            isSaved: true
          }
        }

        const { data: friendData } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url)")
          .eq("status", "accepted")
          .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
          .limit(50)

        const friendList: Contact[] = []
        if (friendData) {
          friendData.forEach((f: any) => {
            const other = f.requester_id === profile.id ? f.addressee : f.requester
            if (other.id !== profile.id && !convUserIds.has(other.id)) {
              friendList.push({ id: other.id, full_name: other.full_name, avatar_url: other.avatar_url })
            }
          })
        }
        setContacts([savedMessagesContact, ...convList, ...friendList])
      } catch (err) {
        console.error("share sheet load error", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const buildShareContent = () => {
    const textPart = (post.content || "").slice(0, 300) + ((post.content || "").length > 300 ? "..." : "")
    return JSON.stringify({
      type: "channel_forward",
      channelId,
      channelName,
      channelAvatar: channelAvatar || null,
      postId: post.id,
      text: textPart,
      images: post.images || []
    })
  }

  const handleSend = async () => {
    if (!profile || selected.size === 0 || sending) return
    setSending(true)
    try {
      const content = buildShareContent()
      const selectedContacts = contacts.filter(c => selected.has(c.id))

      for (const contact of selectedContacts) {
        let convId = contact.convId
        if (!convId) {
          const { data: existConv } = await supabase
            .from("conversations")
            .select("id")
            .or(`and(participant_1.eq.${profile.id},participant_2.eq.${contact.id}),and(participant_1.eq.${contact.id},participant_2.eq.${profile.id})`)
            .maybeSingle()

          if (existConv) {
            convId = existConv.id
          } else {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({ participant_1: profile.id, participant_2: contact.id })
              .select("id")
              .single()
            if (newConv) convId = newConv.id
          }
        }
        const messageId = crypto.randomUUID()
        const newMsgPayload = {
          id: messageId,
          conversation_id: convId,
          sender_id: profile.id,
          content,
          created_at: new Date().toISOString(),
          is_read: false
        }

        const { error } = await supabase
          .from("messages")
          .insert({
            id: messageId,
            conversation_id: convId,
            sender_id: profile.id,
            content
          })

        if (error) {
          console.error("DB insert error", error)
          continue
        }

        const senderPayload = {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          username: profile.username
        }

        // 2. Отправим в Broadcast канал чата
        const chatChan = supabase.channel(`chat:${convId}`)
        chatChan.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            chatChan.send({
              type: 'broadcast',
              event: 'new-message',
              payload: { message: newMsgPayload }
            }).then(() => {
              supabase.removeChannel(chatChan)
            })
          }
        })

        // 3. Отправим в персональный канал получателя (если это не сам отправитель)
        if (contact.id !== profile.id) {
          const personalChan = supabase.channel(`user_calls:${contact.id}`)
          personalChan.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              personalChan.send({
                type: 'broadcast',
                event: 'message:new',
                payload: { message: newMsgPayload, sender: senderPayload }
              }).then(() => {
                supabase.removeChannel(personalChan)
              })
            }
          })
        }
      }

      setSent(true)
      setTimeout(() => handleClose(), 1200)
    } catch (err) {
      console.error("share send error", err)
    } finally {
      setSending(false)
    }
  }

  const filtered = contacts.filter(c =>
    !search || (c.full_name || "").toLowerCase().includes(search.toLowerCase())
  )

  const previewText = (post.content || "").slice(0, 80) + ((post.content || "").length > 80 ? "..." : "")

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30000, display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", paddingTop: "80px", pointerEvents: visible ? "auto" : "none" }}>
      <div onClick={handleClose} style={{ position: "absolute", inset: 0, background: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)", backdropFilter: visible ? "blur(8px)" : "none", WebkitBackdropFilter: visible ? "blur(8px)" : "none", transition: "background 0.32s ease" }} />
      <div style={{ position: "relative", zIndex: 1, width: "calc(100% - 32px)", maxWidth: 410, background: "linear-gradient(160deg, rgba(24,24,40,0.99) 0%, rgba(14,14,28,0.99) 100%)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "24px", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", maxHeight: "68vh", transform: visible ? "translateY(0)" : "translateY(-120%)", opacity: visible ? 1 : 0, transition: "transform 0.38s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {channelAvatar ? <img src={channelAvatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 18 }}>📢</span>}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Переслать из {channelName}</div>
              {previewText && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 1, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewText}</div>}
            </div>
          </div>
          <button onClick={handleClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.55)", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "8px 14px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." style={{ background: "none", border: "none", outline: "none", fontSize: 14, color: "#fff", width: "100%", caretColor: "#0077ff" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 0, fontSize: 14 }}>✕</button>}
          </div>
        </div>

        {selected.size > 0 && (
          <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,119,255,0.15)", border: "1px solid rgba(0,119,255,0.28)", borderRadius: 20, padding: "4px 12px", fontSize: 13, color: "#4da3ff", fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Выбрано: {selected.size}
            </div>
            <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 12, padding: 0 }}>Очистить</button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 4px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner size="m" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.28)", fontSize: 14 }}>{search ? "Ничего не найдено" : "Нет диалогов"}</div>
          ) : filtered.map(contact => {
            const isSelected = selected.has(contact.id)
            return (
              <div key={contact.id} onClick={() => toggle(contact.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 14, cursor: "pointer", background: isSelected ? "rgba(0,119,255,0.11)" : "transparent", transition: "background 0.15s ease", marginBottom: 2 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {contact.isSaved ? (
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #0077ff 0%, #005fd4 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", boxShadow: "0 0 12px rgba(0,119,255,0.3)" }}>
                      ⭐
                    </div>
                  ) : (
                    <CustomAvatar size={42} src={contact.avatar_url} name={contact.full_name} id={contact.id} />
                  )}
                  <div style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: isSelected ? "#0077ff" : "rgba(0,0,0,0.5)", border: `2px solid ${isSelected ? "#0077ff" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", boxShadow: isSelected ? "0 0 8px rgba(0,119,255,0.5)" : "none" }}>
                    {isSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.full_name || "Пользователь"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{contact.isSaved ? "Личный архив" : contact.convId ? "Диалог" : "Друг"}</div>
                </div>
                {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0077ff", flexShrink: 0, boxShadow: "0 0 6px #0077ff" }} />}
              </div>
            )
          })}
        </div>

        <div style={{ padding: "12px 16px 24px" }}>
          <button
            onClick={sent ? undefined : handleSend}
            disabled={selected.size === 0 || sending}
            style={{ width: "100%", height: 50, borderRadius: 16, border: "none", background: sent ? "linear-gradient(135deg,#34c759,#30a64d)" : selected.size === 0 ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#0077ff 0%,#005fd4 100%)", color: selected.size === 0 && !sent ? "rgba(255,255,255,0.25)" : "#fff", fontSize: 15, fontWeight: 600, cursor: selected.size === 0 || sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.25s ease", boxShadow: selected.size > 0 && !sent ? "0 4px 20px rgba(0,119,255,0.35)" : "none" }}
          >
            {sending ? <Spinner size="s" /> : sent ? (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Отправлено!</>
            ) : (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>{selected.size > 0 ? `Отправить (${selected.size})` : "Выберите получателя"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
