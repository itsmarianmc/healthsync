import type { Metadata } from 'next'
import LegalLayout from '@/app/legal/components/LegalLayout'
import LegalSection from '@/app/legal/components/LegalSection'
import LegalList from '@/app/legal/components/LegalList'
import Linkout from '@/app/legal/components/Linkout'

export const metadata: Metadata = {
    title: 'Cookie Policy',
    description: 'Cookie policy of itsmarian.dev - Learn about what cookies are used, why they are used, and how you can manage your cookie preferences.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'Cookie Policy',
        description: 'Cookie policy of itsmarian.dev - Learn about what cookies are used and how to manage them.',
    },
}

export default function CookiesPage() {
    return (
        <LegalLayout title="Cookie Policy">
            <section className="section">
                <div className="text-section">
                    This Cookie Policy explains what cookies are, which cookies itsmarian uses on this
                    website, why they are used, and how you can manage your preferences. It should be read
                    alongside the{' '}
                    <Linkout className='linkout nodecoration' item='/legal/privacy' target='_blank' type='internal'>Privacy Policy</Linkout>
                    and the{' '}
                    <Linkout className='linkout nodecoration' item='/legal/terms' target='_blank' type='internal'>Terms of Use</Linkout>, which together
                    govern your use of this website.
                </div>
                <div className="text-section">
                    By continuing to use this website, you confirm that you have read and agree to the use
                    of cookies as described below. If you do not agree, you may manage or disable cookies
                    via your browser settings or leave the website.
                </div>
                <div className="text-section">
                    Last updated: 9 May 2026
                </div>
            </section>
            <LegalSection heading="What are Cookies?">
                Cookies are small text files stored on your device (e.g. computer, smartphone or tablet)
                when you visit a website. They allow the website to recognise your device on future visits
                and remember information such as your language preferences or login status.
            </LegalSection>
            <LegalSection>
                When you first visit a website, the web server sends a cookie to your browser, which stores
                it locally. On subsequent visits, your browser sends the cookie back to the server, allowing
                the website to recognise you and retain your settings. Cookies do not contain executable
                code and cannot access other data on your device.
            </LegalSection>
            <LegalSection heading="How long do cookies last?">
                Cookies fall into two categories based on how long they are stored:
                <LegalList items={[
                    {
                        label: 'Session cookies',
                        text: 'These are temporary and are deleted automatically when you close your browser. They are used to maintain your session while you navigate the site.',
                    },
                    {
                        label: 'Persistent cookies',
                        text: 'These remain on your device after your browser is closed, for a defined period of time. They are used to remember your preferences across visits.',
                    },
                ]} />
            </LegalSection>
            <LegalSection heading="Which cookies do I use?">
                I use the following categories of cookies on this website:
                <LegalList items={[
                    {
                        label: 'Necessary cookies',
                        text: 'Essential for the basic operation of the website and cannot be disabled. They ensure security, enable navigation, and support core features such as login and consent management. These cookies are set on the basis of my legitimate interest to operate the website.',
                    },
                    {
                        label: 'Preference and personalisation cookies',
                        text: 'Allow the website to remember your choices (such as language, region or display settings) and provide a more personalised experience. These require your consent.',
                    },
                    {
                        label: 'Analytics and statistics cookies',
                        text: 'Collect anonymised information about how visitors use this website, such as which pages are visited most frequently. This data is used solely to improve the website. These require your consent.',
                    },
                    {
                        label: 'Third-party cookies',
                        text: 'Set by third-party services integrated into this website (e.g. Google Analytics, embedded content). These providers may set their own cookies subject to their own privacy policies. These require your consent.',
                    },
                ]} />
            </LegalSection>
            <LegalSection>
                This website does not serve third-party advertising. The "Marketing and Advertising" cookie
                category does not currently apply. Should this change in future, this policy will be updated
                accordingly and your consent will be sought before any such cookies are placed.
            </LegalSection>
            <LegalSection heading="Legal basis">
                The use of cookies on this website is governed by applicable data protection law, in
                particular the General Data Protection Regulation (GDPR). Necessary cookies are used on
                the basis of my legitimate interest in operating a functional and secure website (Art. 6(1)(f)
                GDPR). All other cookies are placed only on the basis of your explicit, freely given consent
                (Art. 6(1)(a) GDPR), which you may withdraw at any time.
            </LegalSection>
            <LegalSection heading="Managing your cookies">
                You can review and change your cookie preferences at any time by clicking
                "Change Cookie Preferences" in the footer of any page on this website.
            </LegalSection>
            <LegalSection>
                You may also manage or delete cookies directly through your browser settings. Most browsers
                allow you to block or delete cookies, and to be notified when a cookie is set. Please note
                that disabling certain cookies — in particular necessary cookies — may affect the
                functionality of this website. The following links provide guidance for common browsers:
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
            <LegalSection heading="Further information">
                For full details on how personal data is collected, processed and stored in connection with
                cookies and other technologies, please refer to the{' '}
                <Linkout className='linkout nodecoration' item='/legal/privacy' target='_blank' type='internal'>Privacy Policy</Linkout>. If you have
                any questions about this Cookie Policy, you may contact me at{' '}
                <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">support@itsmarian.dev</Linkout>.
            </LegalSection>

        </LegalLayout>
    );
}