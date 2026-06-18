import type { Metadata } from 'next'
import LegalLayout from '@/app/legal/components/LegalLayout'
import LegalSection from '@/app/legal/components/LegalSection'
import LegalList from '@/app/legal/components/LegalList'
import Linkout from '@/app/legal/components/Linkout'

export const metadata: Metadata = {
    title: 'Cookie Policy - HealthSync',
    description:
        'Cookie policy for HealthSync, a personal health-tracking app by itsmarian. Learn which cookies and similar technologies are used, why they are used, and how you can manage your preferences.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'Cookie Policy - HealthSync',
        description:
            'Cookie policy for HealthSync, part of itsmarian\'s projects. Learn about cookies, browser storage and how to manage your preferences.',
    },
}

export default function CookiesPage() {
    return (
        <LegalLayout title="Cookie Policy" eyebrow="HealthSync · Legal">
            <section className="section">
                <div className="text-section">
                    This Cookie Policy explains what cookies and comparable browser-storage technologies
                    are, which of them <strong>HealthSync</strong> uses on
                    {' '}
                    <Linkout className='linkout nodecoration' item='https://healthsync.itsmarian.dev' type='external' target='_blank'>healthsync.itsmarian.dev</Linkout>
                    , why they are used, and how you can manage your preferences. HealthSync is part of
                    itsmarian&apos;s projects.
                </div>
                <div className="text-section">
                    It should be read alongside the{' '}
                    <Linkout className='linkout nodecoration' item='/legal/privacy' target='_blank' type='internal'>Privacy Policy</Linkout>
                    , the{' '}
                    <Linkout className='linkout nodecoration' item='/legal/terms' target='_blank' type='internal'>Terms of Use</Linkout>
                    {' '}and, where AI features are concerned, the{' '}
                    <Linkout className='linkout nodecoration' item='/legal/ai-guidelines' target='_blank' type='internal'>AI Guidelines</Linkout>
                    , which together govern your use of HealthSync.
                </div>
                <div className="text-section">
                    By continuing to use HealthSync, you confirm that you have read and understand this
                    Cookie Policy. Non-essential cookies are only set after you give explicit consent
                    through the cookie banner. You can update your choices at any time using
                    &quot;Change Cookie Preferences&quot; in the footer of any page.
                </div>
                <div className="text-section">
                    Last updated: 18 June 2026
                </div>
            </section>

            <LegalSection heading="What are cookies?">
                Cookies are small text files stored on your device (e.g. computer, smartphone or tablet)
                when you visit a website. They allow the website to recognise your device on future
                visits and remember information such as your language preferences or login status.
            </LegalSection>

            <LegalSection>
                When you first open HealthSync, the web server can send a cookie to your browser, which
                stores it locally. On subsequent visits, your browser sends the cookie back to the
                server, allowing HealthSync to recognise you and keep your session active. Cookies do
                not contain executable code and cannot access other data on your device.
            </LegalSection>

            <LegalSection heading="Cookies vs. local storage">
                HealthSync is a Progressive Web App. In addition to cookies, it uses your browser&apos;s
                <strong> localStorage</strong> to keep your food, drink and workout entries available
                even when you are offline, and to remember UI preferences such as the active theme.
                Browser storage that is strictly necessary to provide the service you have actively
                requested (offline functionality, remembering your last entries) does not require
                consent under § 25 TDDDG / ePrivacy Directive. For full details, see the{' '}
                <Linkout className='linkout nodecoration' item='/legal/privacy' target='_blank' type='internal'>Privacy Policy</Linkout>.
            </LegalSection>

            <LegalSection heading="How long do cookies last?">
                Cookies fall into two categories based on how long they are stored:
                <LegalList items={[
                    {
                        label: 'Session cookies',
                        text: 'Temporary and deleted automatically when you close your browser. Used to maintain your session while you navigate HealthSync.',
                    },
                    {
                        label: 'Persistent cookies',
                        text: 'Remain on your device after your browser is closed, for a defined period of time. Used to remember your preferences or to keep you signed in across sessions.',
                    },
                ]} />
            </LegalSection>

            <LegalSection heading="Which cookies and storage does HealthSync use?">
                HealthSync deliberately keeps the number of cookies and trackers small. The following
                categories apply:
                <LegalList items={[
                    {
                        label: 'Strictly necessary',
                        text: (
                            <>
                                Required for the basic operation of the app and cannot be disabled. This
                                includes the secure authentication cookies set by our backend provider
                                (Supabase) once you sign in. Without these, you cannot stay signed in or
                                synchronise your data across devices. Legal basis: legitimate interests
                                (Art. 6(1)(f) GDPR) and the strictly-necessary exemption under § 25(2)
                                TDDDG.
                            </>
                        ),
                    },
                    {
                        label: 'Preference and personalisation',
                        text: 'Remember UI choices such as the active theme, the last opened view and your onboarding state. These are kept in your browser\'s localStorage on your device and do not leave it unless you also enable cloud sync.',
                    },
                    {
                        label: 'Analytics and statistics (consent required)',
                        text: (
                            <>
                                We use Google Analytics 4 to understand in aggregated and pseudonymous form
                                how HealthSync is used (e.g. which views are most popular). Google Analytics
                                is initialised with Google Consent Mode v2 and defaults to <strong>denied</strong>
                                {' '}for every storage category. Cookies are only set after you grant consent
                                in the cookie banner. Legal basis: consent (Art. 6(1)(a) GDPR).
                            </>
                        ),
                    },
                    {
                        label: 'AI feature flag (only if you opt in)',
                        text: 'When you enable AI Detection in the settings, your opt-in flag and your personal Gemini API key are stored locally in your browser\'s localStorage and never in a cookie. They are sent only directly to Google when you actively trigger an AI request. See the AI Guidelines for details.',
                    },
                ]} />
            </LegalSection>

            <LegalSection>
                HealthSync does not serve third-party advertising and does not currently use any
                advertising or marketing cookies. Should this ever change, this Cookie Policy will be
                updated accordingly and your consent will be sought before any such cookies are placed.
            </LegalSection>

            <LegalSection heading="Legal basis">
                The use of cookies on HealthSync is governed by applicable data protection law, in
                particular the General Data Protection Regulation (GDPR) and the German TDDDG. Strictly
                necessary cookies are used on the basis of our legitimate interest in operating a
                functional and secure service (Art. 6(1)(f) GDPR) and the statutory exemption under §
                25(2) TDDDG. All other cookies are placed only on the basis of your explicit, freely
                given consent (Art. 6(1)(a) GDPR), which you may withdraw at any time.
            </LegalSection>

            <LegalSection heading="Managing your cookies">
                You can review and change your cookie preferences at any time by clicking
                &quot;Change Cookie Preferences&quot; in the footer of any page of HealthSync.
            </LegalSection>

            <LegalSection>
                You may also manage or delete cookies directly through your browser settings. Most
                browsers allow you to block or delete cookies, and to be notified when a cookie is set.
                Please note that disabling strictly necessary cookies may break sign-in and cloud
                synchronisation. The following links provide guidance for common browsers:
                <LegalList items={[
                    {
                        label: 'Google Chrome',
                        text: (
                            <Linkout
                                item="https://support.google.com/chrome/answer/95647"
                                type="external"
                                className="linkout nodecoration"
                                target="_blank"
                            >
                                https://support.google.com/chrome/answer/95647
                            </Linkout>
                        ),
                    },
                    {
                        label: 'Mozilla Firefox',
                        text: (
                            <Linkout
                                item="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                                type="external"
                                className="linkout nodecoration"
                                target="_blank"
                            >
                                https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer
                            </Linkout>
                        ),
                    },
                    {
                        label: 'Microsoft Edge',
                        text: (
                            <Linkout
                                item="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                                type="external"
                                className="linkout nodecoration"
                                target="_blank"
                            >
                                https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09
                            </Linkout>
                        ),
                    },
                    {
                        label: 'Apple Safari (macOS)',
                        text: (
                            <Linkout
                                item="https://support.apple.com/en-gb/guide/safari/sfri11471/mac"
                                type="external"
                                className="linkout nodecoration"
                                target="_blank"
                            >
                                https://support.apple.com/en-gb/guide/safari/sfri11471/mac
                            </Linkout>
                        ),
                    },
                    {
                        label: 'Apple Safari (iOS)',
                        text: (
                            <Linkout
                                item="https://support.apple.com/en-gb/HT201265"
                                type="external"
                                className="linkout nodecoration"
                                target="_blank"
                            >
                                https://support.apple.com/en-gb/HT201265
                            </Linkout>
                        ),
                    },
                ]} />
            </LegalSection>

            <LegalSection heading="Clearing local data">
                In addition to cookies, you may clear HealthSync&apos;s localStorage at any time via your
                browser&apos;s &quot;Clear site data&quot; option or by signing out from within the app.
                Clearing local data removes offline copies of your entries, your active theme and your
                onboarding state. Cloud-synced data is not affected and can be retrieved again by
                signing back in.
            </LegalSection>

            <LegalSection heading="Further information">
                For full details on how personal data is collected, processed and stored in connection
                with cookies and other technologies, please refer to the{' '}
                <Linkout className='linkout nodecoration' item='/legal/privacy' target='_blank' type='internal'>Privacy Policy</Linkout>.
                If you have any questions about this Cookie Policy, you may contact us at{' '}
                <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">support@itsmarian.dev</Linkout>.
            </LegalSection>
        </LegalLayout>
    );
}
