import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverContext } from '../context/DriverContext';
import { SocketContext } from '../context/SocketContext';

const AmbulanceDriverLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { loginDriver, driverToken } = useContext(DriverContext);
    const { registerDriverSocket } = useContext(SocketContext);

    useEffect(() => {
        if (driverToken) {
            navigate('/ambulance-driver');
        }
    }, [driverToken]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await loginDriver(email, password);
        if (success) {
            // Get driverData from localStorage after login sets it
            const driverIdFromStorage = localStorage.getItem('driverMongoId');
            // We need the driver's _id to register socket. loginDriver returns driverData.
            // Let's read from context after a short tick
            setTimeout(() => {
                navigate('/ambulance-driver');
            }, 100);
        }
        setLoading(false);
    };

    return (
        <div style={styles.wrapper}>
            <div style={styles.container}>
                {/* Left side — branding */}
                <div style={styles.leftPanel}>
                    <div style={styles.brandContent}>
                        <div style={styles.logoIcon}>🚑</div>
                        <h1 style={styles.brandTitle}>Prescripto</h1>
                        <p style={styles.brandSubtitle}>Ambulance Driver Portal</p>
                        <div style={styles.brandDivider}></div>
                        <p style={styles.brandDesc}>
                            Save lives. Accept emergency dispatches. Navigate to patients in real-time.
                        </p>
                        <div style={styles.statsRow}>
                            <div style={styles.statItem}>
                                <span style={styles.statNumber}>24/7</span>
                                <span style={styles.statLabel}>Availability</span>
                            </div>
                            <div style={styles.statItem}>
                                <span style={styles.statNumber}>&lt;4min</span>
                                <span style={styles.statLabel}>Avg Response</span>
                            </div>
                            <div style={styles.statItem}>
                                <span style={styles.statNumber}>500+</span>
                                <span style={styles.statLabel}>Lives Saved</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side — login form */}
                <div style={styles.rightPanel}>
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.formHeader}>
                            <h2 style={styles.formTitle}>Driver Login</h2>
                            <p style={styles.formSubtitle}>Access your dispatch dashboard</p>
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="driver@prescripto.com"
                                required
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={styles.input}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                ...styles.submitBtn,
                                opacity: loading ? 0.7 : 1,
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? (
                                <span style={styles.loadingInner}>
                                    <span style={styles.spinner}></span>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>

                        <div style={styles.dividerRow}>
                            <div style={styles.dividerLine}></div>
                            <span style={styles.dividerText}>or</span>
                            <div style={styles.dividerLine}></div>
                        </div>

                        <p style={styles.switchText}>
                            Are you a patient?{' '}
                            <span onClick={() => navigate('/login')} style={styles.switchLink}>
                                Login here
                            </span>
                        </p>
                    </form>
                </div>
            </div>

            <style>{`
                @keyframes driverLoginPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes driverLoginSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

const styles = {
    wrapper: {
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    container: {
        display: 'flex',
        width: '100%',
        maxWidth: '900px',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 80px rgba(0,0,0,0.15)',
        background: '#fff',
    },
    leftPanel: {
        flex: 1,
        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '50px 40px',
        position: 'relative',
        overflow: 'hidden',
    },
    brandContent: {
        textAlign: 'center',
        color: '#fff',
        position: 'relative',
        zIndex: 2,
    },
    logoIcon: {
        fontSize: '56px',
        marginBottom: '16px',
        animation: 'driverLoginPulse 2s ease-in-out infinite',
    },
    brandTitle: {
        fontSize: '28px',
        fontWeight: '800',
        letterSpacing: '1px',
        margin: 0,
    },
    brandSubtitle: {
        fontSize: '14px',
        opacity: 0.85,
        marginTop: '6px',
        fontWeight: '400',
        letterSpacing: '2px',
        textTransform: 'uppercase',
    },
    brandDivider: {
        width: '50px',
        height: '2px',
        background: 'rgba(255,255,255,0.4)',
        margin: '20px auto',
    },
    brandDesc: {
        fontSize: '14px',
        lineHeight: '1.6',
        opacity: 0.8,
        maxWidth: '260px',
        margin: '0 auto',
    },
    statsRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginTop: '28px',
    },
    statItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    statNumber: {
        fontSize: '18px',
        fontWeight: '800',
    },
    statLabel: {
        fontSize: '10px',
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginTop: '2px',
    },
    rightPanel: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '50px 40px',
        background: '#fff',
    },
    form: {
        width: '100%',
        maxWidth: '340px',
    },
    formHeader: {
        marginBottom: '30px',
    },
    formTitle: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#1a1a1a',
        margin: 0,
    },
    formSubtitle: {
        fontSize: '14px',
        color: '#888',
        marginTop: '6px',
    },
    inputGroup: {
        marginBottom: '20px',
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: '600',
        color: '#444',
        marginBottom: '6px',
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1.5px solid #e0e0e0',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
        background: '#fafafa',
    },
    submitBtn: {
        width: '100%',
        padding: '14px',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #dc2626, #991b1b)',
        color: '#fff',
        fontSize: '15px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        transition: 'all 0.2s',
        marginTop: '4px',
    },
    loadingInner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    spinner: {
        display: 'inline-block',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        animation: 'driverLoginSpin 0.6s linear infinite',
    },
    dividerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '24px 0',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        background: '#e5e5e5',
    },
    dividerText: {
        fontSize: '12px',
        color: '#aaa',
        textTransform: 'uppercase',
        letterSpacing: '1px',
    },
    switchText: {
        textAlign: 'center',
        fontSize: '13px',
        color: '#888',
    },
    switchLink: {
        color: '#dc2626',
        fontWeight: '600',
        cursor: 'pointer',
        textDecoration: 'underline',
    },
};

export default AmbulanceDriverLogin;
