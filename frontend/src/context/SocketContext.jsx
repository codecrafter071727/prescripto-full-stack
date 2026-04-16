import { createContext, useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";

export const SocketContext = createContext();

const SocketContextProvider = (props) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const socket = useMemo(() => io(backendUrl), [backendUrl]);

    const [isConnected, setIsConnected] = useState(socket.connected);
    const [incomingRequest, setIncomingRequest] = useState(null);
    const [activeRide, setActiveRide] = useState(null);

    useEffect(() => {
        socket.on("connect", () => {
            setIsConnected(true);
            console.log("Connected to socket server:", socket.id);

            // If this is a driver, re-register after reconnect
            const driverToken = localStorage.getItem("driverToken");
            const driverId = localStorage.getItem("driverMongoId");
            if (driverToken && driverId) {
                socket.emit("driver_register", { driverId });
            }
        });

        socket.on("disconnect", () => {
            setIsConnected(false);
            console.log("Disconnected from socket server");
        });

        socket.on("incoming_emergency", (data) => {
            setIncomingRequest(data);
        });

        // If another driver takes the request, dismiss it
        socket.on("emergency_taken", ({ requestId }) => {
            setIncomingRequest((prev) => {
                if (prev && prev.requestId === requestId) return null;
                return prev;
            });
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("incoming_emergency");
            socket.off("emergency_taken");
        };
    }, [socket]);

    // Register driver socket room after driver logs in
    const registerDriverSocket = (driverId) => {
        if (socket && isConnected && driverId) {
            localStorage.setItem("driverMongoId", driverId);
            socket.emit("driver_register", { driverId });
        }
    };

    const value = {
        socket,
        isConnected,
        incomingRequest,
        setIncomingRequest,
        activeRide,
        setActiveRide,
        registerDriverSocket,
    };

    return (
        <SocketContext.Provider value={value}>
            {props.children}
        </SocketContext.Provider>
    );
};

export default SocketContextProvider;
