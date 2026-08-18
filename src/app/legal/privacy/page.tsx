import type { Metadata } from 'next'
import LegalLayout from '@/app/legal/components/LegalLayout'
import LegalList from '@/app/legal/components/LegalList'
import Linkout from '@/app/legal/components/Linkout'

export const metadata: Metadata = {
    title: 'Privacy Policy - HealthSync',
    description:
        'Privacy policy for HealthSync, a personal health-tracking app by itsmarian. Learn how your account data, health metrics, food, hydration and workout entries are collected, processed and protected in compliance with the GDPR.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'Privacy Policy - HealthSync',
        description:
            'Privacy policy for HealthSync, part of itsmarian\'s projects. Learn how we handle your account data, health metrics and device data.',
    },
}

export default function PrivacyPage() {
    return (
        <LegalLayout title="Privacy Policy" eyebrow="HealthSync · Legal">
            <section className="section" id="m716">
                <div className="text-section">
                    <span className="legal-h1">Preamble</span>
                </div>
                <div className="text-section">
                    HealthSync (hereinafter <strong>&quot;HealthSync&quot;</strong>, <strong>&quot;the app&quot;</strong>,
                    <strong> &quot;we&quot;</strong>, <strong>&quot;us&quot;</strong> or <strong>&quot;our&quot;</strong>) is a personal
                    health-tracking Progressive Web App offered as part of itsmarian&apos;s projects and reachable
                    at <Linkout item="https://healthsync.itsmarian.dev" type="external" className="linkout nodecoration" target="_blank">https://healthsync.itsmarian.dev</Linkout>.
                    The app combines calorie tracking (CalSync), hydration tracking (DropSync) and workout
                    logging in a single interface.
                </div>
                <div className="text-section">
                    The following Privacy Policy is intended to inform you about the types of personal data
                    (hereinafter also referred to as &quot;data&quot;) we process when you use HealthSync, the
                    purposes for which we do so, and the extent of such processing. Because HealthSync handles
                    information about your nutrition, hydration, fitness and goals, parts of the data we
                    process may constitute <strong>data concerning health</strong> within the meaning of
                    Art. 9 GDPR. We therefore explain these aspects in particular detail below.
                </div>
                <div className="text-section">
                    The terms used herein are not gender-specific.
                </div>
                <div className="text-section">
                    Last updated: 18 August 2026
                </div>
            </section>

            <section className="section content-section">
                <div className="text-section">
                    <h2>Table of Contents</h2>
                </div>
                <div className="text-section">
                    <div className="legal-contents">
                        {[
                            { id: 'm716',label: '#1',  title: 'Preamble' },
                            { id: 'm3',label: '#2',  title: 'Controller' },
                            { id: 'mOverview',label: '#3',  title: 'Overview of Processing Activities' },
                            { id: 'm2427',label: '#4',  title: 'Applicable Legal Bases' },
                            { id: 'm-health',label: '#5',  title: 'Health Data (Art. 9 GDPR)' },
                            { id: 'm27',label: '#6',  title: 'Security Measures' },
                            { id: 'm24',label: '#7',  title: 'International Data Transfers' },
                            { id: 'm12',label: '#8',  title: 'Data Retention and Erasure' },
                            { id: 'm10',label: '#9',  title: 'Rights of Data Subjects' },
                            { id: 'm225',label: '#10', title: 'Hosting, Auth and Application Backend' },
                            { id: 'm-local',label: '#11', title: 'Local Storage on Your Device' },
                            { id: 'm134',label: '#12', title: 'Use of Cookies' },
                            { id: 'm367',label: '#13', title: 'Registration, Login and User Account' },
                            { id: 'm-mfa',label: '#14', title: 'Two-Factor Authentication (MFA/TOTP)' },
                            { id: 'm-ai',label: '#15', title: 'AI Detection (Google Gemini, opt-in)' },
                            { id: 'm-off',label: '#16', title: 'Barcode Scanner & Open Food Facts' },
                            { id: 'm263',label: '#17', title: 'Analytics (Google Analytics, consent-based)' },
                            { id: 'm182',label: '#18', title: 'Contact and Enquiry Management' },
                            { id: 'm-children',label: '#19', title: 'Children' },
                            { id: 'm15',label: '#20', title: 'Changes and Updates' },
                            { id: 'm42',label: '#21', title: 'Definitions' },
                        ].map((item, idx) => (
                            <div key={idx} className="legal-content" data-tag-type="scroll-to" data-scroll-to-id={item.id}>
                                <div className="legal-content-l">
                                    <a>{item.label}</a>
                                </div>
                                <div className="legal-content-r">
                                    <Linkout item={`#${item.id}`} type="internal" className="linkout nodecoration">
                                        {item.title}
                                    </Linkout>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section" id="m3">
                <div className="text-section">
                    <span className="legal-h1">Controller</span>
                </div>
                <div className="text-section">
                    Marian D. (operating under the name <strong>itsmarian</strong>)<br />
                    Germany
                </div>
                <div className="text-section">
                    HealthSync is a personal project of Marian and is provided as part of the itsmarian
                    portfolio of projects.
                </div>
                <div className="text-section">
                    E-mail address: <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">support@itsmarian.dev</Linkout>
                </div>
                <div className="text-section">
                    Legal notice / imprint: <Linkout item="https://itsmarian.dev/imprint" type="external" className="linkout nodecoration" target="_blank">https://itsmarian.dev/imprint</Linkout>
                </div>
            </section>

            <section className="section" id="mOverview">
                <div className="text-section">
                    <span className="legal-h1">Overview of Processing Activities</span>
                </div>
                <div className="text-section">
                    The following overview summarises the types of data processed when you use HealthSync,
                    the purposes of their processing, and the categories of data subjects concerned.
                </div>
                <div className="text-section">
                    <span className="legal-h2">Types of Data Processed</span>
                </div>
                <LegalList items={[
                    { text: 'Account data (e.g. e-mail address, password handled in hashed form by our authentication provider, optional display name).' },
                    { text: 'Health-related entries (food log, drink log, calorie/macro goals, hydration goal, workout sessions and routines).' },
                    { text: 'App preferences (theme, onboarding state, AI opt-in, language hints).' },
                    { text: 'Usage data (which views you open, frequency of interactions for diagnostic and aggregated analytics).' },
                    { text: 'Meta, communication and procedural data (IP addresses, timestamps, session identifiers, browser/device information).' },
                    { text: 'Log data (server access logs for hosting and request handling).' },
                ]} />
                <div className="text-section">
                    <span className="legal-h2">Categories of Data Subjects</span>
                </div>
                <LegalList items={[
                    { text: 'Users of HealthSync (registered account holders and unregistered visitors).' },
                    { text: 'Communication partners (e.g. persons contacting us by e-mail).' },
                ]} />
                <div className="text-section">
                    <span className="legal-h2">Purposes of Processing</span>
                </div>
                <LegalList items={[
                    { text: 'Provision of HealthSync as a contractual / free service and fulfilment of related obligations.' },
                    { text: 'Operation and synchronisation of your personal food, hydration and workout entries across devices.' },
                    { text: 'Security measures, fraud prevention and abuse prevention.' },
                    { text: 'Aggregated and pseudonymous reach/usage analysis (only with your consent).' },
                    { text: 'AI-based food analysis (only when explicitly enabled by you, with your own API key).' },
                    { text: 'Communication and user support.' },
                    { text: 'Information-technology infrastructure (hosting, monitoring, technical operation).' },
                ]} />
            </section>

            <section className="section" id="m2427">
                <div className="text-section">
                    <span className="legal-h1">Applicable Legal Bases</span>
                </div>
                <div className="text-section">
                    <strong>National data protection regulations in Germany: </strong>
                    In addition to the data protection provisions of the GDPR, national data protection
                    regulations apply in Germany. These include, in particular, the Federal Data Protection
                    Act (BDSG). The BDSG contains, in particular, specific provisions on the right of access,
                    the right to erasure, the right to object, the processing of special categories of
                    personal data, processing for other purposes, transmission, and automated individual
                    decision-making including profiling. The data protection laws of the individual German
                    federal states may also apply.
                </div>
                <div className="text-section">
                    <strong>Note on the applicability of the GDPR and the Swiss FADP: </strong>
                    These data protection notices serve both to provide information pursuant to the Swiss
                    Federal Act on Data Protection (FADP) and pursuant to the General Data Protection
                    Regulation (GDPR). For this reason, please note that the terminology of the GDPR is
                    used due to its broader geographical scope and comprehensibility.
                </div>
                <div className="text-section">
                    <strong>Supervisory authority: </strong>
                    Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit
                    Rheinland-Pfalz (LfDI RL-P), poststelle@datenschutz.rlp.de.
                    You may also lodge a complaint with the supervisory authority of your habitual
                    residence, place of work or place of the alleged infringement.
                </div>
                <div className="text-section">
                    <strong>Legal bases at a glance: </strong>
                    Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR); legitimate
                    interests (Art. 6(1)(f) GDPR); consent (Art. 6(1)(a) GDPR); legal obligation
                    (Art. 6(1)(c) GDPR); explicit consent for special categories of data, in particular
                    health data, pursuant to Art. 9(2)(a) GDPR.
                </div>
            </section>

            <section className="section" id="m-health">
                <div className="text-section">
                    <span className="legal-h1">Health Data (Art. 9 GDPR)</span>
                </div>
                <div className="text-section">
                    The entries you make in HealthSync - in particular food and drink logs, calorie and
                    macro goals, hydration goals and workout sessions - may, depending on context,
                    constitute <strong>data concerning health</strong> within the meaning of Art. 4(15) and
                    Art. 9(1) GDPR. We process this data only in order to provide you with the core
                    functionality of HealthSync as expressly requested by you (e.g. saving your food log so
                    that you can see your daily intake).
                </div>
                <div className="text-section">
                    <strong>Legal basis: </strong>
                    Your <strong>explicit consent</strong> pursuant to Art. 9(2)(a) GDPR, which you grant by
                    voluntarily registering for a HealthSync account, enabling cloud synchronisation and
                    actively entering data into the app. Without this consent, cloud synchronisation cannot
                    be provided.
                </div>
                <div className="text-section">
                    <strong>Voluntary nature: </strong>
                    You are never obliged to enter any health-related data. You may use HealthSync entirely
                    locally (without an account), in which case your entries remain on your device in your
                    browser&apos;s local storage and are not transmitted to our backend.
                </div>
                <div className="text-section">
                    <strong>Withdrawal: </strong>
                    You may withdraw your consent at any time with effect for the future by signing out,
                    disabling cloud sync, deleting individual entries or deleting your account. The
                    lawfulness of processing carried out prior to withdrawal remains unaffected.
                </div>
                <div className="text-section">
                    <strong>No medical use: </strong>
                    HealthSync is a personal-tracking tool. It is not a medical device, does not provide
                    medical advice and must not be used as a substitute for professional medical
                    consultation, diagnosis or treatment.
                </div>
            </section>

            <section className="section" id="m27">
                <div className="text-section">
                    <span className="legal-h1">Security Measures</span>
                </div>
                <div className="text-section">
                    We implement appropriate technical and organisational measures in accordance with the
                    applicable legal requirements, taking into account the state of the art, the costs of
                    implementation, and the nature, scope, circumstances and purposes of the processing,
                    as well as the varying likelihood and severity of the risk to the rights and freedoms
                    of natural persons, in order to ensure a level of protection appropriate to the risk.
                </div>
                <div className="text-section">
                    These measures include, in particular: TLS/SSL encryption for all traffic to and from
                    the app and its backend; access protection for the production database; row-level
                    security (RLS) policies in our database backend so that each user can only read and
                    modify their own data; optional Two-Factor Authentication (TOTP) for account login;
                    storage of authentication tokens in secure HTTP cookies; and the principle of data
                    minimisation in our database schema.
                </div>
                <div className="text-section">
                    <strong>Securing online connections via TLS/SSL encryption (HTTPS): </strong>
                    All connections between your browser and HealthSync, as well as between HealthSync and
                    its hosting/backend providers, are protected by TLS/SSL. The presence of HTTPS in the
                    address bar indicates that your session is encrypted.
                </div>
            </section>

            <section className="section" id="m24">
                <div className="text-section">
                    <span className="legal-h1">International Data Transfers</span>
                </div>
                <div className="text-section">
                    <strong>Data processing in third countries: </strong>
                    Where we transfer data to a third country (i.e. outside the European Union (EU) or the
                    European Economic Area (EEA)), or where such transfer occurs in the context of using
                    third-party services, this is done exclusively in accordance with the applicable legal
                    requirements.
                </div>
                <div className="text-section">
                    Some of the services we (or you, when you opt in) use may be provided by companies based
                    in the United States, including <strong>Vercel</strong> (hosting / CDN),
                    <strong> Google LLC / Google Ireland Limited</strong> (Google Analytics and, where
                    enabled by you, the Google Gemini API). For such transfers we primarily rely on the
                    EU-US Data Privacy Framework (DPF), recognised as a secure legal framework by an
                    adequacy decision of the European Commission dated 10 July 2023, and additionally on
                    Standard Contractual Clauses concluded with the respective providers.
                </div>
                <div className="text-section">
                    Further information on the DPF and a list of certified companies can be found on the
                    website of the U.S. Department of Commerce at{' '}
                    <Linkout item="https://www.dataprivacyframework.gov/" type="external" className="linkout nodecoration" target="_blank">
                        https://www.dataprivacyframework.gov/
                    </Linkout>.
                </div>
                <div className="text-section">
                    Information on third-country transfers and applicable adequacy decisions can be obtained
                    from the European Commission&apos;s information portal:{' '}
                    <Linkout item="https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection_en" type="external" className="linkout nodecoration" target="_blank">
                        https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection_en
                    </Linkout>.
                </div>
            </section>

            <section className="section" id="m12">
                <div className="text-section">
                    <span className="legal-h1">Data Retention and Erasure</span>
                </div>
                <div className="text-section">
                    We erase personal data that we process in accordance with the applicable statutory
                    provisions as soon as the underlying consents are revoked or no further legal grounds
                    for the processing exist.
                </div>
                <LegalList items={[
                    {
                        label: 'Account data',
                        text: 'Retained for as long as your HealthSync account exists. Upon deletion of your account, all associated rows in our database (food entries, drink entries, workout sessions, user settings) are deleted without undue delay, subject to any statutory retention obligations.',
                    },
                    {
                        label: 'Health-related entries',
                        text: 'Stored only for as long as you keep them in your account. Individual entries can be deleted at any time from within the app.',
                    },
                    {
                        label: 'Server log files',
                        text: 'Stored for a maximum of 30 days and then erased or anonymised. Data whose further retention is required for evidentiary purposes is exempt from erasure until the final resolution of the relevant incident.',
                    },
                    {
                        label: 'Local data on your device',
                        text: 'Remains in your browser\'s local storage until you clear it (e.g. through your browser settings, the “sign out” function, or by deleting site data). HealthSync cannot remotely erase data from your device.',
                    },
                ]} />
            </section>

            <section className="section" id="m10">
                <div className="text-section">
                    <span className="legal-h1">Rights of Data Subjects</span>
                </div>
                <div className="text-section">
                    <strong>Rights of data subjects under the GDPR: </strong>
                    As a data subject, you are entitled to various rights under the GDPR, arising in
                    particular from Articles 15 to 21 GDPR:
                </div>
                <LegalList items={[
                    {
                        label: 'Right to object',
                        text: 'You have the right to object at any time, on grounds relating to your particular situation, to the processing of personal data concerning you which is carried out on the basis of Art. 6(1)(e) or (f) GDPR; this also applies to profiling based on those provisions.',
                    },
                    {
                        label: 'Right to withdraw consent',
                        text: 'You have the right to withdraw any consent you have given at any time. The lawfulness of processing carried out prior to withdrawal remains unaffected.',
                    },
                    {
                        label: 'Right of access',
                        text: 'You have the right to obtain confirmation as to whether data concerning you is being processed, and to receive information about such data as well as further details and a copy of the data.',
                    },
                    {
                        label: 'Right to rectification',
                        text: 'You have the right to request the completion of data concerning you or the rectification of inaccurate data concerning you.',
                    },
                    {
                        label: 'Right to erasure and restriction of processing',
                        text: 'You have the right to request that data concerning you be erased without undue delay, or alternatively to request the restriction of the processing of such data. For most data, you can directly trigger erasure from within the app (deleting entries, deleting your account).',
                    },
                    {
                        label: 'Right to data portability',
                        text: 'You have the right to receive personal data concerning you that you have provided to us in a structured, commonly used and machine-readable format, or to request its transmission to another controller.',
                    },
                    {
                        label: 'Right to lodge a complaint with a supervisory authority',
                        text: 'Without prejudice to any other administrative or judicial remedy, you have the right to lodge a complaint with a supervisory authority, in particular in the Member State of your habitual residence, place of work or place of the alleged infringement.',
                    },
                    {
                        label: 'Right not to be subject to automated individual decision-making (Art. 22 GDPR)',
                        text: 'HealthSync does not use any form of automated individual decision-making, including profiling, within the meaning of Art. 22 GDPR. The AI Detection feature (Google Gemini) is strictly opt-in and only processes data when you actively trigger a request; it does not produce decisions that similarly affect you.',
                    },
                ]} />
            </section>

            <section className="section" id="m225">
                <div className="text-section">
                    <span className="legal-h1">Hosting, Auth and Application Backend</span>
                </div>
                <div className="text-section">
                    To deliver HealthSync we rely on the following processors, each of which acts as a data
                    processor under Art. 28 GDPR on the basis of a written data processing agreement.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Account data; health-related entries (food, drinks, workouts, goals); usage data; meta/communication/procedural data (IP addresses, timestamps, identification numbers); log data.',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Users of HealthSync.',
                    },
                    {
                        label: 'Purposes of processing and legitimate interests',
                        text: 'Provision of HealthSync; information technology infrastructure; security measures; performance of contract; explicit consent for health data (Art. 9(2)(a) GDPR).',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the section "Data Retention and Erasure".',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR); legitimate interests (Art. 6(1)(f) GDPR); explicit consent (Art. 9(2)(a) GDPR) for health data.',
                    },
                ]} />
                <div className="text-section">
                    <strong>Further information on processing activities, procedures and services:</strong>
                </div>
                <LegalList items={[
                    {
                        label: 'Vercel (web hosting / CDN)',
                        text: (
                            <>
                                HealthSync is built with Next.js and deployed via Vercel. Vercel provides
                                server-side rendering, edge delivery and access logging. Service provider:
                                Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA. Legal bases:
                                Legitimate interests (Art. 6(1)(f) GDPR). Privacy policy:{' '}
                                <Linkout item="https://vercel.com/legal/privacy-policy" type="external" className="linkout nodecoration" target="_blank">
                                    https://vercel.com/legal/privacy-policy
                                </Linkout>
                                . Basis for third-country transfers: Data Privacy Framework (DPF) and
                                Standard Contractual Clauses.
                            </>
                        ),
                    },
                    {
                        label: 'Supabase (authentication, database, storage)',
                        text: (
                            <>
                                Account management, login sessions and persistent storage of your food,
                                drink, workout and settings data are handled by Supabase. We have configured
                                Row Level Security (RLS) so that each authenticated user can only access
                                their own rows. Session tokens are stored in secure cookies (not localStorage).
                                Service provider: Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992.
                                Legal bases: Performance of a contract (Art. 6(1)(b) GDPR); legitimate
                                interests (Art. 6(1)(f) GDPR); explicit consent for health data (Art. 9(2)(a)
                                GDPR). Privacy policy:{' '}
                                <Linkout item="https://supabase.com/privacy" type="external" className="linkout nodecoration" target="_blank">
                                    https://supabase.com/privacy
                                </Linkout>
                                . Data processing agreement:{' '}
                                <Linkout item="https://supabase.com/legal/dpa" type="external" className="linkout nodecoration" target="_blank">
                                    https://supabase.com/legal/dpa
                                </Linkout>
                                .
                            </>
                        ),
                    },
                    {
                        label: 'Static assets and shared resources (itsmarian static CDN)',
                        text: (
                            <>
                                HealthSync loads shared fonts, design variables and the Font Awesome icon
                                set from <Linkout item="https://static.itsmarian.dev" type="external" className="linkout nodecoration" target="_blank">https://static.itsmarian.dev</Linkout>,
                                which is operated by us. Loading these assets transmits standard request data
                                (IP address, user agent, referrer). Legal bases: Legitimate interests
                                (Art. 6(1)(f) GDPR) in efficient and consistent design.
                            </>
                        ),
                    },
                    {
                        label: 'Collection of access data and log files',
                        text: 'Access to HealthSync is logged in the form of "server log files". These log files may include the address and name of the pages and files accessed, the date and time of access, the volume of data transferred, a report on successful retrieval, the browser type and version, the operating system of the user, the referrer URL and, as a general rule, IP addresses and the requesting provider. Server log files may be used for security purposes (e.g. to prevent server overload or abusive attacks) and to ensure server utilisation and stability. Legal bases: Legitimate interests (Art. 6(1)(f) GDPR). Erasure of data: Log file information is stored for a maximum period of 30 days and then erased or anonymised.',
                    },
                ]} />
            </section>

            <section className="section" id="m-local">
                <div className="text-section">
                    <span className="legal-h1">Local Storage on Your Device</span>
                </div>
                <div className="text-section">
                    HealthSync is offline-capable. To make this possible, the app uses your browser&apos;s
                    <strong> localStorage</strong> to persist information such as your food and drink
                    entries, daily goals, selected theme, onboarding state, AI opt-in flag and similar
                    preferences directly on your device.
                </div>
                <div className="text-section">
                    This local storage is not a cookie within the meaning of § 25 TDDDG / ePrivacy
                    Directive when it is strictly necessary for the operation of the service you have
                    requested (e.g. remembering your last entries so the app works without reload).
                    Where local storage is used for purposes that are not strictly necessary, we will
                    rely on the legal basis applicable to that purpose (typically your consent under
                    Art. 6(1)(a) GDPR).
                </div>
                <div className="text-section">
                    Local data never leaves your device unless you actively sign in and enable cloud
                    synchronisation. You can clear local data at any time via your browser&apos;s site
                    settings or by signing out.
                </div>
            </section>

            <section className="section" id="m134">
                <div className="text-section">
                    <span className="legal-h1">Use of Cookies</span>
                </div>
                <div className="text-section">
                    The term &quot;cookies&quot; refers to functions that store and retrieve information on
                    users&apos; end devices. Cookies may be used for various purposes, including ensuring
                    the functionality, security and convenience of online offerings, as well as the
                    analysis of visitor traffic. We use cookies in accordance with the applicable legal
                    provisions. Where required, we obtain prior consent from users.
                </div>
                <div className="text-section">
                    For a full description of the cookies HealthSync uses, please refer to our{' '}
                    <Linkout item="/legal/cookies" type="internal" className="linkout nodecoration">
                        Cookie Policy
                    </Linkout>.
                </div>
                <LegalList items={[
                    {
                        label: 'Strictly necessary',
                        text: 'Including the secure authentication cookies set by Supabase that keep you signed in. Legal basis: legitimate interests (Art. 6(1)(f) GDPR) and Art. 25(2) TDDDG (strictly necessary exemption).',
                    },
                    {
                        label: 'Analytics (only with consent)',
                        text: 'Google Analytics is loaded with Google Consent Mode v2 defaulting to "denied" for all storage. Cookies are only set once you give consent in the cookie banner. Legal basis: consent (Art. 6(1)(a) GDPR).',
                    },
                    {
                        label: 'AI feature flag (only if enabled)',
                        text: 'When you enable AI Detection in the settings, your preference and your personal API key are stored locally and not in cookies.',
                    },
                ]} />
                <div className="text-section">
                    <strong>General notes on withdrawal and objection (opt-out): </strong>
                    You may withdraw any consent you have given at any time via the cookie banner
                    (&quot;Change Cookie Preferences&quot; link in the footer of every page) and via your
                    browser settings.
                </div>
            </section>

            <section className="section" id="m367">
                <div className="text-section">
                    <span className="legal-h1">Registration, Login and User Account</span>
                </div>
                <div className="text-section">
                    Using HealthSync without an account is possible - all entries are then stored only in
                    your browser&apos;s local storage. If you want your data to be synchronised across
                    devices, you may voluntarily create a user account. During the registration process,
                    we collect the data marked as mandatory (e-mail address and a password). Passwords are
                    never stored in clear text; they are hashed by our authentication provider (Supabase
                    Auth).
                </div>
                <div className="text-section">
                    In the context of registration and login, we additionally process your IP address and
                    the time of each authentication action on the basis of our legitimate interests in
                    protection against misuse and other unauthorised use. This data is not disclosed to
                    third parties unless such disclosure is necessary to pursue our claims or there is a
                    statutory obligation to do so.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Account data (e-mail address, hashed password, optional display name, profile picture if you provide one); content data (food, drink, workout entries you create); usage data; log data.',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Registered users of HealthSync.',
                    },
                    {
                        label: 'Purposes of processing and legitimate interests',
                        text: 'Provision of contractual services and cloud sync; security measures; provision of our online offering and user-friendliness.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the section "Data Retention and Erasure". Erasure upon deletion of the account.',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR); legitimate interests (Art. 6(1)(f) GDPR); explicit consent for health data (Art. 9(2)(a) GDPR).',
                    },
                ]} />
                <div className="text-section">
                    <strong>Further information on processing activities, procedures and services:</strong>
                </div>
                <LegalList items={[
                    {
                        label: 'Use of pseudonyms',
                        text: 'You may use a pseudonym instead of your real name as your display name.',
                    },
                    {
                        label: 'User profiles are not publicly visible',
                        text: 'HealthSync has no social feed or public profile feature. Your data is visible only to you.',
                    },
                    {
                        label: 'Erasure on account deletion',
                        text: 'When you delete your account, all rows in our database that are associated with your user ID are removed without undue delay, subject only to statutory retention obligations.',
                    },
                    {
                        label: 'No obligation to retain data',
                        text: 'It is your responsibility to back up your data before requesting account deletion. We are entitled to irreversibly erase all data stored for your account once it has been deleted.',
                    },
                ]} />
            </section>

            <section className="section" id="m-mfa">
                <div className="text-section">
                    <span className="legal-h1">Two-Factor Authentication (MFA/TOTP)</span>
                </div>
                <div className="text-section">
                    HealthSync supports optional Two-Factor Authentication via Time-based One-Time
                    Passwords (TOTP). When you enable MFA, an authenticator secret is generated and stored
                    encrypted by our authentication provider. During login, you provide a six-digit code
                    from your authenticator app, which is verified server-side.
                </div>
                <div className="text-section">
                    The two-factor code is always required and verified server-side on every login.
                    HealthSync does not store a list of &quot;trusted&quot; devices in your browser, because such
                    a client-side list could be tampered with and would silently bypass the second
                    factor. You can revoke access at any time by signing out.
                </div>
                <div className="text-section">
                    <strong>Legal basis: </strong>
                    Performance of a contract (Art. 6(1)(b) GDPR) and our legitimate interest in account
                    security (Art. 6(1)(f) GDPR).
                </div>
            </section>

            <section className="section" id="m-ai">
                <div className="text-section">
                    <span className="legal-h1">AI Detection (Google Gemini, opt-in)</span>
                </div>
                <div className="text-section">
                    HealthSync offers an optional <strong>AI Detection</strong> feature inside CalSync
                    which can analyse food photos, camera input or text descriptions and return estimated
                    nutrition values. This feature is <strong>strictly opt-in</strong>, disabled by
                    default, and uses <strong>your own</strong> Google Gemini API key. Without an explicit
                    opt-in and a valid API key, no AI request is ever sent.
                </div>
                <div className="text-section">
                    When you actively trigger an AI request, HealthSync sends the food-related input you
                    provided (image bytes or text description) directly from your browser to{' '}
                    <Linkout item="https://generativelanguage.googleapis.com" type="external" className="linkout nodecoration" target="_blank">
                        generativelanguage.googleapis.com
                    </Linkout>
                    , authenticated with your API key. We do not proxy this traffic through our servers
                    and do not store the request or the model response on our backend.
                </div>
                <div className="text-section">
                    The processing of that request is governed by Google&apos;s terms and privacy policy
                    applicable to the Gemini API:{' '}
                    <Linkout item="https://ai.google.dev/gemini-api/terms" type="external" className="linkout nodecoration" target="_blank">
                        https://ai.google.dev/gemini-api/terms
                    </Linkout>
                    {' '}and{' '}
                    <Linkout item="https://policies.google.com/privacy" type="external" className="linkout nodecoration" target="_blank">
                        https://policies.google.com/privacy
                    </Linkout>.
                </div>
                <div className="text-section">
                    <strong>Legal bases: </strong>
                    Your explicit consent (Art. 6(1)(a) GDPR) by enabling the feature and confirming the
                    in-app AI terms; for health-related image or text content, additionally your explicit
                    consent under Art. 9(2)(a) GDPR.
                </div>
                <div className="text-section">
                    For details on how AI is used inside HealthSync, the risks it brings and your
                    responsibilities, please refer to our{' '}
                    <Linkout item="/legal/ai-guidelines" type="internal" className="linkout nodecoration">AI Guidelines</Linkout>.
                </div>
            </section>

            <section className="section" id="m-weather">
                <div className="text-section">
                    <span className="legal-h1">Weather Widget &amp; Geolocation (Open-Meteo, Nominatim)</span>
                </div>
                <div className="text-section">
                    HealthSync offers an optional weather widget on the dashboard. When you enable it,
                    your device&apos;s browser Geolocation API is used to obtain your approximate latitude
                    and longitude. This coordinate is sent to the public Open-Meteo API to retrieve current
                    weather data, and to the public Nominatim (OpenStreetMap) API to resolve a human-readable
                    location name.
                </div>
                <div className="text-section">
                    Service providers: Open-Meteo (open-source weather API, no personal data retained);
                    Nominatim / OpenStreetMap Foundation. Legal basis: your consent (Art. 6(1)(a) GDPR)
                    obtained via the cookie banner. You can disable the weather widget at any time in
                    Settings. Neither service receives your IP address directly from HealthSync; standard
                    request metadata (IP, user agent) may be logged by the services.
                </div>
            </section>

            <section className="section" id="m-support-api">
                <div className="text-section">
                    <span className="legal-h1">Support Form (api.itsmarian.dev)</span>
                </div>
                <div className="text-section">
                    When you submit a support request through the in-app support form, your message
                    content, e-mail address and standard request metadata (IP address, user agent) are
                    transmitted to{' '}
                    <code>api.itsmarian.dev</code>, an API endpoint operated by us. The data is processed
                    solely to respond to your enquiry and is not shared with third parties.
                    Legal basis: pre-contractual measures and performance of a contract (Art. 6(1)(b) GDPR);
                    legitimate interests (Art. 6(1)(f) GDPR) in responding to user enquiries.
                </div>
            </section>

            <section className="section" id="m-off">
                <div className="text-section">
                    <span className="legal-h1">Barcode Scanner &amp; Open Food Facts</span>
                </div>
                <div className="text-section">
                    CalSync includes a barcode scanner powered by the open-source ZXing library running
                    entirely in your browser. The camera stream itself never leaves your device - only
                    the decoded numeric barcode is used for product lookup.
                </div>
                <div className="text-section">
                    When a barcode is scanned, HealthSync queries the public Open Food Facts database to
                    retrieve product information (name, brand, nutrition values). This query transmits
                    the barcode and standard request metadata (IP address, user agent) to Open Food Facts.
                </div>
                <div className="text-section">
                    Service provider: Open Food Facts (non-profit association), 21 rue des Iris,
                    94250 Gentilly, France. Privacy policy:{' '}
                    <Linkout item="https://world.openfoodfacts.org/privacy" type="external" className="linkout nodecoration" target="_blank">
                        https://world.openfoodfacts.org/privacy
                    </Linkout>
                    . Legal basis: legitimate interests (Art. 6(1)(f) GDPR) in providing a convenient food
                    lookup feature you have actively triggered by scanning a barcode.
                </div>
            </section>

            <section className="section" id="m263">
                <div className="text-section">
                    <span className="legal-h1">Analytics (Google Analytics, consent-based)</span>
                </div>
                <div className="text-section">
                    HealthSync loads Google Analytics (GA4) in order to understand how the app is used in
                    aggregated, pseudonymous form (e.g. which views are most popular, on which devices
                    HealthSync runs). Google Analytics is initialised with{' '}
                    <strong>Google Consent Mode v2</strong>, where all storage categories
                    (<code>ad_storage</code>, <code>ad_user_data</code>, <code>ad_personalization</code>,{' '}
                    <code>analytics_storage</code>, <code>functionality_storage</code>,{' '}
                    <code>personalization_storage</code>) default to <strong>denied</strong>. Storage and
                    cookie placement are activated only after you grant consent through our cookie banner.
                </div>
                <div className="text-section">
                    IP addresses transmitted to Google Analytics for EU users are not logged; Google only
                    derives approximate geographic location metadata before discarding the IP. We do not
                    use Google Analytics for advertising purposes.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Usage data (pages visited, time spent, click paths, intensity and frequency of use, devices and operating systems used, interactions with content and functions); meta, communication and procedural data (timestamps, identification numbers, derived geolocation).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Users of HealthSync who have given analytics consent.',
                    },
                    {
                        label: 'Purposes of processing',
                        text: 'Reach measurement; provision of our online offering and user-friendliness.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Cookies are stored for up to 14 months (or shorter, depending on type). Erasure of cookies takes place automatically or via your browser settings.',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Consent (Art. 6(1)(a) GDPR).',
                    },
                ]} />
                <div className="text-section">
                    Service provider: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4,
                    Ireland. Privacy policy:{' '}
                    <Linkout item="https://policies.google.com/privacy" type="external" className="linkout nodecoration" target="_blank">
                        https://policies.google.com/privacy
                    </Linkout>
                    . Basis for third-country transfers: Data Privacy Framework (DPF), Standard
                    Contractual Clauses. Opt-out plug-in:{' '}
                    <Linkout item="https://tools.google.com/dlpage/gaoptout" type="external" className="linkout nodecoration" target="_blank">
                        https://tools.google.com/dlpage/gaoptout
                    </Linkout>.
                </div>
            </section>

            <section className="section" id="m182">
                <div className="text-section">
                    <span className="legal-h1">Contact and Enquiry Management</span>
                </div>
                <div className="text-section">
                    When you contact us (e.g. by e-mail) and in the context of existing user relationships,
                    the information provided is processed to the extent necessary to respond to your
                    request.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Contact data (e.g. e-mail address); content data (textual messages and their content); meta, communication and procedural data (e.g. timestamps).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Communication partners.',
                    },
                    {
                        label: 'Purposes of processing',
                        text: 'Communication; organisational and administrative procedures; feedback; user support.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the section "Data Retention and Erasure" once the enquiry is resolved and no statutory retention obligation applies.',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Legitimate interests (Art. 6(1)(f) GDPR); performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR).',
                    },
                ]} />
            </section>

            <section className="section" id="m-children">
                <div className="text-section">
                    <span className="legal-h1">Children</span>
                </div>
                <div className="text-section">
                    HealthSync is not directed at children under the age of 16. We do not knowingly collect
                    personal data from children under 16 without the consent of a parent or guardian. If
                    you believe that a child has provided us with personal data, please contact us so that
                    we can erase the data.
                </div>
            </section>

            <section className="section" id="m15">
                <div className="text-section">
                    <span className="legal-h1">Changes and Updates</span>
                </div>
                <div className="text-section">
                    We request that you familiarise yourself regularly with the content of our Privacy
                    Policy. We revise the Privacy Policy as soon as changes to the data processing
                    activities carried out by us make this necessary. We will notify you as soon as changes
                    require an action on your part (e.g. consent) or any other form of individual
                    notification.
                </div>
                <div className="text-section">
                    Where addresses and contact details of companies and organisations are provided in
                    this Privacy Policy, please note that such details may change over time and we
                    recommend that you verify the information before making contact.
                </div>
            </section>

            <section className="section" id="m42">
                <div className="text-section">
                    <span className="legal-h1">Definitions</span>
                </div>
                <div className="text-section">
                    This section provides an overview of the terms used in this Privacy Policy. Where
                    terms are defined by law, the statutory definitions apply. The following explanations
                    are intended primarily to aid understanding.
                </div>
                <LegalList items={[
                    {
                        label: 'Account data',
                        text: 'Information necessary to identify and administer your HealthSync user account, such as your e-mail address, hashed password, optional display name and any avatar information.',
                    },
                    {
                        label: 'Content data',
                        text: 'Information you create or upload while using HealthSync, in particular food entries, drink entries, workout sessions and routines, custom notes, goals and preferences.',
                    },
                    {
                        label: 'Contact data',
                        text: 'Essential information enabling communication with you, in particular your e-mail address.',
                    },
                    {
                        label: 'Meta, communication and procedural data',
                        text: 'Information about the manner in which data is processed, transmitted and managed, including IP addresses, timestamps, session identifiers and similar log information.',
                    },
                    {
                        label: 'Usage data',
                        text: 'Information that captures how you interact with HealthSync, such as which views you open, how often, on which device type and operating system.',
                    },
                    {
                        label: 'Personal data',
                        text: 'Any information relating to an identified or identifiable natural person (Art. 4(1) GDPR).',
                    },
                    {
                        label: 'Health data',
                        text: 'Personal data related to the physical or mental health of a natural person, including the provision of healthcare services, which reveal information about their health status (Art. 4(15) GDPR). Within HealthSync, the food, drink and workout entries you make can constitute health data.',
                    },
                    {
                        label: 'Log data',
                        text: 'Information about events or activities that have been logged in a system or network, such as timestamps, IP addresses, user actions and error messages.',
                    },
                    {
                        label: 'Reach measurement',
                        text: 'Evaluation of the flow of visitors to an online offering, which may encompass visitor behaviour or interests in relation to certain content. HealthSync uses reach measurement only with your consent.',
                    },
                    {
                        label: 'Controller',
                        text: 'The natural or legal person, public authority, agency or other body which, alone or jointly with others, determines the purposes and means of the processing of personal data (Art. 4(7) GDPR).',
                    },
                    {
                        label: 'Processing',
                        text: 'Any operation or set of operations which is performed on personal data or on sets of personal data, whether or not by automated means (Art. 4(2) GDPR).',
                    },
                ]} />
            </section>
        </LegalLayout>
    );
}
