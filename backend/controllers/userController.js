import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { calculatePriority, isHighRiskPriority } from "../utils/fuzzyModel.js";
import { getActiveQueueProjection, syncAppointmentQueue } from "../utils/appointmentQueue.js";
import { DEMO_TEST_CATALOG, calculateBookingCosts, getDoctorAcceptedInsurance, getInsuranceCoverage, isSlotAvailable } from "../utils/bookingUtils.js";
import { v2 as cloudinary } from 'cloudinary'
import stripe from "stripe";
import razorpay from 'razorpay';

// Gateway Initialize
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)
const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const appointmentSort = { priorityScore: -1, date: 1 }
const PAYMENT_AUTHORIZATION_EXPIRY = '20m'

const parseSlotDate = (slotDate) => {
    const [day, month, year] = slotDate.split("_").map(Number)
    return new Date(year, month - 1, day)
}

const getWaitingTimeInDays = (slotDate) => {
    if (!slotDate) {
        return 0
    }

    const appointmentDate = parseSlotDate(slotDate)
    const today = new Date()

    today.setHours(0, 0, 0, 0)
    appointmentDate.setHours(0, 0, 0, 0)

    const millisecondsInDay = 1000 * 60 * 60 * 24
    return Math.max(0, Math.ceil((appointmentDate - today) / millisecondsInDay))
}

const normalizePregnancyDetails = (userData, pregnancy, riskLevel) => ({
    isPregnant: pregnancy ?? userData?.pregnancyDetails?.isPregnant ?? false,
    riskLevel: (riskLevel || userData?.pregnancyDetails?.riskLevel || 'low').toLowerCase()
})

const createPaymentAuthorization = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: PAYMENT_AUTHORIZATION_EXPIRY })

const verifyPaymentAuthorization = (paymentAuthorization, userId) => {
    const paymentData = jwt.verify(paymentAuthorization, process.env.JWT_SECRET)

    if (paymentData.userId !== userId) {
        throw new Error('Invalid payment authorization')
    }

    return paymentData
}

const buildBookingPreview = async ({
    userId,
    docId,
    slotDate,
    slotTime,
    urgency = 5,
    waitingTime,
    severity = 5,
    pregnancy,
    riskLevel,
    selectedTests = []
}) => {
    const doctorData = await doctorModel.findById(docId).select("-password")
    const userData = await userModel.findById(userId).select("-password")

    if (!doctorData) {
        throw new Error('Doctor not found')
    }

    if (!doctorData.available) {
        throw new Error('Doctor Not Available')
    }

    if (!userData) {
        throw new Error('User not found')
    }

    const pregnancyDetails = normalizePregnancyDetails(userData, pregnancy, riskLevel)
    const resolvedWaitingTime = waitingTime ?? getWaitingTimeInDays(slotDate)
    const priorityScore = calculatePriority(
        urgency,
        resolvedWaitingTime,
        severity,
        pregnancyDetails.isPregnant,
        pregnancyDetails.riskLevel
    )
    const highRiskPriority = isHighRiskPriority(
        pregnancyDetails.isPregnant,
        pregnancyDetails.riskLevel,
        Number(severity)
    )
    const costData = calculateBookingCosts(doctorData, selectedTests)
    const insuranceData = getInsuranceCoverage(userData.insurance, doctorData)
    const queueData = slotDate
        ? await getActiveQueueProjection(docId, slotDate, priorityScore)
        : { queuePosition: 1, waitTime: 0, estimatedWaitTime: 0, patientsAhead: 0 }
    const slotAvailable = slotDate && slotTime ? await isSlotAvailable(docId, slotDate, slotTime) : true

    doctorData.acceptedInsurance = insuranceData.acceptedInsurance
    delete doctorData.slots_booked

    return {
        doctorData,
        userData,
        pregnancyDetails,
        priorityScore,
        highRiskPriority,
        resolvedWaitingTime,
        insuranceData,
        queueData,
        slotAvailable,
        ...costData
    }
}

// API to register user
const registerUser = async (req, res) => {

    try {
        const { name, email, password } = req.body;

        // checking for all data to register user
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        // validating email format
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        // validating strong password
        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10); // the more no. round the more time it will take
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user
const loginUser = async (req, res) => {

    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user profile data
const getProfile = async (req, res) => {

    try {
        const { userId } = req.body
        const userData = await userModel.findById(userId).select('-password')

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {

    try {

        const { userId, name, phone, address, dob, gender, insurance, pregnancyDetails } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        await userModel.findByIdAndUpdate(userId, {
            name,
            phone,
            address: JSON.parse(address),
            dob,
            gender,
            insurance: insurance || 'Self Pay',
            pregnancyDetails: pregnancyDetails ? JSON.parse(pregnancyDetails) : { isPregnant: false, riskLevel: 'low' }
        })

        if (imageFile) {

            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
            const imageURL = imageUpload.secure_url

            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const bookingPreview = async (req, res) => {
    try {
        const previewData = await buildBookingPreview(req.body)

        res.json({
            success: true,
            availableTests: DEMO_TEST_CATALOG,
            consultationFee: previewData.consultationFee,
            selectedTests: previewData.selectedTests,
            testsCost: previewData.testsCost,
            totalCost: previewData.totalCost,
            advancePaymentAmount: previewData.advancePaymentAmount,
            costBreakdown: previewData.costBreakdown,
            insurance: previewData.insuranceData,
            queue: previewData.queueData,
            priorityScore: previewData.priorityScore,
            highRiskPriority: previewData.highRiskPriority,
            slotAvailable: previewData.slotAvailable
        })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const bookingPayment = async (req, res) => {
    try {
        const previewData = await buildBookingPreview(req.body)

        if (!previewData.slotAvailable) {
            return res.json({ success: false, message: 'Slot Not Available' })
        }

        const paymentAuthorization = createPaymentAuthorization({
            userId: req.body.userId,
            docId: req.body.docId,
            slotDate: req.body.slotDate,
            slotTime: req.body.slotTime,
            selectedTests: previewData.selectedTests.map((test) => test.id),
            amount: previewData.totalCost,
            consultationFee: previewData.consultationFee,
            costBreakdown: previewData.costBreakdown,
            advancePaymentAmount: previewData.advancePaymentAmount,
            priorityScore: previewData.priorityScore,
            highRiskPriority: previewData.highRiskPriority,
            pregnancyDetails: previewData.pregnancyDetails,
            paymentStatus: 'paid'
        })

        res.json({
            success: true,
            message: 'Advance payment completed',
            paymentStatus: 'paid',
            paymentAuthorization,
            advancePaymentAmount: previewData.advancePaymentAmount
        })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to book appointment 
const bookAppointment = async (req, res) => {

    try {

        const { userId, docId, slotDate, slotTime, paymentAuthorization } = req.body

        if (!paymentAuthorization) {
            return res.json({ success: false, message: 'Complete advance payment before booking' })
        }

        const paymentData = verifyPaymentAuthorization(paymentAuthorization, userId)

        if (paymentData.docId !== docId || paymentData.slotDate !== slotDate || paymentData.slotTime !== slotTime) {
            return res.json({ success: false, message: 'Booking details do not match paid slot' })
        }

        const docData = await doctorModel.findById(docId).select("-password")

        if (!docData || !docData.available) {
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        let slots_booked = docData.slots_booked

        // checking for slot availablity 
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot Not Available' })
            }
            else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await userModel.findById(userId).select("-password")
        docData.acceptedInsurance = getDoctorAcceptedInsurance(docData)

        delete docData.slots_booked

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: paymentData.amount,
            consultationFee: paymentData.consultationFee,
            selectedTests: calculateBookingCosts(docData, paymentData.selectedTests).selectedTests,
            costBreakdown: paymentData.costBreakdown,
            advancePaymentAmount: paymentData.advancePaymentAmount,
            slotTime,
            slotDate,
            priorityScore: paymentData.priorityScore,
            highRiskPriority: paymentData.highRiskPriority,
            paymentStatus: paymentData.paymentStatus,
            payment: paymentData.paymentStatus === 'paid',
            date: Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        // save new slots data in docData
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        const updatedQueue = await syncAppointmentQueue(docId, slotDate)
        const currentAppointmentQueue = updatedQueue.find((appointment) => appointment._id === String(newAppointment._id))

        res.json({
            success: true,
            message: 'Appointment Booked',
            priorityScore: paymentData.priorityScore,
            queuePosition: currentAppointmentQueue?.queuePosition || 0,
            waitTime: currentAppointmentQueue?.waitTime || 0,
            estimatedWaitTime: currentAppointmentQueue?.estimatedWaitTime || 0,
            patientsAhead: Math.max((currentAppointmentQueue?.queuePosition || 1) - 1, 0),
            paymentStatus: paymentData.paymentStatus,
            slotLocked: true,
            highRiskPriority: paymentData.highRiskPriority
        })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to cancel appointment
const cancelAppointment = async (req, res) => {
    try {

        const { userId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        // verify appointment user 
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        // releasing doctor slot 
        const { docId, slotDate, slotTime } = appointmentData

        const doctorData = await doctorModel.findById(docId)

        let slots_booked = doctorData.slots_booked

        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        await syncAppointmentQueue(docId, slotDate)

        res.json({ success: true, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments for frontend my-appointments page
const listAppointment = async (req, res) => {
    try {

        const { userId } = req.body
        const appointments = await appointmentModel.find({ userId }).sort(appointmentSort)

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        // creating options for razorpay payment
        const options = {
            amount: appointmentData.amount * 100,
            currency: process.env.CURRENCY,
            receipt: appointmentId,
        }

        // creation of an order
        const order = await razorpayInstance.orders.create(options)

        res.json({ success: true, order })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        if (orderInfo.status === 'paid') {
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment: true, paymentStatus: 'paid' })
            res.json({ success: true, message: "Payment Successful" })
        }
        else {
            res.json({ success: false, message: 'Payment Failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using Stripe
const paymentStripe = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const { origin } = req.headers

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        const currency = process.env.CURRENCY.toLocaleLowerCase()

        const line_items = [{
            price_data: {
                currency,
                product_data: {
                    name: "Appointment Fees"
                },
                unit_amount: appointmentData.amount * 100
            },
            quantity: 1
        }]

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/verify?success=true&appointmentId=${appointmentData._id}`,
            cancel_url: `${origin}/verify?success=false&appointmentId=${appointmentData._id}`,
            line_items: line_items,
            mode: 'payment',
        })

        res.json({ success: true, session_url: session.url });

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const verifyStripe = async (req, res) => {
    try {

        const { appointmentId, success } = req.body

        if (success === "true") {
            await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true, paymentStatus: 'paid' })
            return res.json({ success: true, message: 'Payment Successful' })
        }

        res.json({ success: false, message: 'Payment Failed' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

export {
    loginUser,
    registerUser,
    getProfile,
    updateProfile,
    bookingPreview,
    bookingPayment,
    bookAppointment,
    listAppointment,
    cancelAppointment,
    paymentRazorpay,
    verifyRazorpay,
    paymentStripe,
    verifyStripe
}
