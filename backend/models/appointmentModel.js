import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    priorityScore: { type: Number, default: 0 },
    highRiskPriority: { type: Boolean, default: false },
    queuePosition: { type: Number, default: 0 },
    waitTime: { type: Number, default: 0 },
    estimatedWaitTime: { type: Number, default: 0 },
    userData: { type: Object, required: true },
    docData: { type: Object, required: true },
    amount: { type: Number, required: true },
    consultationFee: { type: Number, default: 0 },
    selectedTests: { type: [Object], default: [] },
    costBreakdown: { type: Object, default: {} },
    advancePaymentAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, default: 'pending' },
    date: { type: Number, required: true },
    cancelled: { type: Boolean, default: false },
    payment: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false }
})

const appointmentModel = mongoose.models.appointment || mongoose.model("appointment", appointmentSchema)
export default appointmentModel
