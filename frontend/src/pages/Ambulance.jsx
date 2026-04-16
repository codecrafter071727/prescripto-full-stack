import React, { useContext, useState, useEffect } from 'react';
import { SocketContext } from '../context/SocketContext';
import { AppContext } from '../context/AppContext';
import MapComponent from '../components/MapComponent';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const STATUS_STEPS = [
    { key: 'idle', label: 'Ready' },
    { key: 'locating', label: 'Getting Location' },
    { key: 'pending', label: 'Finding Ambulance' },
    { key: 'accepted', label: 'Ambulance Assigned' },
];

const Ambulance = () => {
    const { socket, isConnected } = useContext(SocketContext);
    const { userData, token } = useContext(AppContext);
    const navigate = useNavigate();

    const [requestStatus, setRequestStatus] = useState('idle');
    const [driverDetails, setDriverDetails] = useState(null);
    const [ambulanceLocation, setAmbulanceLocation] = useState(null);
    const [pickupLocation, setPickupLocation] = useState(null);
    const [destinationLocation, setDestinationLocation] = useState(null);
    const [eta, setEta] = useState(null);
    const [elapsedSearch, setElapsedSearch] = useState(0);

    // Search timer
    useEffect(() => {
        let interval;
        if (requestStatus === 'pending') {
            interval = setInterval(() => setElapsedSearch(p => p + 1), 1000);
        } else {
            setElapsedSearch(0);
        }
        return () => clearInterval(interval);
    }, [requestStatus]);

    // ETA calculation (rough)
    useEffect(() => {
        if (ambulanceLocation && pickupLocation) {
            const R = 6371;
            const dLat = (pickupLocation.lat - ambulanceLocation.lat) * Math.PI / 180;
            const dLng = (pickupLocation.lng - ambulanceLocation.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(ambulanceLocation.lat * Math.PI / 180) *
                Math.cos(pickupLocation.lat * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const dist = R * c;
            const avgSpeed = 40;
            const mins = Math.max(1, Math.round((dist / avgSpeed) * 60));
            setEta(mins);
        }
    }, [ambulanceLocation, pickupLocation]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('request_acknowledged', () => {
            setRequestStatus('pending');
            toast.info("🔍 Searching for nearby ambulances...");
        });

        socket.on('ambulance_assigned', (data) => {
            setRequestStatus('accepted');
            setDriverDetails(data.driverDetails);
            toast.success("🚑 Ambulance has been assigned to you!");
        });

        socket.on('live_tracking_update', (data) => {
            setAmbulanceLocation(data.location);
        });

        socket.on('ride_completed_notify', () => {
            setRequestStatus('idle');
            setDriverDetails(null);
            setAmbulanceLocation(null);
            setPickupLocation(null);
            setDestinationLocation(null);
            toast.success("✅ Ride completed. Stay safe!");
        });

        socket.on('error', (message) => {
            toast.error(message);
        });

        return () => {
            socket.off('request_acknowledged');
            socket.off('ambulance_assigned');
            socket.off('live_tracking_update');
            socket.off('ride_completed_notify');
            socket.off('error');
        };
    }, [socket]);

    const handleEmergencyRequest = () => {
        if (!isConnected) {
            toast.error("Not connected to server. Please refresh.");
            return;
        }

        setRequestStatus('locating');

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setPickupLocation(pos);
                    const dest = {
                        lat: pos.lat + 0.05,
                        lng: pos.lng + 0.05,
                    };
                    setDestinationLocation(dest);
                    socket.emit('user_request_ambulance', {
                        userName: userData?.name || "Guest User",
                        pickupLocation: pos,
                        destinationLocation: dest,
                    });
                },
                () => {
                    toast.warning("Location unavailable — using default.");
                    const pos = { lat: 28.6139, lng: 77.2090 };
                    setPickupLocation(pos);
                    const dest = { lat: pos.lat + 0.05, lng: pos.lng + 0.05 };
                    setDestinationLocation(dest);
                    socket.emit('user_request_ambulance', {
                        userName: userData?.name || "Guest User",
                        pickupLocation: pos,
                        destinationLocation: dest,
                    });
                }
            );
        } else {
            toast.error("Geolocation not supported.");
            setRequestStatus('idle');
        }
    };

    // Not logged in guard
    if (!token) {
        return (
            <div style={s.authGuard}>
                <div style={s.authCard}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                    <h2 style={{ margin: 0, fontSize: '22px', color: '#1a1a1a' }}>Login Required</h2>
                    <p style={{ color: '#888', margin: '10px 0 24px', lineHeight: '1.5' }}>
                        Please login to access emergency ambulance services.
                    </p>
                    <button onClick={() => navigate('/login')} style={s.authBtn}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const currentStepIdx = STATUS_STEPS.findIndex(st => st.key === requestStatus);

    return (
        <div style={s.page}>
            {/* Status Progress Bar */}
            <div style={s.progressBar}>
                {STATUS_STEPS.map((step, i) => (
                    <div key={step.key} style={s.progressStep}>
                        <div style={{
                            ...s.progressDot,
                            background: i <= currentStepIdx
                                ? 'linear-gradient(135deg, #dc2626, #ef4444)'
                                : '#e5e7eb',
                            color: i <= currentStepIdx ? '#fff' : '#9ca3af',
                            boxShadow: i <= currentStepIdx ? '0 2px 8px rgba(220,38,38,0.3)' : 'none',
                        }}>
                            {i < currentStepIdx ? '✓' : i + 1}
                        </div>
                        <span style={{
                            ...s.progressLabel,
                            color: i <= currentStepIdx ? '#dc2626' : '#9ca3af',
                            fontWeight: i === currentStepIdx ? '700' : '500',
                        }}>{step.label}</span>
                        {i < STATUS_STEPS.length - 1 && (
                            <div style={{
                                ...s.progressLine,
                                background: i < currentStepIdx
                                    ? '#dc2626'
                                    : '#e5e7eb',
                            }}></div>
                        )}
                    </div>
                ))}
            </div>

            <div style={s.mainLayout}>
                {/* Left Panel */}
                <div style={s.leftPanel}>
                    {/* IDLE state — Emergency Button */}
                    {requestStatus === 'idle' && (
                        <div style={s.idleContainer}>
                            <div style={s.emergencySection}>
                                <h1 style={s.heroTitle}>Emergency Ambulance</h1>
                                <p style={s.heroSubtitle}>
                                    One tap to dispatch the nearest ambulance to your location.
                                    Our drivers respond in under 4 minutes.
                                </p>

                                <div style={s.emergencyBtnWrapper}>
                                    <div style={s.pulseRing1}></div>
                                    <div style={s.pulseRing2}></div>
                                    <button
                                        onClick={handleEmergencyRequest}
                                        style={s.emergencyBtn}
                                        id="emergency-button"
                                    >
                                        <span style={{ fontSize: '32px' }}>🚨</span>
                                        <span style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '2px' }}>
                                            SOS EMERGENCY
                                        </span>
                                    </button>
                                </div>

                                <div style={s.featureRow}>
                                    <div style={s.featureItem}>
                                        <span style={{ fontSize: '20px' }}>⚡</span>
                                        <span style={s.featureText}>Instant Dispatch</span>
                                    </div>
                                    <div style={s.featureItem}>
                                        <span style={{ fontSize: '20px' }}>📍</span>
                                        <span style={s.featureText}>GPS Tracking</span>
                                    </div>
                                    <div style={s.featureItem}>
                                        <span style={{ fontSize: '20px' }}>🏥</span>
                                        <span style={s.featureText}>Hospital Route</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LOCATING state */}
                    {requestStatus === 'locating' && (
                        <div style={s.statusCard}>
                            <div style={s.loadingSpinnerLarge}></div>
                            <h2 style={s.statusTitle}>Getting Your Location</h2>
                            <p style={s.statusSubtext}>Please allow location access when prompted...</p>
                        </div>
                    )}

                    {/* PENDING state */}
                    {requestStatus === 'pending' && (
                        <div style={s.statusCard}>
                            <div style={s.searchAnimation}>
                                <div style={s.searchRadar}></div>
                                <span style={{ fontSize: '36px', position: 'relative', zIndex: 2 }}>🚑</span>
                            </div>
                            <h2 style={s.statusTitle}>Finding Nearest Ambulance</h2>
                            <p style={s.statusSubtext}>
                                Searching for available drivers nearby...
                            </p>
                            <div style={s.searchTimer}>
                                <span style={s.timerDot}></span>
                                Searching for {elapsedSearch}s
                            </div>
                        </div>
                    )}

                    {/* ACCEPTED state */}
                    {requestStatus === 'accepted' && driverDetails && (
                        <div style={s.acceptedContainer}>
                            {/* Success Header */}
                            <div style={s.successBanner}>
                                <div style={{ fontSize: '28px' }}>✅</div>
                                <div>
                                    <h3 style={s.successTitle}>Ambulance Assigned!</h3>
                                    <p style={s.successSubtext}>Driver is on the way to you</p>
                                </div>
                                {eta && (
                                    <div style={s.etaBadge}>
                                        <span style={s.etaNumber}>{eta}</span>
                                        <span style={s.etaLabel}>min</span>
                                    </div>
                                )}
                            </div>

                            {/* Driver Card */}
                            <div style={s.driverCard}>
                                <div style={s.driverHeader}>
                                    <div style={s.driverAvatar}>👨‍⚕️</div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={s.driverName}>{driverDetails.name}</h4>
                                        <div style={s.driverStatus}>
                                            <span style={s.liveIndicator}></span>
                                            En Route to You
                                        </div>
                                    </div>
                                </div>

                                <div style={s.driverInfo}>
                                    <div style={s.infoItem}>
                                        <span style={s.infoLabel}>Vehicle</span>
                                        <span style={s.vehicleBadge}>{driverDetails.vehicleNumber}</span>
                                    </div>
                                    <div style={s.infoItem}>
                                        <span style={s.infoLabel}>Contact</span>
                                        <span style={s.infoValue}>{driverDetails.phone}</span>
                                    </div>
                                </div>

                                <a
                                    href={`tel:${driverDetails.phone}`}
                                    style={s.callBtn}
                                    id="call-driver-btn"
                                >
                                    📞 Call Driver Now
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel — Map */}
                <div style={s.rightPanel}>
                    <div style={s.mapWrapper}>
                        <MapComponent
                            origin={pickupLocation}
                            destination={destinationLocation}
                            ambulanceLocation={ambulanceLocation}
                        />
                        {!pickupLocation && (
                            <div style={s.mapOverlay}>
                                <span style={{ fontSize: '40px' }}>🗺️</span>
                                <p style={{ color: '#666', margin: '8px 0 0', fontSize: '14px' }}>
                                    Map will appear once you request an ambulance
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Animations (CSS-in-JS keyframes injected once) */}
            <style>{`
                @keyframes ambPulse1 {
                    0% { transform: scale(1); opacity: 0.5; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
                @keyframes ambPulse2 {
                    0% { transform: scale(1); opacity: 0.3; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
                @keyframes ambSpin {
                    to { transform: rotate(360deg); }
                }
                @keyframes ambRadar {
                    0% { transform: scale(0.5); opacity: 0.6; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                @keyframes ambBlink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

/* ── Premium inline styles ────────────────────────────────────────── */
const s = {
    page: {
        padding: '10px 0 40px',
    },

    /* Progress Bar */
    progressBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0',
        marginBottom: '24px',
        flexWrap: 'wrap',
    },
    progressStep: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    progressDot: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: '700',
        transition: 'all 0.3s',
    },
    progressLabel: {
        fontSize: '12px',
        letterSpacing: '0.5px',
        transition: 'all 0.3s',
    },
    progressLine: {
        width: '40px',
        height: '2px',
        margin: '0 8px',
        borderRadius: '2px',
        transition: 'all 0.3s',
    },

    /* Layout */
    mainLayout: {
        display: 'flex',
        gap: '24px',
        minHeight: '520px',
        flexWrap: 'wrap',
    },
    leftPanel: {
        flex: '1 1 360px',
        minWidth: '320px',
    },
    rightPanel: {
        flex: '1.5 1 400px',
        minWidth: '320px',
    },

    /* Auth Guard */
    authGuard: {
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    authCard: {
        textAlign: 'center',
        padding: '50px',
        borderRadius: '20px',
        background: '#fff',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        maxWidth: '380px',
    },
    authBtn: {
        padding: '12px 32px',
        borderRadius: '10px',
        border: 'none',
        background: 'linear-gradient(135deg, #dc2626, #ef4444)',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
    },

    /* IDLE state */
    idleContainer: {
        background: '#fff',
        borderRadius: '20px',
        padding: '40px 32px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    emergencySection: {
        textAlign: 'center',
    },
    heroTitle: {
        fontSize: '26px',
        fontWeight: '800',
        color: '#1a1a1a',
        margin: '0 0 10px',
    },
    heroSubtitle: {
        fontSize: '14px',
        color: '#888',
        lineHeight: '1.6',
        maxWidth: '320px',
        margin: '0 auto 30px',
    },
    emergencyBtnWrapper: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
    },
    pulseRing1: {
        position: 'absolute',
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        border: '3px solid rgba(220,38,38,0.3)',
        animation: 'ambPulse1 2s ease-out infinite',
    },
    pulseRing2: {
        position: 'absolute',
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        border: '3px solid rgba(220,38,38,0.2)',
        animation: 'ambPulse2 2s ease-out infinite 0.5s',
    },
    emergencyBtn: {
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(145deg, #dc2626, #991b1b)',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        boxShadow: '0 8px 30px rgba(220,38,38,0.4)',
        transition: 'transform 0.15s',
        position: 'relative',
        zIndex: 2,
    },
    featureRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        flexWrap: 'wrap',
    },
    featureItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    featureText: {
        fontSize: '12px',
        color: '#666',
        fontWeight: '600',
    },

    /* STATUS cards (locating / pending) */
    statusCard: {
        background: '#fff',
        borderRadius: '20px',
        padding: '50px 32px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
        textAlign: 'center',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingSpinnerLarge: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: '4px solid #f3f4f6',
        borderTopColor: '#dc2626',
        animation: 'ambSpin 0.8s linear infinite',
        marginBottom: '20px',
    },
    statusTitle: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#1a1a1a',
        margin: '0 0 8px',
    },
    statusSubtext: {
        fontSize: '14px',
        color: '#888',
        margin: 0,
    },

    /* Search animation */
    searchAnimation: {
        position: 'relative',
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
    },
    searchRadar: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        border: '3px solid rgba(220,38,38,0.3)',
        animation: 'ambRadar 1.5s ease-out infinite',
    },
    searchTimer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '16px',
        padding: '8px 16px',
        borderRadius: '20px',
        background: '#fef2f2',
        color: '#dc2626',
        fontSize: '13px',
        fontWeight: '600',
    },
    timerDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#dc2626',
        animation: 'ambBlink 1s infinite',
    },

    /* ACCEPTED state */
    acceptedContainer: {
        background: '#fff',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
    },
    successBanner: {
        background: 'linear-gradient(135deg, #059669, #10b981)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        color: '#fff',
    },
    successTitle: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '700',
    },
    successSubtext: {
        margin: '2px 0 0',
        fontSize: '13px',
        opacity: 0.85,
    },
    etaBadge: {
        marginLeft: 'auto',
        textAlign: 'center',
        background: 'rgba(255,255,255,0.2)',
        borderRadius: '12px',
        padding: '8px 14px',
    },
    etaNumber: {
        display: 'block',
        fontSize: '22px',
        fontWeight: '800',
    },
    etaLabel: {
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        opacity: 0.8,
    },

    /* Driver Card */
    driverCard: {
        padding: '24px',
    },
    driverHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid #f3f4f6',
    },
    driverAvatar: {
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '26px',
    },
    driverName: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '700',
        color: '#1a1a1a',
    },
    driverStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        color: '#059669',
        fontWeight: '500',
        marginTop: '2px',
    },
    liveIndicator: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#059669',
        animation: 'ambBlink 1s infinite',
    },
    driverInfo: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '20px',
        gap: '12px',
    },
    infoItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    infoLabel: {
        fontSize: '11px',
        color: '#9ca3af',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    infoValue: {
        fontSize: '15px',
        color: '#1a1a1a',
        fontWeight: '700',
    },
    vehicleBadge: {
        fontSize: '14px',
        fontWeight: '800',
        color: '#92400e',
        background: '#fef3c7',
        padding: '4px 12px',
        borderRadius: '6px',
        border: '1px solid #fcd34d',
    },
    callBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #059669, #10b981)',
        color: '#fff',
        fontSize: '16px',
        fontWeight: '700',
        textDecoration: 'none',
        boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
        transition: 'transform 0.15s',
        boxSizing: 'border-box',
    },

    /* Map */
    mapWrapper: {
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb',
        height: '100%',
        minHeight: '480px',
    },
    mapOverlay: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(249,250,251,0.85)',
        backdropFilter: 'blur(4px)',
    },
};

export default Ambulance;
