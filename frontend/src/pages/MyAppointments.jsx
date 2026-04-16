import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'

const MyAppointments = () => {

    const { backendUrl, token } = useContext(AppContext)
    const navigate = useNavigate()

    const [appointments, setAppointments] = useState([])
    const [payment, setPayment] = useState('')

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const parseAppointmentDateTime = (slotDate, slotTime) => {
        const [day, month, year] = slotDate.split('_').map(Number)
        const [time, meridiem] = slotTime.split(' ')
        let [hours, minutes] = time.split(':').map(Number)

        if (meridiem?.toLowerCase() === 'pm' && hours !== 12) {
            hours += 12
        }

        if (meridiem?.toLowerCase() === 'am' && hours === 12) {
            hours = 0
        }

        return new Date(year, month - 1, day, hours, minutes)
    }

    const isSameDay = (firstDate, secondDate) => (
        firstDate.getDate() === secondDate.getDate()
        && firstDate.getMonth() === secondDate.getMonth()
        && firstDate.getFullYear() === secondDate.getFullYear()
    )

    // Function to format the date eg. ( 20_01_2000 => 20 Jan 2000 )
    const slotDateFormat = (slotDate) => {
        const dateArray = slotDate.split('_')
        return dateArray[0] + " " + months[Number(dateArray[1])] + " " + dateArray[2]
    }

    const appointmentItems = useMemo(() => {
        const now = new Date()

        return appointments.map((appointment) => {
            const appointmentDateTime = parseAppointmentDateTime(appointment.slotDate, appointment.slotTime)
            const isUpcomingAppointment = !appointment.cancelled && !appointment.isCompleted && appointmentDateTime >= now
            const isTodayAppointment = isUpcomingAppointment && isSameDay(appointmentDateTime, now)
            const patientsAhead = Math.max((appointment.queuePosition || 1) - 1, 0)

            return {
                ...appointment,
                appointmentDateTime,
                isUpcomingAppointment,
                isTodayAppointment,
                patientsAhead
            }
        })
    }, [appointments])

    const todayAppointments = useMemo(
        () => appointmentItems
            .filter((appointment) => appointment.isTodayAppointment)
            .sort((firstAppointment, secondAppointment) => firstAppointment.appointmentDateTime - secondAppointment.appointmentDateTime),
        [appointmentItems]
    )

    const upcomingAppointments = useMemo(
        () => appointmentItems
            .filter((appointment) => appointment.isUpcomingAppointment)
            .sort((firstAppointment, secondAppointment) => firstAppointment.appointmentDateTime - secondAppointment.appointmentDateTime),
        [appointmentItems]
    )

    // Getting User Appointments Data Using API
    const getUserAppointments = useCallback(async () => {
        try {

            const { data } = await axios.get(backendUrl + '/api/user/appointments', { headers: { token } })
            setAppointments(data.appointments)

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }, [backendUrl, token])

    // Function to cancel appointment Using API
    const cancelAppointment = async (appointmentId) => {

        try {

            const { data } = await axios.post(backendUrl + '/api/user/cancel-appointment', { appointmentId }, { headers: { token } })

            if (data.success) {
                toast.success(data.message)
                getUserAppointments()
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }

    }

    const initPay = (order) => {
        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: order.currency,
            name: 'Appointment Payment',
            description: "Appointment Payment",
            order_id: order.id,
            receipt: order.receipt,
            handler: async (response) => {

                console.log(response)

                try {
                    const { data } = await axios.post(backendUrl + "/api/user/verifyRazorpay", response, { headers: { token } });
                    if (data.success) {
                        navigate('/my-appointments')
                        getUserAppointments()
                    }
                } catch (error) {
                    console.log(error)
                    toast.error(error.message)
                }
            }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
    };

    // Function to make payment using razorpay
    const appointmentRazorpay = async (appointmentId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/user/payment-razorpay', { appointmentId }, { headers: { token } })
            if (data.success) {
                initPay(data.order)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }

    // Function to make payment using stripe
    const appointmentStripe = async (appointmentId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/user/payment-stripe', { appointmentId }, { headers: { token } })
            if (data.success) {
                const { session_url } = data
                window.location.replace(session_url)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }



    useEffect(() => {
        if (token) {
            getUserAppointments()
        }
    }, [token, getUserAppointments])

    return (
        <div>
            <p className='pb-3 mt-12 text-lg font-medium text-gray-600 border-b'>My appointments</p>

            {todayAppointments.length > 0 && (
                <div className='mt-8 rounded-xl border border-[#D7E6FF] bg-[#F8FBFF] p-5'>
                    <div className='flex items-center justify-between gap-4'>
                        <div>
                            <p className='text-lg font-semibold text-[#262626]'>Today&apos;s Appointments</p>
                            <p className='text-sm text-[#5E5E5E]'>Keep track of your current queue and upcoming visit times.</p>
                        </div>
                        <span className='rounded-full bg-primary px-4 py-1 text-sm text-white'>{todayAppointments.length} today</span>
                    </div>

                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        {todayAppointments.map((item) => (
                            <div key={item._id} className='rounded-lg border border-[#DDE8FF] bg-white p-4'>
                                <p className='font-semibold text-[#262626]'>{item.docData.name}</p>
                                <p className='mt-1 text-sm text-[#5E5E5E]'>{item.slotTime} · {item.docData.speciality}</p>
                                <div className='mt-3 flex flex-wrap gap-2 text-xs'>
                                    <span className='rounded-full bg-[#E8F0FF] px-3 py-1 text-[#2563EB]'>Queue #{item.queuePosition || 0}</span>
                                    <span className='rounded-full bg-[#EFFBF4] px-3 py-1 text-[#15803D]'>Est. wait {item.waitTime || item.estimatedWaitTime || 0} mins</span>
                                    <span className='rounded-full bg-[#F3F4F6] px-3 py-1 text-[#4B5563]'>{item.patientsAhead} ahead</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {upcomingAppointments.length > 0 && (
                <div className='mt-6 grid gap-4 md:grid-cols-3'>
                    <div className='rounded-xl border border-[#E5E7EB] bg-white p-5'>
                        <p className='text-sm text-[#6B7280]'>Upcoming reminders</p>
                        <p className='mt-2 text-2xl font-semibold text-[#262626]'>{upcomingAppointments.length}</p>
                    </div>
                    <div className='rounded-xl border border-[#E5E7EB] bg-white p-5 md:col-span-2'>
                        <p className='text-sm text-[#6B7280]'>Next appointment</p>
                        <p className='mt-2 text-lg font-semibold text-[#262626]'>{upcomingAppointments[0].docData.name}</p>
                        <p className='mt-1 text-sm text-[#5E5E5E]'>{slotDateFormat(upcomingAppointments[0].slotDate)} | {upcomingAppointments[0].slotTime}</p>
                    </div>
                </div>
            )}

            <div className='mt-6'>
                {appointmentItems.map((item, index) => (
                    <div key={index} className={`grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-4 border-b ${item.isUpcomingAppointment ? 'bg-[#FCFDFF]' : ''}`}>
                        <div>
                            <img className='w-36 bg-[#EAEFFF]' src={item.docData.image} alt="" />
                        </div>
                        <div className='flex-1 text-sm text-[#5E5E5E]'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <p className='text-[#262626] text-base font-semibold'>{item.docData.name}</p>
                                {item.isTodayAppointment && <span className='rounded-full bg-[#E8F0FF] px-3 py-1 text-xs text-[#2563EB]'>Today</span>}
                                {!item.isTodayAppointment && item.isUpcomingAppointment && <span className='rounded-full bg-[#FEF3C7] px-3 py-1 text-xs text-[#B45309]'>Upcoming</span>}
                                {item.paymentStatus === 'paid' && <span className='rounded-full bg-[#E8F5E9] px-3 py-1 text-xs text-[#15803D]'>Paid</span>}
                                {item.paymentStatus === 'paid' && !item.cancelled && !item.isCompleted && <span className='rounded-full bg-[#E8F0FF] px-3 py-1 text-xs text-[#2563EB]'>Slot Locked</span>}
                                {item.highRiskPriority && <span className='rounded-full bg-[#FEE2E2] px-3 py-1 text-xs text-[#B91C1C]'>High Risk Priority</span>}
                            </div>
                            <p>{item.docData.speciality}</p>
                            <p className='text-[#464646] font-medium mt-1'>Address:</p>
                            <p className=''>{item.docData.address.line1}</p>
                            <p className=''>{item.docData.address.line2}</p>
                            <p className=' mt-1'><span className='text-sm text-[#3C3C3C] font-medium'>Date & Time:</span> {slotDateFormat(item.slotDate)} |  {item.slotTime}</p>
                            {!item.cancelled && !item.isCompleted && (
                                <div className='mt-3 flex flex-wrap gap-2 text-xs'>
                                    <span className='rounded-full bg-[#E8F0FF] px-3 py-1 text-[#2563EB]'>Queue #{item.queuePosition || 0}</span>
                                    <span className='rounded-full bg-[#EFFBF4] px-3 py-1 text-[#15803D]'>Est. wait {item.waitTime || item.estimatedWaitTime || 0} mins</span>
                                    <span className='rounded-full bg-[#F3F4F6] px-3 py-1 text-[#4B5563]'>{item.patientsAhead} ahead</span>
                                    <span className='rounded-full bg-[#F3F4F6] px-3 py-1 text-[#4B5563]'>Priority {item.priorityScore || 0}</span>
                                </div>
                            )}
                        </div>
                        <div></div>
                        <div className='flex flex-col gap-2 justify-end text-sm text-center'>
                            {!item.cancelled && !item.payment && !item.isCompleted && payment !== item._id && <button onClick={() => setPayment(item._id)} className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'>Pay Online</button>}
                            {!item.cancelled && !item.payment && !item.isCompleted && payment === item._id && <button onClick={() => appointmentStripe(item._id)} className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-gray-100 hover:text-white transition-all duration-300 flex items-center justify-center'><img className='max-w-20 max-h-5' src={assets.stripe_logo} alt="" /></button>}
                            {!item.cancelled && !item.payment && !item.isCompleted && payment === item._id && <button onClick={() => appointmentRazorpay(item._id)} className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-gray-100 hover:text-white transition-all duration-300 flex items-center justify-center'><img className='max-w-20 max-h-5' src={assets.razorpay_logo} alt="" /></button>}
                            {!item.cancelled && item.payment && !item.isCompleted && <button className='sm:min-w-48 py-2 border rounded text-[#696969]  bg-[#EAEFFF]'>Paid</button>}

                            {item.isCompleted && <button className='sm:min-w-48 py-2 border border-green-500 rounded text-green-500'>Completed</button>}

                            {!item.cancelled && !item.isCompleted && <button onClick={() => cancelAppointment(item._id)} className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300'>Cancel appointment</button>}
                            {item.cancelled && !item.isCompleted && <button className='sm:min-w-48 py-2 border border-red-500 rounded text-red-500'>Appointment cancelled</button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default MyAppointments
