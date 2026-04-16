import express from "express"
import { chatGemini } from "../controllers/aiController.js"

const aiRouter = express.Router()

aiRouter.post("/chat", chatGemini)

export default aiRouter
