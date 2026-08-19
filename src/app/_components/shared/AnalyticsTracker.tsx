'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useCookieConsent } from '../../_lib/useCookieConsent'

export default function AnalyticsTracker() {
    const pathname = usePathname()
    const { canUseAnalytics } = useCookieConsent()
    const consentRef = useRef(canUseAnalytics)
    const firstRender = useRef(true)

    useEffect(() => {
        consentRef.current = canUseAnalytics
    }, [canUseAnalytics])

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false
            return
        }
        if (!consentRef.current) return
        if (typeof window.gtag === 'undefined') return
        window.gtag('event', 'page_view', {
            page_path: pathname,
            page_title: document.title,
        })
    }, [pathname])

    return null
}