import { useContext, useEffect, useRef, useState } from "react"
import axios from "axios"
import { AppContext } from "../context/AppContext"
import { assets } from "../assets/assets"

const Chatbot = () => {
    const { backendUrl } = useContext(AppContext)
    const [open, setOpen] = useState(false)
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [messages, setMessages] = useState([
        { role: "assistant", text: "Hi! I’m Prescripto’s assistant. How can I help you today?" }
    ])
    const listRef = useRef(null)

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight
        }
    }, [messages, open])

    const sendMessage = async () => {
        const value = input.trim()
        if (!value || loading) return
        const next = [...messages, { role: "user", text: value }]
        setMessages(next)
        setInput("")
        setLoading(true)
        try {
            const { data } = await axios.post(backendUrl + "/api/ai/chat", { messages: next })
            if (data?.success) {
                setMessages([...next, { role: "assistant", text: data.reply }])
            } else {
                setMessages([...next, { role: "assistant", text: "Sorry, I ran into an issue. Please try again." }])
            }
        } catch (e) {
            setMessages([...next, { role: "assistant", text: "Network error. Please try again." }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(o => !o)}
                className="fixed bottom-6 right-6 z-30 bg-primary text-white p-4 rounded-full shadow-lg hover:scale-105 transition-transform"
                aria-label="Chat with assistant"
            >
                <img src={assets.chats_icon} className="w-6 h-6 invert-0" alt="" />
            </button>

            {open ? (
                <div className="fixed bottom-24 right-6 z-30 w-[94vw] max-w-sm bg-white rounded-2xl shadow-2xl border border-[#EAEAEA] flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <p className="text-sm font-semibold text-[#262626]">Chat with Prescripto</p>
                        <button onClick={() => setOpen(false)} className="text-[#595959] hover:text-black">×</button>
                    </div>

                    <div ref={listRef} className="px-3 py-3 h-80 overflow-y-auto flex flex-col gap-3">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`${m.role === "user" ? "bg-primary text-white" : "bg-[#F5F6FF] text-[#262626]"} px-3 py-2 rounded-2xl max-w-[80%] text-sm`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {loading ? (
                            <div className="flex justify-start">
                                <div className="bg-[#F5F6FF] text-[#262626] px-3 py-2 rounded-2xl text-sm">Thinking...</div>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2 px-3 py-3 border-t">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") sendMessage() }}
                            placeholder="Type your message..."
                            className="flex-1 border border-[#DADADA] rounded-full px-4 py-2 text-sm outline-none"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading}
                            className="bg-primary text-white px-4 py-2 rounded-full text-sm disabled:opacity-60"
                        >
                            Send
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    )
}

export default Chatbot
