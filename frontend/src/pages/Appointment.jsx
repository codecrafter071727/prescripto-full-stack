import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import axios from 'axios'
import { toast } from 'react-toastify'

const APPOINTMENT_TABS = ['Details', 'Cost & Payment', 'Insurance', 'Queue Info']
const DEMO_TESTS = [
    { id: 'blood-panel', label: 'Blood Panel', cost: 600 },
    { id: 'ultrasound', label: 'Ultrasound', cost: 1200 },
    { id: 'ecg', label: 'ECG', cost: 850 }
]

const Appointment = () => {
    const { docId } = useParams()
    const { doctors, currencySymbol, backendUrl, token, userData, getDoctosData, trackSpecialitySearch } = useContext(AppContext)
    const navigate = useNavigate()
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    const [docInfo, setDocInfo] = useState(false)
    const [docSlots, setDocSlots] = useState([])
    const [slotIndex, setSlotIndex] = useState(0)
    const [slotTime, setSlotTime] = useState('')
    const [activeTab, setActiveTab] = useState('Details')
    const [selectedTests, setSelectedTests] = useState([])
    const [urgency, setUrgency] = useState(5)
    const [severity, setSeverity] = useState(5)
    const [previewData, setPreviewData] = useState(false)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [paymentState, setPaymentState] = useState({ status: 'pending', authorization: '', advancePaymentAmount: 0 })
    const [paymentLoading, setPaymentLoading] = useState(false)
    const [bookingLoading, setBookingLoading] = useState(false)

    const selectedSlot = useMemo(
        () => docSlots[slotIndex]?.find((item) => item.time === slotTime) || docSlots[slotIndex]?.[0],
        [docSlots, slotIndex, slotTime]
    )

    const selectedSlotDate = useMemo(() => {
        if (!selectedSlot) {
            return ''
        }

        const day = selectedSlot.datetime.getDate()
        const month = selectedSlot.datetime.getMonth() + 1
        const year = selectedSlot.datetime.getFullYear()
        return `${day}_${month}_${year}`
    }, [selectedSlot])

    const fallbackCostBreakdown = useMemo(() => {
        const selectedTestItems = DEMO_TESTS.filter((test) => selectedTests.includes(test.id))
        const consultationFee = Number(docInfo?.fees || 0)
        const testsCost = selectedTestItems.reduce((totalCost, test) => totalCost + test.cost, 0)
        const totalCost = consultationFee + testsCost
        const advancePaymentAmount = Math.max(100, Math.round(totalCost * 0.2))

        return {
            consultationFee,
            selectedTests: selectedTestItems,
            testsCost,
            totalCost,
            advancePaymentAmount
        }
    }, [docInfo, selectedTests])

    const costDetails = {
        consultationFee: previewData?.consultationFee ?? fallbackCostBreakdown.consultationFee,
        selectedTests: previewData?.selectedTests ?? fallbackCostBreakdown.selectedTests,
        testsCost: previewData?.testsCost ?? fallbackCostBreakdown.testsCost,
        totalCost: previewData?.totalCost ?? fallbackCostBreakdown.totalCost,
        advancePaymentAmount: previewData?.advancePaymentAmount ?? fallbackCostBreakdown.advancePaymentAmount
    }

    const queueDetails = previewData?.queue || {
        queuePosition: 1,
        waitTime: 0,
        estimatedWaitTime: 0,
        patientsAhead: 0
    }

    const insuranceDetails = previewData?.insurance || {
        userInsurance: userData?.insurance || 'Self Pay',
        acceptedInsurance: docInfo?.acceptedInsurance || ['Self Pay'],
        isCovered: (docInfo?.acceptedInsurance || []).includes(userData?.insurance || 'Self Pay'),
        coverageLabel: (docInfo?.acceptedInsurance || []).includes(userData?.insurance || 'Self Pay') ? 'Covered' : 'Not Covered'
    }

    const highRiskPriority = previewData?.highRiskPriority || false
    const priorityScore = previewData?.priorityScore || 0
    const canConfirmBooking = paymentState.status === 'paid' && Boolean(selectedSlot) && previewData?.slotAvailable !== false

    const fetchDocInfo = useCallback(() => {
        const matchedDoctor = doctors.find((doctor) => doctor._id === docId)
        setDocInfo(matchedDoctor)
    }, [doctors, docId])

    const getAvailableSolts = useCallback(() => {
        setDocSlots([])

        const today = new Date()

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(today)
            currentDate.setDate(today.getDate() + i)

            const endTime = new Date()
            endTime.setDate(today.getDate() + i)
            endTime.setHours(21, 0, 0, 0)

            if (today.getDate() === currentDate.getDate()) {
                currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10)
                currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0)
            } else {
                currentDate.setHours(10)
                currentDate.setMinutes(0)
            }

            const timeSlots = []

            while (currentDate < endTime) {
                const formattedTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const day = currentDate.getDate()
                const month = currentDate.getMonth() + 1
                const year = currentDate.getFullYear()
                const slotDate = `${day}_${month}_${year}`
                const isSlotAvailable = !(docInfo.slots_booked?.[slotDate] && docInfo.slots_booked[slotDate].includes(formattedTime))

                if (isSlotAvailable) {
                    timeSlots.push({
                        datetime: new Date(currentDate),
                        time: formattedTime
                    })
                }

                currentDate.setMinutes(currentDate.getMinutes() + 30)
            }

            setDocSlots((previousSlots) => [...previousSlots, timeSlots])
        }
    }, [docInfo])

    const toggleTestSelection = (testId) => {
        setSelectedTests((previousTests) => previousTests.includes(testId)
            ? previousTests.filter((item) => item !== testId)
            : [...previousTests, testId]
        )
    }

    const fetchBookingPreview = useCallback(async () => {
        if (!token || !selectedSlotDate || !selectedSlot || !docInfo) {
            return
        }

        try {
            setPreviewLoading(true)
            const { data } = await axios.post(
                backendUrl + '/api/user/booking-preview',
                {
                    docId,
                    slotDate: selectedSlotDate,
                    slotTime: selectedSlot.time,
                    urgency,
                    severity,
                    pregnancy: userData?.pregnancyDetails?.isPregnant,
                    riskLevel: userData?.pregnancyDetails?.riskLevel,
                    selectedTests
                },
                { headers: { token } }
            )

            if (data.success) {
                setPreviewData(data)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        } finally {
            setPreviewLoading(false)
        }
    }, [backendUrl, docId, docInfo, selectedSlot, selectedSlotDate, selectedTests, severity, token, urgency, userData?.pregnancyDetails?.isPregnant, userData?.pregnancyDetails?.riskLevel])

    const handleAdvancePayment = async () => {
        if (!token) {
            toast.warning('Login to continue with payment')
            return navigate('/login')
        }

        if (!selectedSlotDate || !selectedSlot) {
            toast.error('Please select an available slot')
            return
        }

        try {
            setPaymentLoading(true)
            const { data } = await axios.post(
                backendUrl + '/api/user/booking-payment',
                {
                    docId,
                    slotDate: selectedSlotDate,
                    slotTime: selectedSlot.time,
                    urgency,
                    severity,
                    pregnancy: userData?.pregnancyDetails?.isPregnant,
                    riskLevel: userData?.pregnancyDetails?.riskLevel,
                    selectedTests
                },
                { headers: { token } }
            )

            if (data.success) {
                setPaymentState({
                    status: data.paymentStatus,
                    authorization: data.paymentAuthorization,
                    advancePaymentAmount: data.advancePaymentAmount
                })
                toast.success('Advance payment successful')
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        } finally {
            setPaymentLoading(false)
        }
    }

    const bookAppointment = async () => {
        if (!token) {
            toast.warning('Login to book appointment')
            return navigate('/login')
        }

        if (!selectedSlotDate || !selectedSlot) {
            toast.error('Please select an available slot')
            return
        }

        if (paymentState.status !== 'paid') {
            toast.error('Complete advance payment before confirming booking')
            return
        }

        try {
            setBookingLoading(true)
            const { data } = await axios.post(
                backendUrl + '/api/user/book-appointment',
                {
                    docId,
                    slotDate: selectedSlotDate,
                    slotTime: selectedSlot.time,
                    paymentAuthorization: paymentState.authorization
                },
                { headers: { token } }
            )

            if (data.success) {
                toast.success(`${data.message} | Queue #${data.queuePosition} | Est. wait ${data.waitTime} mins`)
                getDoctosData()
                navigate('/my-appointments')
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        } finally {
            setBookingLoading(false)
        }
    }

    useEffect(() => {
        if (doctors.length > 0) {
            fetchDocInfo()
        }
    }, [doctors.length, fetchDocInfo])

    useEffect(() => {
        if (docInfo) {
            getAvailableSolts()
            trackSpecialitySearch(docInfo.speciality)
        }
    }, [docInfo, getAvailableSolts, trackSpecialitySearch])

    useEffect(() => {
        if (!docSlots.length) {
            return
        }

        const availableSlotTime = docSlots[slotIndex]?.[0]?.time

        if (!availableSlotTime) {
            setSlotTime('')
            return
        }

        const hasSelectedSlot = docSlots[slotIndex]?.some((item) => item.time === slotTime)
        if (!hasSelectedSlot) {
            setSlotTime(availableSlotTime)
        }
    }, [docSlots, slotIndex, slotTime])

    useEffect(() => {
        setPaymentState({ status: 'pending', authorization: '', advancePaymentAmount: 0 })
    }, [docId, selectedSlotDate, slotTime, urgency, severity, selectedTests, userData?.pregnancyDetails?.isPregnant, userData?.pregnancyDetails?.riskLevel])

    useEffect(() => {
        fetchBookingPreview()
    }, [fetchBookingPreview])

    return docInfo ? (
        <div>
            <div className='flex flex-col sm:flex-row gap-4'>
                <div>
                    <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt="" />
                </div>

                <div className='flex-1 border border-[#ADADAD] rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>{docInfo.name} <img className='w-5' src={assets.verified_icon} alt="" /></p>
                        {paymentState.status === 'paid' && <span className='rounded-full bg-[#E8F5E9] px-3 py-1 text-xs text-[#15803D]'>Paid</span>}
                        {paymentState.status === 'paid' && <span className='rounded-full bg-[#E8F0FF] px-3 py-1 text-xs text-[#2563EB]'>Ready to Lock Slot</span>}
                        {highRiskPriority && <span className='rounded-full bg-[#FEE2E2] px-3 py-1 text-xs text-[#B91C1C]'>High Risk Priority</span>}
                    </div>

                    <div className='flex items-center gap-2 mt-1 text-gray-600'>
                        <p>{docInfo.degree} - {docInfo.speciality}</p>
                        <button className='py-0.5 px-2 border text-xs rounded-full'>{docInfo.experience}</button>
                    </div>

                    <p className='text-gray-600 font-medium mt-4'>Appointment fee: <span className='text-gray-800'>{currencySymbol}{docInfo.fees}</span></p>

                    <div className='mt-4 flex flex-wrap gap-2 text-xs'>
                        <span className={`rounded-full px-3 py-1 ${insuranceDetails.isCovered ? 'bg-[#E8F5E9] text-[#15803D]' : 'bg-[#FEF2F2] text-[#B91C1C]'}`}>{insuranceDetails.coverageLabel}</span>
                        {selectedSlot && <span className='rounded-full bg-[#F3F4F6] px-3 py-1 text-[#4B5563]'>{daysOfWeek[selectedSlot.datetime.getDay()]} {selectedSlot.datetime.getDate()} · {selectedSlot.time.toLowerCase()}</span>}
                    </div>
                </div>
            </div>

            <div className='sm:ml-72 sm:pl-4 mt-8 font-medium text-[#565656]'>
                <p>Booking slots</p>
                <div className='flex gap-3 items-center w-full overflow-x-scroll mt-4'>
                    {docSlots.length > 0 && docSlots.map((item, index) => (
                        <div onClick={() => setSlotIndex(index)} key={index} className={`text-center py-6 min-w-16 rounded-full cursor-pointer ${slotIndex === index ? 'bg-primary text-white' : 'border border-[#DDDDDD]'}`}>
                            <p>{item[0] && daysOfWeek[item[0].datetime.getDay()]}</p>
                            <p>{item[0] && item[0].datetime.getDate()}</p>
                        </div>
                    ))}
                </div>

                <div className='flex items-center gap-3 w-full overflow-x-scroll mt-4'>
                    {docSlots.length > 0 && docSlots[slotIndex]?.map((item, index) => (
                        <p onClick={() => setSlotTime(item.time)} key={index} className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full cursor-pointer ${item.time === slotTime ? 'bg-primary text-white' : 'text-[#949494] border border-[#B4B4B4]'}`}>{item.time.toLowerCase()}</p>
                    ))}
                </div>

                <div className='mt-6 flex flex-wrap gap-2 border-b pb-3'>
                    {APPOINTMENT_TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`rounded-full px-4 py-2 text-sm ${activeTab === tab ? 'bg-primary text-white' : 'border border-[#D1D5DB] text-[#4B5563]'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className='mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#4B5563]'>
                    {activeTab === 'Details' && (
                        <div className='space-y-4'>
                            <div>
                                <p className='text-base font-semibold text-[#262626]'>Appointment Details</p>
                                <p className='mt-2 text-[#5E5E5E]'>{docInfo.about}</p>
                            </div>
                            <div className='grid gap-4 md:grid-cols-3'>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Consultation</p>
                                    <p className='mt-2 text-lg font-semibold text-[#262626]'>{currencySymbol}{docInfo.fees}</p>
                                </div>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Selected slot</p>
                                    <p className='mt-2 text-lg font-semibold text-[#262626]'>{selectedSlot ? `${daysOfWeek[selectedSlot.datetime.getDay()]} ${selectedSlot.datetime.getDate()}` : 'Choose a slot'}</p>
                                    <p className='mt-1'>{selectedSlot?.time?.toLowerCase() || 'No slot selected'}</p>
                                </div>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Priority score</p>
                                    <p className='mt-2 text-lg font-semibold text-[#262626]'>{priorityScore}</p>
                                    <p className='mt-1'>{highRiskPriority ? 'Boosted for pregnancy risk' : 'Based on urgency and severity'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Cost & Payment' && (
                        <div className='space-y-5'>
                            <div className='grid gap-4 md:grid-cols-2'>
                                <div>
                                    <p className='text-base font-semibold text-[#262626]'>Optional Tests</p>
                                    <div className='mt-3 space-y-3'>
                                        {(previewData?.availableTests || DEMO_TESTS).map((test) => (
                                            <label key={test.id} className='flex items-center justify-between rounded-xl border border-[#E5E7EB] px-4 py-3'>
                                                <span>{test.label}</span>
                                                <span className='flex items-center gap-3'>
                                                    <span>{currencySymbol}{test.cost}</span>
                                                    <input
                                                        type='checkbox'
                                                        checked={selectedTests.includes(test.id)}
                                                        onChange={() => toggleTestSelection(test.id)}
                                                    />
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className='rounded-2xl border border-[#DDE6FF] bg-[#F8FBFF] p-5'>
                                    <p className='text-base font-semibold text-[#262626]'>Cost Breakdown</p>
                                    <div className='mt-4 space-y-3'>
                                        <div className='flex items-center justify-between'>
                                            <span>Consultation fee</span>
                                            <span>{currencySymbol}{costDetails.consultationFee}</span>
                                        </div>
                                        <div className='flex items-center justify-between'>
                                            <span>Optional tests</span>
                                            <span>{currencySymbol}{costDetails.testsCost}</span>
                                        </div>
                                        <div className='flex items-center justify-between border-t pt-3 font-semibold text-[#262626]'>
                                            <span>Estimated total</span>
                                            <span>{currencySymbol}{costDetails.totalCost}</span>
                                        </div>
                                        <div className='flex items-center justify-between text-[#2563EB]'>
                                            <span>Advance payment</span>
                                            <span>{currencySymbol}{costDetails.advancePaymentAmount}</span>
                                        </div>
                                    </div>

                                    <div className='mt-5 flex flex-wrap gap-3'>
                                        <button onClick={handleAdvancePayment} disabled={paymentLoading || !selectedSlot || previewData?.slotAvailable === false} className='rounded-full bg-primary px-6 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50'>
                                            {paymentLoading ? 'Processing...' : paymentState.status === 'paid' ? 'Advance Paid' : 'Pay Advance'}
                                        </button>
                                        <button onClick={bookAppointment} disabled={!canConfirmBooking || bookingLoading} className='rounded-full border border-primary px-6 py-3 text-primary disabled:cursor-not-allowed disabled:opacity-50'>
                                            {bookingLoading ? 'Confirming...' : 'Confirm Booking & Lock Slot'}
                                        </button>
                                    </div>

                                    <div className='mt-4 flex flex-wrap gap-2 text-xs'>
                                        {paymentState.status === 'paid' && <span className='rounded-full bg-[#E8F5E9] px-3 py-1 text-[#15803D]'>Paid</span>}
                                        {paymentState.status === 'paid' && <span className='rounded-full bg-[#FFF7ED] px-3 py-1 text-[#C2410C]'>Booking button unlocked</span>}
                                        {previewData?.slotAvailable === false && <span className='rounded-full bg-[#FEF2F2] px-3 py-1 text-[#B91C1C]'>Slot no longer available</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Insurance' && (
                        <div className='space-y-4'>
                            <p className='text-base font-semibold text-[#262626]'>Insurance Coverage</p>
                            <div className='grid gap-4 md:grid-cols-2'>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Your insurance</p>
                                    <p className='mt-2 text-lg font-semibold text-[#262626]'>{insuranceDetails.userInsurance}</p>
                                </div>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Coverage status</p>
                                    <p className={`mt-2 text-lg font-semibold ${insuranceDetails.isCovered ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>{insuranceDetails.coverageLabel}</p>
                                </div>
                            </div>
                            <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                <p className='text-xs text-[#6B7280]'>Accepted by doctor</p>
                                <div className='mt-3 flex flex-wrap gap-2'>
                                    {insuranceDetails.acceptedInsurance.map((insuranceItem) => (
                                        <span key={insuranceItem} className='rounded-full bg-[#F3F4F6] px-3 py-1 text-[#4B5563]'>{insuranceItem}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Queue Info' && (
                        <div className='space-y-5'>
                            <div className='grid gap-4 md:grid-cols-2'>
                                <label className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Urgency</p>
                                    <input type='range' min='0' max='10' value={urgency} onChange={(event) => setUrgency(Number(event.target.value))} className='mt-3 w-full' />
                                    <p className='mt-2 text-lg font-semibold text-[#262626]'>{urgency}/10</p>
                                </label>
                                <label className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Severity</p>
                                    <input type='range' min='0' max='10' value={severity} onChange={(event) => setSeverity(Number(event.target.value))} className='mt-3 w-full' />
                                    <p className='mt-2 text-lg font-semibold text-[#262626]'>{severity}/10</p>
                                </label>
                            </div>

                            <div className='grid gap-4 md:grid-cols-4'>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Queue position</p>
                                    <p className='mt-2 text-2xl font-semibold text-[#262626]'>{queueDetails.queuePosition}</p>
                                </div>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Patients ahead</p>
                                    <p className='mt-2 text-2xl font-semibold text-[#262626]'>{queueDetails.patientsAhead}</p>
                                </div>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Estimated wait</p>
                                    <p className='mt-2 text-2xl font-semibold text-[#262626]'>{queueDetails.waitTime || queueDetails.estimatedWaitTime} min</p>
                                </div>
                                <div className='rounded-xl border border-[#E5E7EB] p-4'>
                                    <p className='text-xs text-[#6B7280]'>Priority</p>
                                    <p className='mt-2 text-2xl font-semibold text-[#262626]'>{priorityScore}</p>
                                </div>
                            </div>

                            <div className='rounded-xl border border-[#DDE6FF] bg-[#F8FBFF] p-4'>
                                <p className='font-semibold text-[#262626]'>Pregnancy-aware emergency handling</p>
                                <p className='mt-2'>Pregnancy status: {userData?.pregnancyDetails?.isPregnant ? 'Pregnant' : 'Not Pregnant'}</p>
                                <p className='mt-1'>Risk level: {(userData?.pregnancyDetails?.riskLevel || 'low').toUpperCase()}</p>
                                {highRiskPriority && <p className='mt-2 text-[#B91C1C]'>High risk pregnancy has boosted this appointment in the queue.</p>}
                                {!token && <p className='mt-2 text-[#6B7280]'>Login to fetch live queue, insurance, and payment validation.</p>}
                                {previewLoading && <p className='mt-2 text-[#2563EB]'>Refreshing queue preview...</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <RelatedDoctors speciality={docInfo.speciality} docId={docId} />
        </div>
    ) : null
}

export default Appointment
