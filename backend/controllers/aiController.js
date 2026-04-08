import axios from "axios"

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

const chatGemini = async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return res.json({ success: false, message: "Gemini API key not configured" })
        }

        const { messages } = req.body

        const contents = (messages || []).map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.text || "") }]
        }))

        const systemParts = [{ text: "You are a friendly, concise assistant for a healthcare appointment site. Keep replies short, clear, and helpful." }]

        const payload = {
            contents: [
                { role: "user", parts: systemParts },
                ...contents.length ? contents : [{ role: "user", parts: [{ text: "Hello" }] }]
            ]
        }

        const { data } = await axios.post(`${GEMINI_ENDPOINT}?key=${apiKey}`, payload)

        const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") || "Sorry, I could not generate a response."

        res.json({ success: true, reply })
    } catch (error) {
        const message = error?.response?.data?.error?.message || error?.message || "Unknown error"
        res.json({ success: false, message })
    }
}

export { chatGemini }
