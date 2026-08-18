'use client'

import { useEffect, useState, useRef } from 'react'
import { useCookieConsent } from '../../_lib/useCookieConsent'

declare global {
    interface Window { gtag: (...args: any[]) => void }
}

export default function CookieBanner() {
    const { settings, updateSettings } = useCookieConsent();

    const [panelVisible, setPanelVisible] = useState(false)
    const [panelActive, setPanelActive] = useState(false)

    const [bannerVisible, setBannerVisible] = useState(false) 
    const [bannerClosing, setBannerClosing] = useState(false)
    
    const [analytics, setAnalytics] = useState(settings.analytics)
    const [preferences, setPreferences] = useState(settings.preferences)
    const [thirdparty, setThirdparty] = useState(settings.thirdparty)

    const bannerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setAnalytics(settings.analytics)
        setPreferences(settings.preferences)
        setThirdparty(settings.thirdparty)
    }, [settings])

    const defaultConsent = {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        functionality_storage: 'denied',
        personalization_storage: 'denied',
        security_storage: 'denied'
    }

    const applyConsent = (settings: {
        analytics: boolean
        preferences: boolean
        thirdparty: boolean
    }) => {
        if (typeof window.gtag !== 'undefined') {
            window.gtag('consent', 'update', {
                analytics_storage: settings.analytics ? 'granted' : 'denied',
                functionality_storage: settings.preferences ? 'granted' : 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                personalization_storage: settings.preferences ? 'granted' : 'denied',
                security_storage: 'granted'
            })
            if (settings.analytics) {
                window.gtag('config', 'G-2E9SPPVJFL', {
                    page_path: window.location.pathname
                })
            }
        }
    }

    const hideBanner = () => {
        if (!bannerRef.current) return
        setBannerClosing(true)
        bannerRef.current.classList.add('hidden')
        const handleAnimationEnd = () => {
            if (bannerRef.current) {
                bannerRef.current.style.display = 'none'
            }
            setBannerVisible(false)
            bannerRef.current?.removeEventListener('animationend', handleAnimationEnd)
        }
        bannerRef.current.addEventListener('animationend', handleAnimationEnd, { once: true })
    }

    const loadCookieSettings = (): boolean => {
        return false;
    }

    const saveCookieSettings = () => {
        const newSettings = { analytics, preferences, thirdparty };
        updateSettings(newSettings);
        applyConsent(newSettings);
    }

    const openSettings = () => {
        setPanelVisible(true)
        requestAnimationFrame(() => {
            setPanelActive(true)
        })
        document.body.style.overflow = 'hidden'
    }

    const closeSettings = () => {
        setPanelActive(false)
        setTimeout(() => {
            setPanelVisible(false)
            document.body.style.overflow = ''
        }, 300)
    }

    const acceptAll = () => {
        const allTrue = { analytics: true, preferences: true, thirdparty: true };
        updateSettings(allTrue);
        applyConsent(allTrue);
        hideBanner()
    }

    const saveAndClose = () => {
        saveCookieSettings()
        closeSettings()
        hideBanner()
    }

    useEffect(() => {
        if (typeof window.gtag !== 'undefined') {
            window.gtag('consent', 'default', defaultConsent)
        }

        const bannerAccepted = localStorage.getItem('bannerAccepted') === 'true'

        if (bannerAccepted) {
            if (settings.analytics || settings.preferences || settings.thirdparty) {
                applyConsent(settings);
            }
            return
        }

        localStorage.removeItem('cookieSettings')
        setAnalytics(false)
        setPreferences(false)
        setThirdparty(false)
        if (typeof window.gtag !== 'undefined') {
            window.gtag('consent', 'default', defaultConsent)
        }
        setBannerVisible(true)
        setBannerClosing(false)
    }, [])

    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            const trigger = (e.target as Element).closest('.change-settings')
            if (trigger) {
                e.preventDefault()
                openSettings()
            }
        }
        document.addEventListener('click', handleDocumentClick)
        return () => document.removeEventListener('click', handleDocumentClick)
    }, [])

    if (!bannerVisible && !panelVisible) return null

    return (
        <>
            {bannerVisible && (
                <div className="cookie-banner" ref={bannerRef}>
                    <div className="cookie-header flex-column">
                        <div className="cookie-header cookie-header-bottom flex-row">
                            <div className="cookie-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 -960 960 960" width="30" fill="#fff">
                                    <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-75 29-147t81-128.5q52-56.5 125-91T475-881q21 0 43 2t45 7q-9 45 6 85t45 66.5q30 26.5 71.5 36.5t85.5-5q-26 59 7.5 113t99.5 56q1 11 1.5 20.5t.5 20.5q0 82-31.5 154.5t-85.5 127q-54 54.5-127 86T480-80Zm-60-480q25 0 42.5-17.5T480-620q0-25-17.5-42.5T420-680q-25 0-42.5 17.5T360-620q0 25 17.5 42.5T420-560Zm-80 200q25 0 42.5-17.5T400-420q0-25-17.5-42.5T340-480q-25 0-42.5 17.5T280-420q0 25 17.5 42.5T340-360Zm260 40q17 0 28.5-11.5T640-360q0-17-11.5-28.5T600-400q-17 0-28.5 11.5T560-360q0 17 11.5 28.5T600-320ZM480-160q122 0 216.5-84T800-458q-50-22-78.5-60T683-603q-77-11-132-66t-68-132q-80-2-140.5 29t-101 79.5Q201-644 180.5-587T160-480q0 133 93.5 226.5T480-160Zm0-324Z"/>
                                </svg>
                            </div>
                            <div>
                                <h2 className="cookie-title">This site uses cookies</h2>
                            </div>
                        </div>
                        <div>
                            <p className="cookie-description">
                                <a>This website uses cookies and similar technologies to ensure its basic functionality, enhance your user experience, analyze how it is used, gather anonymized statistics on website traffic and usage patterns, remember your preferences such as language or region, and provide enhanced features and to offer embedded content like videos, maps, or social media feeds.</a>
                                <br />
                                <a>By clicking "Accept," you agree to the use of all cookies. You can change your settings at any time. By using my services, you agree to the </a>
                                <a className="linkout nodecoration" href="https://healthsync.itsmarian.dev/legal/cookies">Cookie Policy</a><a>, the </a>
                                <a className="linkout nodecoration" href="https://healthsync.itsmarian.dev/legal/privacy">Privacy Policy</a>
                                <a> and the </a>
                                <a className="linkout nodecoration" href="https://healthsync.itsmarian.dev/legal/terms">Terms of Use</a><a>.</a>
                            </p>
                        </div>
                    </div>
                    <div className="cookie-buttons">
                        <button className="cookie-btn btn-primary" onClick={acceptAll}>
                            <i className="fas fa-check-circle"></i>
                            Accept all
                        </button>
                        <button className="cookie-btn btn-secondary ripple-btn" onClick={openSettings}>
                            <i className="fas fa-cog"></i>
                            Change settings
                        </button>
                    </div>
                </div>
            )}

            {panelVisible && (
                <>
                    <div className={`overlay ${panelActive ? 'active' : ''}`} onClick={closeSettings}></div>
                    <div className={`settings-panel ${panelActive ? 'active' : ''}`}>
                        <div className="settings-header">
                            <h2 className="settings-title">Cookie-Settings</h2>
                            <button className="close-btn" onClick={closeSettings}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="settings-content">
                            <div className="cookie-category">
                                <div className="category-header">
                                    <div className="category-icon" style={{ background: 'rgba(52, 211, 153, 0.15)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 -960 960 960" width="30" fill="#34d399">
                                            <path d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q97-30 162-118.5T718-480H480v-315l-240 90v207q0 7 2 18h238v316Z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="category-title">Necessary Cookies</h3>
                                    </div>
                                    <div className="toggle-container">
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked disabled />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <p className="category-description">These cookies are necessary for the basic functions of the website and cannot be disabled. They ensure security functions and enable navigation on the website.</p>
                            </div>

                            <div className="cookie-category">
                                <div className="category-header">
                                    <div className="category-icon" style={{ background: 'rgba(96, 165, 250, 0.15)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 -960 960 960" width="30" fill="#60a5fa">
                                            <path d="M80-120v-80h800v80H80Zm40-120v-280h120v280H120Zm200 0v-480h120v480H320Zm200 0v-360h120v360H520Zm200 0v-600h120v600H720Z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="category-title">Statistics and Analytics</h3>
                                    </div>
                                    <div className="toggle-container">
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <p className="category-description">These cookies collect information about how visitors use our website. They help us understand which pages are most popular and how visitors navigate the website. All data collected is anonymized.</p>
                            </div>

                            <div className="cookie-category">
                                <div className="category-header">
                                    <div className="category-icon" style={{ background: 'rgba(251, 191, 36, 0.15)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 0 24 24" width="30" fill="#fbbf24">
                                            <path d="m17.5 17.5-2.498.993L17.5 19.5l1 2.5 1-2.5 2.5-1.007-2.5-.993-1-2.514-1 2.514Zm1-15.5-1 2.5-2.498 1.007L17.5 6.5l1 2.514 1-2.514 2.5-.993L19.5 4.5l-1-2.5ZM7.714 9.714 10 4l2.286 5.714L18 12l-5.714 2.286L10 20l-2.286-5.714L2 12Zm.77.77L4.693 12l3.79 1.516L10 17.307l1.516-3.79L15.307 12l-3.79-1.516L10 6.693l-1.516 3.79Z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="category-title">Preferences and Personalization</h3>
                                    </div>
                                    <div className="toggle-container">
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={preferences} onChange={(e) => setPreferences(e.target.checked)} />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <p className="category-description">These cookies enable the website to remember choices you have made (such as your username, language, or region) and provide enhanced, more personal features.</p>
                                <p className="app-feature-hint">This stores your theme, display name, macro goals, supplement tracking settings, activity status, and other personal preferences.</p>
                            </div>

                            <div className="cookie-category">
                                <div className="category-header">
                                    <div className="category-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 -960 960 960" width="30" fill="#8b5cf6">
                                            <path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-40-343 237-137-237-137-237 137 237 137ZM160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11L160-252Zm320-228Z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="category-title">Third-Party Content</h3>
                                    </div>
                                    <div className="toggle-container">
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={thirdparty} onChange={(e) => setThirdparty(e.target.checked)} />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <p className="category-description">These cookies are set by third-party services that we use to provide additional features, such as embedded videos, maps, or social media content. Third-party providers may also use these cookies to deliver personalized advertising.</p>
                                <p className="app-feature-hint">This enables weather forecasts, AI food detection, and barcode product lookups.</p>
                            </div>
                        </div>
                        <div className="settings-footer">
                            <button className="btn-save" onClick={saveAndClose}>
                                <i className="fas fa-save"></i>
                                Save settings
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
