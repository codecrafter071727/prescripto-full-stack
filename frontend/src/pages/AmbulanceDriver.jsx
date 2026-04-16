import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { DriverContext } from '../context/DriverContext';
import { toast } from 'react-toastify';

const AmbulanceDriver = () => {
    const { socket, isConnected, incomingRequest, setIncomingRequest, registerDriverSocket } = useContext(SocketContext);
    const { driverToken, driverData, logoutDriver } = useContext(DriverContext);
    const navigate = useNavigate();

    const [activeRide, setActiveRide] = useState(null);
    const [watchId, setWatchId] = useState(null);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [rideTimer, setRideTimer] = useState(0);

    // Redirect if not logged in
    useEffect(() => {
        if (!driverToken) {
            navigate('/driver-login');
        }
    }, [driverToken]);

    // Register driver socket on mount
    useEffect(() => {
        if (driverData && driverData._id && isConnected) {
            registerDriverSocket(driverData._id);
        }
    }, [driverData, isConnected]);

    // Ride timer
    useEffect(() => {
        let interval;
        if (activeRide) {
            interval = setInterval(() => setRideTimer(p => p + 1), 1000);
        } else {
            setRideTimer(0);
        }
        return () => clearInterval(interval);
    }, [activeRide]);

    // Fetch pending requests on connect
    useEffect(() => {
        if (socket && isConnected) {
            socket.emit("get_pending_emergencies");
        }
    }, [socket, isConnected]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAcceptRequest = () => {
        if (!incomingRequest || !driverData) return;

        const driverDetails = {
            driverId: driverData._id,
            name: driverData.driverName,
            phone: driverData.phone,
            vehicleNumber: driverData.vehicleNumber,
        };

        socket.emit('driver_accept_request', {
            requestId: incomingRequest.requestId,
            driverId: driverData._id,
            driverDetails,
        });

        setActiveRide(incomingRequest);
        setIncomingRequest(null);
        toast.dismiss();
        toast.success("✅ Ride accepted. Navigate to patient!");

        // Start location tracking
        if (navigator.geolocation) {
            const id = navigator.geolocation.watchPosition(
                (position) => {
                    const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
                    setCurrentLocation(loc);
                    socket.emit('driver_location_update', {
                        requestId: incomingRequest.requestId,
                        location: loc,
                    });
                },
                () => {
                    toast.warning("Location denied. Using simulated movement.");
                    let lat = 28.6139;
                    let lng = 77.2090;
                    const fallbackId = setInterval(() => {
                        lat += 0.0008;
                        lng += 0.0008;
                        const loc = { lat, lng };
                        setCurrentLocation(loc);
                        socket.emit('driver_location_update', {
                            requestId: incomingRequest.requestId,
                            location: loc,
                        });
                    }, 2000);
                    setWatchId(fallbackId);
                },
                { enableHighAccuracy: true, maximumAge: 0 }
            );
            setWatchId(id);
        }
    };

    const handleDecline = () => {
        if (incomingRequest) {
            socket.emit('driver_reject_request', { requestId: incomingRequest.requestId });
        }
        setIncomingRequest(null);
        toast.info("Request declined.");
    };

    const handleCompleteRide = () => {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            clearInterval(watchId);
            setWatchId(null);
        }
        if (activeRide) {
            socket.emit('ride_completed', { requestId: activeRide.requestId });
        }
        setActiveRide(null);
        setCurrentLocation(null);
        toast.success("🏥 Ride completed. Patient delivered safely.");
    };

    const handleLogout = () => {
        if (activeRide) {
            toast.error("Cannot logout during an active ride.");
            return;
        }
        logoutDriver();
        localStorage.removeItem('driverMongoId');
        navigate('/driver-login');
    };

    if (!driverToken || !driverData) {
        return (
            <div style={s.loadingScreen}>
                <div style={s.loadingSpinner}></div>
                <p style={{ color: '#888', marginTop: '16px' }}>Loading dashboard...</p>
                <style>{`@keyframes ddSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={s.page}>
            {/* ── Header ─────────────────────────────────────── */}
            <div style={s.header}>
                <div style={s.headerLeft}>
                    <div style={s.headerIcon}>🚑</div>
                    <div>
                        <h2 style={s.headerTitle}>Driver Dashboard</h2>
                        <div style={s.headerStatus}>
                            <span style={{
                                ...s.statusDot,
                                background: isConnected ? '#22c55e' : '#ef4444',
                            }}></span>
                            <span>{isConnected ? 'Connected & Listening' : 'Disconnected'}</span>
                        </div>
                    </div>
                </div>

                <div style={s.headerRight}>
                    <div style={s.driverBadge}>
                        <span style={{ fontSize: '18px' }}>👨‍⚕️</span>
                        <div>
                            <p style={s.badgeName}>{driverData.driverName}</p>
                            <p style={s.badgeVehicle}>{driverData.vehicleNumber}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} style={s.logoutBtn} id="driver-logout-btn">
                        Logout
                    </button>
                </div>
            </div>

            {/* ── Body ────────────────────────────────────────── */}
            <div style={s.body}>
                {/* Standby */}
                {!incomingRequest && !activeRide && (
                    <div style={s.standbyCard}>
                        <div style={s.standbyPulseWrapper}>
                            <div style={s.standbyPulse}></div>
                            <div style={s.standbyIconCircle}>🎧</div>
                        </div>
                        <h3 style={s.standbyTitle}>Standing By</h3>
                        <p style={s.standbyText}>
                            Listening for nearby emergencies. When a patient needs help, it will appear here instantly.
                        </p>
                        <div style={s.standbyMeta}>
                            <div style={s.metaItem}>
                                <span style={s.metaLabel}>Status</span>
                                <span style={{ ...s.metaValue, color: '#22c55e' }}>Online</span>
                            </div>
                            <div style={s.metaDivider}></div>
                            <div style={s.metaItem}>
                                <span style={s.metaLabel}>Vehicle</span>
                                <span style={s.metaValue}>{driverData.vehicleNumber}</span>
                            </div>
                            <div style={s.metaDivider}></div>
                            <div style={s.metaItem}>
                                <span style={s.metaLabel}>Phone</span>
                                <span style={s.metaValue}>{driverData.phone}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Incoming Request */}
                {incomingRequest && !activeRide && (
                    <div style={s.alertCard}>
                        <div style={s.alertHeader}>
                            <span style={s.alertEmoji}>🚨</span>
                            <div>
                                <h3 style={s.alertTitle}>INCOMING EMERGENCY</h3>
                                <p style={s.alertSubtext}>A patient needs immediate help</p>
                            </div>
                        </div>

                        <div style={s.alertBody}>
                            <div style={s.alertInfoRow}>
                                <div style={s.alertInfoItem}>
                                    <span style={s.alertInfoLabel}>Patient</span>
                                    <span style={s.alertInfoValue}>{incomingRequest.userName}</span>
                                </div>
                                <div style={s.alertInfoItem}>
                                    <span style={s.alertInfoLabel}>Priority</span>
                                    <span style={{ ...s.alertInfoValue, color: '#dc2626' }}>URGENT</span>
                                </div>
                            </div>
                            {incomingRequest.pickupLocation && (
                                <div style={s.alertInfoRow}>
                                    <div style={s.alertInfoItem}>
                                        <span style={s.alertInfoLabel}>Pickup</span>
                                        <span style={s.alertInfoValue}>
                                            {incomingRequest.pickupLocation.lat?.toFixed(4)}, {incomingRequest.pickupLocation.lng?.toFixed(4)}
                                        </span>
                                    </div>
                                    <div style={s.alertInfoItem}>
                                        <span style={s.alertInfoLabel}>Distance</span>
                                        <span style={s.alertInfoValue}>~1.2 km</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={s.alertActions}>
                            <button onClick={handleAcceptRequest} style={s.acceptBtn} id="accept-request-btn">
                                ✅ ACCEPT DISPATCH
                            </button>
                            <button onClick={handleDecline} style={s.declineBtn} id="decline-request-btn">
                                Decline
                            </button>
                        </div>
                    </div>
                )}

                {/* Active Ride */}
                {activeRide && (
                    <div style={s.rideCard}>
                        <div style={s.rideHeader}>
                            <div style={s.rideHeaderLeft}>
                                <span style={{ fontSize: '24px' }}>🚑</span>
                                <div>
                                    <h3 style={s.rideTitle}>ACTIVE RUN</h3>
                                    <p style={s.rideSubtext}>En route to patient</p>
                                </div>
                            </div>
                            <div style={s.rideTimerBox}>
                                <span style={s.rideTimerLabel}>Duration</span>
                                <span style={s.rideTimerValue}>{formatTime(rideTimer)}</span>
                            </div>
                        </div>

                        <div style={s.rideBody}>
                            <div style={s.ridePatient}>
                                <div style={s.patientAvatar}>🧑</div>
                                <div>
                                    <p style={s.patientName}>{activeRide.userName}</p>
                                    <p style={s.patientLabel}>Patient</p>
                                </div>
                            </div>

                            <div style={s.locationShare}>
                                <span style={s.shareIcon}>📡</span>
                                <div>
                                    <p style={s.shareTitle}>Live Location Sharing</p>
                                    <p style={s.shareSubtext}>
                                        {currentLocation
                                            ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
                                            : 'Acquiring GPS...'}
                                    </p>
                                </div>
                            </div>

                            <button onClick={handleCompleteRide} style={s.completeBtn} id="complete-ride-btn">
                                🏥 End Ride — Patient Delivered
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes ddSpin { to { transform: rotate(360deg); } }
                @keyframes ddPulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2); opacity: 0; } }
                @keyframes ddBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                @keyframes ddBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            `}</style>
        </div>
    );
};

/* ── Styles ───────────────────────────────────────────────────── */
const s = {
    page: {
        maxWidth: '680px',
        margin: '0 auto',
        padding: '10px 0 40px',
    },

    /* Loading */
    loadingScreen: {
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingSpinner: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '4px solid #f3f4f6',
        borderTopColor: '#dc2626',
        animation: 'ddSpin 0.8s linear infinite',
    },

    /* Header */
    header: {
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        borderRadius: '20px',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        boxShadow: '0 8px 30px rgba(30,27,75,0.3)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
    },
    headerIcon: {
        fontSize: '32px',
    },
    headerTitle: {
        margin: 0,
        color: '#fff',
        fontSize: '20px',
        fontWeight: '800',
        letterSpacing: '0.5px',
    },
    headerStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '12px',
        marginTop: '4px',
    },
    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        animation: 'ddBlink 1.5s infinite',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    driverBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '8px 14px',
    },
    badgeName: {
        margin: 0,
        color: '#fff',
        fontSize: '13px',
        fontWeight: '700',
    },
    badgeVehicle: {
        margin: 0,
        color: 'rgba(255,255,255,0.6)',
        fontSize: '11px',
    },
    logoutBtn: {
        padding: '8px 16px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'transparent',
        color: '#fff',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },

    /* Body */
    body: {
        minHeight: '400px',
    },

    /* Standby */
    standbyCard: {
        background: '#fff',
        borderRadius: '20px',
        padding: '50px 32px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        border: '1px solid #f0f0f0',
    },
    standbyPulseWrapper: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
    },
    standbyPulse: {
        position: 'absolute',
        width: '70px',
        height: '70px',
        borderRadius: '50%',
        border: '3px solid rgba(99,102,241,0.3)',
        animation: 'ddPulse 2s ease-out infinite',
    },
    standbyIconCircle: {
        width: '70px',
        height: '70px',
        borderRadius: '50%',
        background: '#f5f3ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '30px',
        position: 'relative',
        zIndex: 2,
        boxShadow: '0 4px 12px rgba(99,102,241,0.15)',
    },
    standbyTitle: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#1a1a1a',
        margin: '0 0 8px',
    },
    standbyText: {
        fontSize: '14px',
        color: '#888',
        lineHeight: '1.6',
        maxWidth: '380px',
        margin: '0 auto 24px',
    },
    standbyMeta: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
    },
    metaItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
    },
    metaLabel: {
        fontSize: '10px',
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontWeight: '600',
    },
    metaValue: {
        fontSize: '14px',
        color: '#1a1a1a',
        fontWeight: '700',
    },
    metaDivider: {
        width: '1px',
        height: '28px',
        background: '#e5e7eb',
    },

    /* Alert Card */
    alertCard: {
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(220,38,38,0.12)',
        border: '2px solid #fecaca',
        background: '#fff',
    },
    alertHeader: {
        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        color: '#fff',
    },
    alertEmoji: {
        fontSize: '32px',
        animation: 'ddBounce 1s ease-in-out infinite',
    },
    alertTitle: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '800',
        letterSpacing: '1px',
    },
    alertSubtext: {
        margin: '2px 0 0',
        fontSize: '13px',
        opacity: 0.85,
    },
    alertBody: {
        padding: '20px 24px',
    },
    alertInfoRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid #f3f4f6',
    },
    alertInfoItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    alertInfoLabel: {
        fontSize: '11px',
        color: '#9ca3af',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    alertInfoValue: {
        fontSize: '15px',
        color: '#1a1a1a',
        fontWeight: '700',
    },
    alertActions: {
        padding: '0 24px 24px',
        display: 'flex',
        gap: '12px',
    },
    acceptBtn: {
        flex: 2,
        padding: '16px',
        borderRadius: '14px',
        border: 'none',
        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        color: '#fff',
        fontSize: '15px',
        fontWeight: '800',
        cursor: 'pointer',
        letterSpacing: '0.5px',
        boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
        transition: 'transform 0.15s',
    },
    declineBtn: {
        flex: 1,
        padding: '16px',
        borderRadius: '14px',
        border: 'none',
        background: '#f3f4f6',
        color: '#6b7280',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },

    /* Active Ride */
    rideCard: {
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(5,150,105,0.1)',
        border: '2px solid #a7f3d0',
        background: '#fff',
    },
    rideHeader: {
        background: 'linear-gradient(135deg, #059669, #047857)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#fff',
    },
    rideHeaderLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    rideTitle: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '800',
        letterSpacing: '1px',
    },
    rideSubtext: {
        margin: '2px 0 0',
        fontSize: '13px',
        opacity: 0.85,
    },
    rideTimerBox: {
        textAlign: 'center',
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '10px',
        padding: '6px 14px',
    },
    rideTimerLabel: {
        display: 'block',
        fontSize: '9px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        opacity: 0.8,
    },
    rideTimerValue: {
        display: 'block',
        fontSize: '18px',
        fontWeight: '800',
        fontFamily: 'monospace',
    },
    rideBody: {
        padding: '24px',
    },
    ridePatient: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid #f3f4f6',
    },
    patientAvatar: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
    },
    patientName: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '700',
        color: '#1a1a1a',
    },
    patientLabel: {
        margin: '2px 0 0',
        fontSize: '12px',
        color: '#9ca3af',
    },
    locationShare: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#ecfdf5',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '20px',
    },
    shareIcon: {
        fontSize: '20px',
        animation: 'ddBlink 1.5s infinite',
    },
    shareTitle: {
        margin: 0,
        fontSize: '13px',
        fontWeight: '700',
        color: '#059669',
    },
    shareSubtext: {
        margin: '2px 0 0',
        fontSize: '12px',
        color: '#6b7280',
        fontFamily: 'monospace',
    },
    completeBtn: {
        width: '100%',
        padding: '16px',
        borderRadius: '14px',
        border: 'none',
        background: 'linear-gradient(135deg, #059669, #047857)',
        color: '#fff',
        fontSize: '16px',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
        transition: 'transform 0.15s',
        boxSizing: 'border-box',
    },
};

export default AmbulanceDriver;
