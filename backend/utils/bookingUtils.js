import appointmentModel from "../models/appointmentModel.js";

const DEMO_TEST_CATALOG = [
    { id: "blood-panel", label: "Blood Panel", cost: 600 },
    { id: "ultrasound", label: "Ultrasound", cost: 1200 },
    { id: "ecg", label: "ECG", cost: 850 }
]

const DEFAULT_INSURANCE_BY_SPECIALITY = {
    "General physician": ["Self Pay", "Health Shield Basic", "MediCare Plus"],
    Gynecologist: ["Self Pay", "Women Care", "MediCare Plus"],
    Dermatologist: ["Self Pay", "Skin Secure", "Health Shield Basic"],
    Pediatricians: ["Self Pay", "Family Protect", "MediCare Plus"],
    Neurologist: ["Self Pay", "Neuro Assist", "Premium Care"],
    Gastroenterologist: ["Self Pay", "Digestive Cover", "Premium Care"]
}

const normalizeSelectedTests = (selectedTests = []) => {
    const uniqueTestIds = [...new Set(selectedTests)]
    return uniqueTestIds
        .map((testId) => DEMO_TEST_CATALOG.find((test) => test.id === testId))
        .filter(Boolean)
}

const getDoctorAcceptedInsurance = (doctor) => {
    if (doctor?.acceptedInsurance?.length) {
        return doctor.acceptedInsurance
    }

    return DEFAULT_INSURANCE_BY_SPECIALITY[doctor?.speciality] || ["Self Pay"]
}

const getInsuranceCoverage = (userInsurance, doctor) => {
    const acceptedInsurance = getDoctorAcceptedInsurance(doctor)
    const normalizedInsurance = userInsurance || "Self Pay"
    const isCovered = acceptedInsurance.includes(normalizedInsurance)

    return {
        userInsurance: normalizedInsurance,
        acceptedInsurance,
        isCovered,
        coverageLabel: isCovered ? "Covered" : "Not Covered"
    }
}

const calculateBookingCosts = (doctor, selectedTests = []) => {
    const normalizedTests = normalizeSelectedTests(selectedTests)
    const consultationFee = Number(doctor?.fees || 0)
    const testsCost = normalizedTests.reduce((totalCost, test) => totalCost + test.cost, 0)
    const totalCost = consultationFee + testsCost
    const advancePaymentAmount = Math.max(100, Math.round(totalCost * 0.2))

    return {
        consultationFee,
        selectedTests: normalizedTests,
        testsCost,
        totalCost,
        advancePaymentAmount,
        costBreakdown: {
            consultationFee,
            testsCost,
            totalCost,
            advancePaymentAmount
        }
    }
}

const isSlotAvailable = async (docId, slotDate, slotTime) => {
    const existingAppointment = await appointmentModel.findOne({
        docId,
        slotDate,
        slotTime,
        cancelled: false,
        isCompleted: false
    })

    return !existingAppointment
}

export {
    DEMO_TEST_CATALOG,
    calculateBookingCosts,
    DEFAULT_INSURANCE_BY_SPECIALITY,
    getDoctorAcceptedInsurance,
    getInsuranceCoverage,
    isSlotAvailable,
    normalizeSelectedTests
}

export default {
    DEMO_TEST_CATALOG,
    calculateBookingCosts,
    DEFAULT_INSURANCE_BY_SPECIALITY,
    getDoctorAcceptedInsurance,
    getInsuranceCoverage,
    isSlotAvailable,
    normalizeSelectedTests
}
