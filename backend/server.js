import express from "express"
import cors from 'cors'
import 'dotenv/config'
import http from 'http'
import connectDB from "./config/mongodb.js"
import connectCloudinary from "./config/cloudinary.js"
import userRouter from "./routes/userRoute.js"
import doctorRouter from "./routes/doctorRoute.js"
import adminRouter from "./routes/adminRoute.js"
import aiRouter from "./routes/aiRoute.js"
import ambulanceRouter from "./routes/ambulanceRoute.js"
import { initSocket } from "./sockets/ambulanceSocket.js"

// app config
const app = express()
const server = http.createServer(app)
const port = process.env.PORT || 4000
connectDB()
connectCloudinary()

// init socket
initSocket(server)

// middlewares
app.use(express.json())
app.use(cors())

// api endpoints
app.use("/api/user", userRouter)
app.use("/api/admin", adminRouter)
app.use("/api/doctor", doctorRouter)
app.use("/api/ai", aiRouter)
app.use("/api/ambulance", ambulanceRouter)

app.get("/", (req, res) => {
  res.send("API Working")
});

server.listen(port, () => console.log(`Server started on PORT:${port}`))
