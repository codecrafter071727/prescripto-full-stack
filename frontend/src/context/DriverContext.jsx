import { createContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const DriverContext = createContext();

const DriverContextProvider = (props) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [driverToken, setDriverToken] = useState(
        localStorage.getItem("driverToken") || ""
    );
    const [driverData, setDriverData] = useState(null);
    const [driverLoading, setDriverLoading] = useState(false);

    const loadDriverProfile = useCallback(async () => {
        if (!driverToken) return;
        try {
            setDriverLoading(true);
            const { data } = await axios.get(backendUrl + "/api/ambulance/profile", {
                headers: { drivertoken: driverToken },
            });
            if (data.success) {
                setDriverData(data.driverData);
            } else {
                toast.error(data.message);
                // token might be invalid
                logoutDriver();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setDriverLoading(false);
        }
    }, [driverToken, backendUrl]);

    const loginDriver = async (email, password) => {
        try {
            const { data } = await axios.post(backendUrl + "/api/ambulance/login", {
                email,
                password,
            });
            if (data.success) {
                localStorage.setItem("driverToken", data.token);
                setDriverToken(data.token);
                setDriverData(data.driverData);
                toast.success("Logged in successfully!");
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (error) {
            toast.error("Login failed. Please try again.");
            console.error(error);
            return false;
        }
    };

    const logoutDriver = () => {
        localStorage.removeItem("driverToken");
        setDriverToken("");
        setDriverData(null);
    };

    useEffect(() => {
        if (driverToken && !driverData) {
            loadDriverProfile();
        }
    }, [driverToken]);

    const value = {
        driverToken,
        setDriverToken,
        driverData,
        setDriverData,
        driverLoading,
        loginDriver,
        logoutDriver,
        loadDriverProfile,
        backendUrl,
    };

    return (
        <DriverContext.Provider value={value}>
            {props.children}
        </DriverContext.Provider>
    );
};

export default DriverContextProvider;
