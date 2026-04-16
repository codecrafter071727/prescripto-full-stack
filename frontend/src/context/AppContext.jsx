import { createContext, useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from 'axios'

export const AppContext = createContext()

const RECENT_SPECIALITIES_KEY = 'recentSpecialities'

const getStoredRecentSpecialities = () => {
    try {
        const storedSpecialities = localStorage.getItem(RECENT_SPECIALITIES_KEY)
        return storedSpecialities ? JSON.parse(storedSpecialities) : []
    } catch (error) {
        return []
    }
}

const AppContextProvider = (props) => {

    const currencySymbol = '₹'
    const backendUrl = import.meta.env.VITE_BACKEND_URL

    const [doctors, setDoctors] = useState([])
    const [token, setToken] = useState(localStorage.getItem('token') ? localStorage.getItem('token') : '')
    const [userData, setUserData] = useState(false)
    const [recentSpecialities, setRecentSpecialities] = useState(getStoredRecentSpecialities)

    // Getting Doctors using API
    const getDoctosData = async () => {

        try {

            const { data } = await axios.get(backendUrl + '/api/doctor/list')
            if (data.success) {
                setDoctors(data.doctors)
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }

    }

    // Getting User Profile using API
    const loadUserProfileData = async () => {

        try {

            const { data } = await axios.get(backendUrl + '/api/user/get-profile', { headers: { token } })

            if (data.success) {
                setUserData(data.userData)
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }

    }

    useEffect(() => {
        getDoctosData()
    }, [])

    useEffect(() => {
        if (token) {
            loadUserProfileData()
        }
    }, [token])

    const trackSpecialitySearch = useCallback((speciality) => {
        if (!speciality) {
            return
        }

        setRecentSpecialities((previousSpecialities) => {
            const updatedSpecialities = [
                speciality,
                ...previousSpecialities.filter((item) => item !== speciality)
            ].slice(0, 5)

            localStorage.setItem(RECENT_SPECIALITIES_KEY, JSON.stringify(updatedSpecialities))
            return updatedSpecialities
        })
    }, [])

    const value = {
        doctors, getDoctosData,
        currencySymbol,
        backendUrl,
        token, setToken,
        userData, setUserData, loadUserProfileData,
        recentSpecialities, trackSpecialitySearch
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )

}

export default AppContextProvider
