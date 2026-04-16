import appointmentModel from "../models/appointmentModel.js";

const QUEUE_WAIT_TIME_PER_PATIENT = 10
const queueSort = { priorityScore: -1, date: 1, _id: 1 }

const getQueueMetrics = (position) => ({
    queuePosition: position,
    waitTime: Math.max(0, position - 1) * QUEUE_WAIT_TIME_PER_PATIENT,
    estimatedWaitTime: Math.max(0, position - 1) * QUEUE_WAIT_TIME_PER_PATIENT
})

const getActiveQueueProjection = async (docId, slotDate, priorityScore) => {
    const appointments = await appointmentModel
        .find({ docId, slotDate, cancelled: false, isCompleted: false })
        .sort(queueSort)

    const patientsAhead = appointments.filter((appointment) => appointment.priorityScore >= priorityScore).length
    const queuePosition = patientsAhead + 1
    const waitTime = patientsAhead * QUEUE_WAIT_TIME_PER_PATIENT

    return {
        queuePosition,
        waitTime,
        estimatedWaitTime: waitTime,
        patientsAhead
    }
}

const syncAppointmentQueue = async (docId, slotDate) => {
    const appointments = await appointmentModel.find({ docId, slotDate }).sort(queueSort)

    if (!appointments.length) {
        return []
    }

    let activePosition = 0
    const updates = appointments.map((appointment) => {
        const isActive = !appointment.cancelled && !appointment.isCompleted
        const queueData = isActive
            ? getQueueMetrics(++activePosition)
            : { queuePosition: 0, waitTime: 0, estimatedWaitTime: 0 }

        return {
            _id: String(appointment._id),
            ...queueData
        }
    })

    await appointmentModel.bulkWrite(
        updates.map((appointment) => ({
            updateOne: {
                filter: { _id: appointment._id },
                update: {
                    queuePosition: appointment.queuePosition,
                    waitTime: appointment.waitTime,
                    estimatedWaitTime: appointment.estimatedWaitTime
                }
            }
        }))
    )

    return updates
}

export { QUEUE_WAIT_TIME_PER_PATIENT, getActiveQueueProjection, syncAppointmentQueue }

export default {
    QUEUE_WAIT_TIME_PER_PATIENT,
    getActiveQueueProjection,
    syncAppointmentQueue
}
