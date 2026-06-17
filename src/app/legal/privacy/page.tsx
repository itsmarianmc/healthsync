import type { Metadata } from 'next'
import LegalLayout from '@/app/legal/components/LegalLayout'
import LegalSection from '@/app/legal/components/LegalSection'
import LegalList from '@/app/legal/components/LegalList'
import LegalEnumeration from '@/app/legal/components/LegalEnumeration'
import Linkout from '@/app/legal/components/Linkout'

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'Privacy policy of itsmarian.dev - Learn how we collect, use, and protect your personal data in compliance with the GDPR and other applicable laws.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'Privacy Policy',
        description: 'Privacy policy of itsmarian.dev - Learn how we collect, use, and protect your personal data.',
    },
}

export default function PrivacyPage() {
    return (
        <LegalLayout title="Privacy Policy">
            <section className="section" id="m716">
                <div className="text-section">
                    <span className="legal-h1">Preamble</span>
                </div>
                <div className="text-section">
                    The following Privacy Policy is intended to inform you about the types of personal data
                    (hereinafter also referred to as "data") we process, the purposes for which we do so, and
                    the extent of such processing. This Privacy Policy applies to all processing of personal
                    data carried out by us, both in the context of providing our services and, in particular,
                    on our websites, in mobile applications, and within external online presences such as our
                    social media profiles (hereinafter collectively referred to as the "online offering").
                </div>
                <div className="text-section">
                    The terms used herein are not gender-specific.
                </div>
                <div className="text-section">
                    Last updated: 9 May 2026
                </div>
            </section>
            <section className="section content-section">
                <div className="text-section">
                    <h2>Table of Contents</h2>
                </div>
                <div className="text-section">
                    <div className="legal-contents">
                        {[
                            { id: 'm716',    label: '#1',  title: 'Preamble' },
                            { id: 'm3',      label: '#2',  title: 'Controller' },
                            { id: 'mOverview', label: '#3', title: 'Overview of Processing Activities' },
                            { id: 'm2427',   label: '#4',  title: 'Applicable Legal Bases' },
                            { id: 'm27',     label: '#5',  title: 'Security Measures' },
                            { id: 'm24',     label: '#6',  title: 'International Data Transfers' },
                            { id: 'm12',     label: '#7',  title: 'General Information on Data Retention and Erasure' },
                            { id: 'm10',     label: '#8',  title: 'Rights of Data Subjects' },
                            { id: 'm225',    label: '#9',  title: 'Provision of the Online Offering and Web Hosting' },
                            { id: 'm134',    label: '#10', title: 'Use of Cookies' },
                            { id: 'm367',    label: '#11', title: 'Registration, Login and User Account' },
                            { id: 'm182',    label: '#12', title: 'Contact and Enquiry Management' },
                            { id: 'm263',    label: '#13', title: 'Web Analytics, Monitoring and Optimisation' },
                            { id: 'm2324',   label: '#14', title: 'Data Protection Information for Whistleblowers' },
                            { id: 'm15',     label: '#15', title: 'Changes and Updates' },
                            { id: 'm42',     label: '#16', title: 'Definitions' },
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
                    Marian D.<br />
                    Germany
                </div>
                <div className="text-section">
                    Authorised representative: Marian D.
                </div>
                <div className="text-section">
                    E-mail address: <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">support@itsmarian.dev</Linkout>
                </div>
                <div className="text-section">
                    Legal notice: <Linkout item="https://itsmarian.dev/imprint" type="internal" className="linkout nodecoration" target="_blank">https://itsmarian.dev/imprint</Linkout>
                </div>
            </section>
            <section className="section" id="mOverview">
                <div className="text-section">
                    <span className="legal-h1">Overview of Processing Activities</span>
                </div>
                <div className="text-section">
                    The following overview summarises the types of data processed and the purposes of their
                    processing, and refers to the data subjects concerned.
                </div>
                <div className="text-section">
                    <span className="legal-h2">Types of Data Processed</span>
                </div>
                <LegalList items={[
                    { text: 'Master data.' },
                    { text: 'Employee data.' },
                    { text: 'Contact data.' },
                    { text: 'Content data.' },
                    { text: 'Usage data.' },
                    { text: 'Meta, communication and procedural data.' },
                    { text: 'Log data.' },
                ]} />
                <div className="text-section">
                    <span className="legal-h2">Categories of Data Subjects</span>
                </div>
                <LegalList items={[
                    { text: 'Employees.' },
                    { text: 'Communication partners.' },
                    { text: 'Users.' },
                    { text: 'Third parties.' },
                    { text: 'Whistleblowers.' },
                ]} />
                <div className="text-section">
                    <span className="legal-h2">Purposes of Processing</span>
                </div>
                <LegalList items={[
                    { text: 'Provision of contractual services and fulfilment of contractual obligations.' },
                    { text: 'Communication.' },
                    { text: 'Security measures.' },
                    { text: 'Reach measurement.' },
                    { text: 'Organisational and administrative procedures.' },
                    { text: 'Feedback.' },
                    { text: 'Profiles containing user-related information.' },
                    { text: 'Provision of our online offering and user-friendliness.' },
                    { text: 'Information technology infrastructure.' },
                    { text: 'Whistleblower protection.' },
                ]} />
            </section>
            <section className="section" id="m2427">
                <div className="text-section">
                    <span className="legal-h1">Applicable Legal Bases</span>
                </div>
                <div className="text-section">
                    <strong>National data protection regulations in Germany: </strong>
                    In addition to the data protection provisions of the GDPR, national data protection
                    regulations apply in Germany. These include, in particular, the Act on Protection against
                    Misuse of Personal Data in Data Processing (Federal Data Protection Act - BDSG). The BDSG
                    contains, in particular, specific provisions on the right of access, the right to erasure,
                    the right to object, the processing of special categories of personal data, processing for
                    other purposes, transmission, and automated individual decision-making including profiling.
                    The data protection laws of the individual German federal states may also apply.
                </div>
                <div className="text-section">
                    <strong>Note on the applicability of the GDPR and the Swiss FADP: </strong>
                    These data protection notices serve both to provide information pursuant to the Swiss
                    Federal Act on Data Protection (FADP) and pursuant to the General Data Protection
                    Regulation (GDPR). For this reason, please note that the terminology of the GDPR is used
                    due to its broader geographical scope and comprehensibility. In particular, instead of the
                    terms used in the Swiss FADP - "processing" of "personal data", "overriding interest" and
                    "particularly sensitive personal data" - the GDPR terms "processing" of "personal data",
                    "legitimate interest" and "special categories of data" are used. The legal meaning of the
                    terms, however, continues to be determined in accordance with the Swiss FADP where that
                    Act applies.
                </div>
                <div className="text-section">
                    <strong>Applicability of data protection requirements in the country of domicile: </strong>
                    In the country in which the controller is domiciled, national data protection provisions
                    apply in addition to the General Data Protection Regulation (GDPR).
                </div>
            </section>
            <section className="section" id="m27">
                <div className="text-section">
                    <span className="legal-h1">Security Measures</span>
                </div>
                <div className="text-section">
                    We implement appropriate technical and organisational measures in accordance with the
                    applicable legal requirements, taking into account the state of the art, the costs of
                    implementation, and the nature, scope, circumstances and purposes of the processing, as
                    well as the varying likelihood and severity of the risk to the rights and freedoms of
                    natural persons, in order to ensure a level of protection appropriate to the risk.
                </div>
                <div className="text-section">
                    These measures include, in particular, ensuring the confidentiality, integrity and
                    availability of data by controlling physical and electronic access to the data, as well as
                    access to, input of, disclosure of, assurance of availability of, and segregation of such
                    data. Furthermore, we have established procedures to ensure the exercise of data subjects'
                    rights, the erasure of data, and responses to data security threats. We also take the
                    protection of personal data into account during the development and selection of hardware,
                    software and processes, in accordance with the principle of data protection by design and
                    by default.
                </div>
                <div className="text-section">
                    <strong>Securing online connections via TLS/SSL encryption technology (HTTPS): </strong>
                    In order to protect the data of users transmitted via our online services from unauthorised
                    access, we employ TLS/SSL encryption technology. Secure Sockets Layer (SSL) and Transport
                    Layer Security (TLS) are the cornerstones of secure data transmission on the internet.
                    These technologies encrypt the information transmitted between the website or app and the
                    user's browser (or between two servers), thereby protecting the data from unauthorised
                    access. TLS, as the more advanced and secure version of SSL, ensures that all data
                    transmissions comply with the highest security standards. When a website is secured by an
                    SSL/TLS certificate, this is indicated by the display of HTTPS in the URL, serving as an
                    indicator to users that their data is being transmitted securely and in encrypted form.
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
                    third-party services or disclosing or transferring data to other persons, entities or
                    companies, this is done exclusively in accordance with the applicable legal requirements.
                </div>
                <div className="text-section">
                    For data transfers to the United States, we rely primarily on the Data Privacy Framework
                    (DPF), which was recognised as a secure legal framework by an adequacy decision of the
                    European Commission dated 10 July 2023. In addition, we have concluded Standard
                    Contractual Clauses with the respective providers in accordance with the requirements of
                    the European Commission, which establish contractual obligations for the protection of your
                    data.
                </div>
                <div className="text-section">
                    This dual safeguard ensures comprehensive protection of your data: the DPF constitutes the
                    primary level of protection, while the Standard Contractual Clauses serve as an additional
                    safeguard. Should changes arise within the DPF framework, the Standard Contractual Clauses
                    will operate as a reliable fallback mechanism, ensuring that your data remains adequately
                    protected at all times, even in the event of political or legal developments.
                </div>
                <div className="text-section">
                    For individual service providers, we will inform you as to whether they are certified
                    under the DPF and whether Standard Contractual Clauses have been concluded. Further
                    information on the DPF and a list of certified companies can be found on the website of
                    the U.S. Department of Commerce at{' '}
                    <Linkout item="https://www.dataprivacyframework.gov/" type="external" className="linkout nodecoration" target="_blank">
                        https://www.dataprivacyframework.gov/
                    </Linkout>.
                </div>
                <div className="text-section">
                    For data transfers to other third countries, corresponding safeguards apply, in particular
                    Standard Contractual Clauses, explicit consent, or legally required transfers. Information
                    on third-country transfers and applicable adequacy decisions can be obtained from the
                    European Commission's information portal:{' '}
                    <Linkout item="https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection_en" type="external" className="linkout nodecoration" target="_blank">
                        https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection_en
                    </Linkout>.
                </div>
            </section>
            <section className="section" id="m12">
                <div className="text-section">
                    <span className="legal-h1">General Information on Data Retention and Erasure</span>
                </div>
                <div className="text-section">
                    We erase personal data that we process in accordance with the applicable statutory
                    provisions as soon as the underlying consents are revoked or no further legal grounds for
                    the processing exist. This applies to cases in which the original purpose of the
                    processing ceases to apply or the data is no longer required. Exceptions to this rule
                    exist where statutory obligations or special interests require a longer period of retention
                    or archiving.
                </div>
                <div className="text-section">
                    In particular, data that must be retained for commercial or tax law reasons, or whose
                    storage is necessary for the purposes of legal prosecution or the protection of the rights
                    of other natural or legal persons, must be archived accordingly.
                </div>
                <div className="text-section">
                    Our data protection notices contain additional information on the retention and erasure of
                    data that apply specifically to certain processing activities.
                </div>
                <div className="text-section">
                    Where multiple retention periods or erasure deadlines are specified for a given item of
                    data, the longest period shall always prevail. Data that is no longer retained for the
                    purpose for which it was originally collected but is retained solely due to statutory
                    requirements or other reasons shall be processed exclusively for the reasons justifying
                    its retention.
                </div>
                <div className="text-section">
                    <strong>Commencement of retention periods at the end of the calendar year: </strong>
                    Where a retention period does not expressly commence on a specific date and amounts to at
                    least one year, it shall automatically begin at the end of the calendar year in which the
                    event triggering the retention period occurred. In the case of ongoing contractual
                    relationships in the context of which data is stored, the triggering event shall be the
                    effective date of termination or other conclusion of the legal relationship.
                </div>
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
                        text: 'You have the right to object at any time, on grounds relating to your particular situation, to the processing of personal data concerning you which is carried out on the basis of Art. 6(1)(e) or (f) GDPR; this also applies to profiling based on those provisions. Where personal data concerning you is processed for direct marketing purposes, you have the right to object at any time to the processing of such data for the purposes of such marketing, including profiling to the extent that it is related to such direct marketing.',
                    },
                    {
                        label: 'Right to withdraw consent',
                        text: 'You have the right to withdraw any consent you have given at any time.',
                    },
                    {
                        label: 'Right of access',
                        text: 'You have the right to obtain confirmation as to whether data concerning you is being processed, and to receive information about such data as well as further details and a copy of the data, in accordance with the applicable legal provisions.',
                    },
                    {
                        label: 'Right to rectification',
                        text: 'In accordance with the applicable legal provisions, you have the right to request the completion of data concerning you or the rectification of inaccurate data concerning you.',
                    },
                    {
                        label: 'Right to erasure and restriction of processing',
                        text: 'In accordance with the applicable legal provisions, you have the right to request that data concerning you be erased without undue delay, or alternatively to request the restriction of the processing of such data.',
                    },
                    {
                        label: 'Right to data portability',
                        text: 'You have the right to receive personal data concerning you that you have provided to us in a structured, commonly used and machine-readable format, or to request its transmission to another controller, in accordance with the applicable legal provisions.',
                    },
                    {
                        label: 'Right to lodge a complaint with a supervisory authority',
                        text: 'Without prejudice to any other administrative or judicial remedy, you have the right to lodge a complaint with a supervisory authority, in particular in the Member State of your habitual residence, place of work or place of the alleged infringement, if you consider that the processing of personal data relating to you infringes the provisions of the GDPR.',
                    },
                ]} />
            </section>
            <section className="section" id="m225">
                <div className="text-section">
                    <span className="legal-h1">Provision of the Online Offering and Web Hosting</span>
                </div>
                <div className="text-section">
                    We process user data in order to provide our online services. For this purpose, we process
                    the user's IP address, which is necessary to transmit the contents and functions of our
                    online services to the user's browser or end device.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Usage data (e.g. pages visited and time spent, click paths, intensity and frequency of use, types of devices and operating systems used, interactions with content and functions); meta, communication and procedural data (e.g. IP addresses, timestamps, identification numbers, persons involved); log data (e.g. log files relating to logins, retrieval of data or access times).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Users (e.g. website visitors, users of online services).',
                    },
                    {
                        label: 'Purposes of processing and legitimate interests',
                        text: 'Provision of our online offering and user-friendliness; information technology infrastructure (operation and provision of information systems and technical devices (computers, servers, etc.)); security measures.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the information set out in the section "General Information on Data Retention and Erasure".',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Legitimate interests (Art. 6(1)(f) GDPR).',
                    },
                ]} />
                <div className="text-section">
                    <strong>Further information on processing activities, procedures and services:</strong>
                </div>
                <LegalList items={[
                    {
                        label: 'Provision of the online offering on leased server space',
                        text: 'For the provision of our online offering, we use server space, computing capacity and software that we lease or otherwise obtain from a server provider (also referred to as a "web host"). Legal bases: Legitimate interests (Art. 6(1)(f) GDPR).',
                    },
                    {
                        label: 'Collection of access data and log files',
                        text: 'Access to our online offering is logged in the form of "server log files". These log files may include the address and name of the web pages and files accessed, the date and time of access, the volume of data transferred, a report on successful retrieval, the browser type and version, the operating system of the user, the referrer URL (the previously visited page) and, as a general rule, IP addresses and the requesting provider. Server log files may be used for security purposes (e.g. to prevent server overload, in particular in the event of abusive attacks such as DDoS attacks) and to ensure server utilisation and stability. Legal bases: Legitimate interests (Art. 6(1)(f) GDPR). Erasure of data: Log file information is stored for a maximum period of 30 days and then erased or anonymised. Data whose further retention is required for evidentiary purposes is exempt from erasure until the final resolution of the relevant incident.',
                    },
                    {
                        label: 'Content Delivery Network',
                        text: 'We use a Content Delivery Network (CDN). A CDN is a service that enables the content of an online offering - in particular large media files such as graphics or programme scripts - to be delivered more quickly and securely with the aid of regionally distributed servers connected via the internet. Legal bases: Legitimate interests (Art. 6(1)(f) GDPR).',
                    },
                    {
                        label: 'netcup',
                        text: (
                        <>
                            Services in the area of providing information technology infrastructure and related services (e.g. storage space and/or computing capacity). Service provider: netcup GmbH, Daimlerstraße 25, D-76185 Karlsruhe, Germany. Legal bases: Legitimate interests (Art. 6(1)(f) GDPR). Website:{' '}
                            <Linkout item="https://www.netcup.de/" type="external" className="linkout nodecoration" target="_blank">
                            https://www.netcup.de/
                            </Linkout>
                            . Privacy policy:{' '}
                            <Linkout item="https://www.netcup.de/kontakt/datenschutzerklaerung.php" type="external" className="linkout nodecoration" target="_blank">
                            https://www.netcup.de/kontakt/datenschutzerklaerung.php
                            </Linkout>
                            . Data processing agreement:{' '}
                            <Linkout item="https://helpcenter.netcup.de/de/wiki/general/avv/" type="external" className="linkout nodecoration" target="_blank">
                            https://helpcenter.netcup.de/de/wiki/general/avv/
                            </Linkout>
                            .
                        </>
                        ),
                    },
                    ]} />
            </section>
            <section className="section" id="m134">
                <div className="text-section">
                    <span className="legal-h1">Use of Cookies</span>
                </div>
                <div className="text-section">
                    The term "cookies" refers to functions that store and retrieve information on users' end
                    devices. Cookies may be used for various purposes, including ensuring the functionality,
                    security and convenience of online offerings, as well as the analysis of visitor traffic.
                    We use cookies in accordance with the applicable legal provisions. Where required, we
                    obtain prior consent from users. Where consent is not necessary, we rely on our legitimate
                    interests. This applies where the storage and retrieval of information is essential in
                    order to provide content and functions that have been expressly requested - including the
                    storage of settings and the assurance of the functionality and security of our online
                    offering. Consent may be withdrawn at any time. We clearly inform users of the scope of
                    cookie use and which cookies are employed.
                </div>
                <div className="text-section">
                    <strong>Notes on legal bases: </strong>
                    Whether we process personal data using cookies depends on whether consent has been
                    obtained. Where consent has been given, it serves as the legal basis for processing.
                    Without consent, we rely on our legitimate interests, which are described above in this
                    section and in the context of the relevant services and procedures.
                </div>
                <div className="text-section">
                    <strong>Retention periods: </strong>
                    With regard to retention periods, the following types of cookies are distinguished:
                </div>
                <LegalList items={[
                    {
                        label: 'Temporary cookies (session cookies)',
                        text: 'Temporary cookies are erased at the latest once a user has left an online offering and closed their end device (e.g. browser or mobile application).',
                    },
                    {
                        label: 'Permanent cookies',
                        text: 'Permanent cookies remain stored even after the end device has been closed. For example, they may be used to save the login status or to display preferred content directly when the user revisits a website. Similarly, user data collected via cookies may be used for reach measurement. Unless we provide users with explicit information about the type and duration of cookies (e.g. when obtaining consent), users should assume that cookies are permanent and that the retention period may be up to two years.',
                    },
                ]} />
                <div className="text-section">
                    <strong>General notes on withdrawal and objection (opt-out): </strong>
                    Users may withdraw any consent they have given at any time and may also object to
                    processing in accordance with the applicable legal provisions, including via the privacy
                    settings of their browser.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Meta, communication and procedural data (e.g. IP addresses, timestamps, identification numbers, persons involved).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Users (e.g. website visitors, users of online services).',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Legitimate interests (Art. 6(1)(f) GDPR); consent (Art. 6(1)(a) GDPR).',
                    },
                ]} />
                <div className="text-section">
                    <strong>Further information on processing activities, procedures and services:</strong>
                </div>
                <LegalList items={[
                    {
                        label: 'Processing of cookie data on the basis of consent',
                        text: 'We use a consent management solution through which users\' consent to the use of cookies or to the procedures and providers referred to in the consent management solution is obtained. This procedure is used to collect, log, manage and revoke consents, in particular with regard to the use of cookies and comparable technologies employed to store, read and process information on users\' end devices. As part of this procedure, users\' consents are obtained for the use of cookies and the associated processing of information, including the specific processing activities and providers named in the consent management procedure. Users also have the opportunity to manage and revoke their consents. Consent declarations are stored in order to avoid the need for repeated requests and to provide evidence of consent in accordance with the applicable statutory requirements. Storage is carried out server-side and/or in a cookie (known as an opt-in cookie) or using comparable technologies, in order to attribute consent to a specific user or their device. Unless specific information on the providers of consent management services is available, the following general information applies: the consent is stored for a period of up to two years. A pseudonymous user identifier is created and stored together with the time of consent, the details of the scope of consent (e.g. the categories of cookies and/or service providers concerned), and information about the browser, system and end device used. Legal bases: Consent (Art. 6(1)(a) GDPR).',
                    },
                ]} />
            </section>
            <section className="section" id="m367">
                <div className="text-section">
                    <span className="legal-h1">Registration, Login and User Account</span>
                </div>
                <div className="text-section">
                    Users may create a user account. During the registration process, users are informed of
                    the mandatory data required and such data is processed for the purpose of providing the
                    user account on the basis of the fulfilment of contractual obligations. The data
                    processed includes, in particular, login information (username, password and an e-mail
                    address).
                </div>
                <div className="text-section">
                    In the context of the use of our registration and login functions and of the user account,
                    we store the IP address and the time of each user action. Storage is carried out on the
                    basis of our legitimate interests and those of users in protection against misuse and
                    other unauthorised use. As a general rule, this data is not disclosed to third parties
                    unless such disclosure is necessary to pursue our claims or there is a statutory
                    obligation to do so.
                </div>
                <div className="text-section">
                    Users may be informed by e-mail of events relevant to their user account, such as
                    technical changes.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Master data (e.g. full name, residential address, contact information, customer number, etc.); contact data (e.g. postal and e-mail addresses or telephone numbers); content data (e.g. textual or visual messages and contributions and the information relating to them, such as details of authorship or the time of creation); usage data (e.g. pages visited and time spent, click paths, intensity and frequency of use, types of devices and operating systems used, interactions with content and functions); log data (e.g. log files relating to logins, retrieval of data or access times).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Users (e.g. website visitors, users of online services).',
                    },
                    {
                        label: 'Purposes of processing and legitimate interests',
                        text: 'Provision of contractual services and fulfilment of contractual obligations; security measures; organisational and administrative procedures; provision of our online offering and user-friendliness.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the information set out in the section "General Information on Data Retention and Erasure". Erasure upon termination of account.',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR); legitimate interests (Art. 6(1)(f) GDPR).',
                    },
                ]} />
                <div className="text-section">
                    <strong>Further information on processing activities, procedures and services:</strong>
                </div>
                <LegalList items={[
                    {
                        label: 'Registration using pseudonyms',
                        text: 'Users may use pseudonyms as usernames instead of their real names. Legal bases: Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR).',
                    },
                    {
                        label: 'User profiles are not publicly visible',
                        text: 'User profiles are not publicly visible or accessible.',
                    },
                    {
                        label: 'Two-factor authentication',
                        text: 'Two-factor authentication provides an additional layer of security for your user account and ensures that only you can access your account, even if someone else knows your password. For this purpose, you are required to perform an additional authentication step in addition to entering your password (e.g. entering a code sent to a mobile device). We will inform you of the procedure we use. Legal bases: Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR).',
                    },
                    {
                        label: 'Erasure of data upon termination of account',
                        text: 'If users have terminated their user account, their data relating to the account will be erased, subject to any statutory permission, obligation or consent of the user. Legal bases: Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR).',
                    },
                    {
                        label: 'No obligation to retain data',
                        text: 'It is the responsibility of users to back up their data prior to the expiry of the contract upon termination. We are entitled to irreversibly erase all data stored during the term of the contract. Legal bases: Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR).',
                    },
                ]} />
            </section>
            <section className="section" id="m182">
                <div className="text-section">
                    <span className="legal-h1">Contact and Enquiry Management</span>
                </div>
                <div className="text-section">
                    When you contact us (e.g. by post, contact form, e-mail, telephone or via social media)
                    and in the context of existing user and business relationships, the information provided
                    by the enquiring parties is processed to the extent necessary to respond to the contact
                    enquiries and any requested measures.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Contact data (e.g. postal and e-mail addresses or telephone numbers); content data (e.g. textual or visual messages and contributions and the information relating to them, such as details of authorship or the time of creation); meta, communication and procedural data (e.g. IP addresses, timestamps, identification numbers, persons involved).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Communication partners.',
                    },
                    {
                        label: 'Purposes of processing and legitimate interests',
                        text: 'Communication; organisational and administrative procedures; feedback (e.g. collecting feedback via online forms); provision of our online offering and user-friendliness.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the information set out in the section "General Information on Data Retention and Erasure".',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Legitimate interests (Art. 6(1)(f) GDPR); performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR).',
                    },
                ]} />
                <div className="text-section">
                    <strong>Further information on processing activities, procedures and services:</strong>
                </div>
                <LegalList items={[
                    {
                        label: 'Contact form',
                        text: 'When contact is made via our contact form, by e-mail or other means of communication, we process the personal data transmitted to us in order to respond to and handle the relevant enquiry. This generally includes information such as name, contact details and, where applicable, further information provided to us that is required for appropriate handling. We use this data solely for the stated purpose of responding to and communicating in connection with the enquiry. Legal bases: Performance of a contract and pre-contractual enquiries (Art. 6(1)(b) GDPR); legitimate interests (Art. 6(1)(f) GDPR).',
                    },
                ]} />
            </section>
            <section className="section" id="m263">
                <div className="text-section">
                    <span className="legal-h1">Web Analytics, Monitoring and Optimisation</span>
                </div>
                <div className="text-section">
                    Web analytics (also referred to as "reach measurement") is used to evaluate the flow of
                    visitors to our online offering and may encompass behaviour, interests or demographic
                    information relating to visitors, such as age or gender, in pseudonymous form. Using reach
                    analysis, we can, for example, identify at what time our online offering or its functions
                    or content are most frequently used, or which areas require optimisation.
                </div>
                <div className="text-section">
                    In addition to web analytics, we may also use testing procedures in order to test and
                    optimise different versions of our online offering or its components.
                </div>
                <div className="text-section">
                    Unless otherwise indicated below, profiles (i.e. data aggregated in relation to a usage
                    process) may be created for these purposes, and information may be stored in and retrieved
                    from a browser or end device. The data collected includes, in particular, websites visited
                    and elements used thereon, as well as technical information such as the browser used, the
                    computer system and details of usage times. Where users have consented to the collection
                    of their location data, such data may also be processed.
                </div>
                <div className="text-section">
                    In addition, IP addresses of users are stored. However, we employ an IP masking procedure
                    (i.e. pseudonymisation by truncating the IP address) to protect users. In general, within
                    the context of web analytics, A/B testing and optimisation, no clear-text data of users
                    (such as e-mail addresses or names) is stored; instead, pseudonyms are used. This means
                    that neither we nor the providers of the software used are aware of the actual identity of
                    users, but only of the information stored in their profiles for the purposes of the
                    respective procedures.
                </div>
                <div className="text-section">
                    <strong>Notes on legal bases: </strong>
                    Where we request users' consent to the use of third-party providers, the legal basis for
                    data processing is the consent given. Otherwise, user data is processed on the basis of
                    our legitimate interests (i.e. our interest in efficient, cost-effective and
                    recipient-friendly services). In this context, we also draw your attention to the
                    information on the use of cookies in this Privacy Policy.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Usage data (e.g. pages visited and time spent, click paths, intensity and frequency of use, types of devices and operating systems used, interactions with content and functions); meta, communication and procedural data (e.g. IP addresses, timestamps, identification numbers, persons involved).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Users (e.g. website visitors, users of online services).',
                    },
                    {
                        label: 'Purposes of processing and legitimate interests',
                        text: 'Reach measurement (e.g. access statistics, recognition of returning visitors); profiles containing user-related information (creation of user profiles); provision of our online offering and user-friendliness.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the information set out in the section "General Information on Data Retention and Erasure". Storage of cookies of up to 2 years (unless otherwise stated, cookies and similar storage methods may be stored on users\' devices for a period of up to two years).',
                    },
                    {
                        label: 'Security measures',
                        text: 'IP masking (pseudonymisation of the IP address).',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Consent (Art. 6(1)(a) GDPR); legitimate interests (Art. 6(1)(f) GDPR).',
                    },
                ]} />
                <div className="text-section">
                    <strong>Further information on processing activities, procedures and services:</strong>
                </div>
                <LegalList items={[
                    {
                        label: 'Google Analytics',
                        text: (
                        <>
                            We use Google Analytics to measure and analyse the use of our online offering on the basis of a pseudonymous user identification number. This identification number does not contain any unique data such as names or e-mail addresses. It is used to assign analytical information to an end device in order to identify which content users have accessed during one or more usage sessions, which search terms they have used, whether they have accessed the content again, or have interacted with our online offering. The time of use and its duration are also stored, as are the sources of users who refer to our online offering and technical aspects of their end devices and browsers. Pseudonymous profiles of users are created from information relating to the use of various devices, and cookies may be used in this context. Google Analytics does not log or store individual IP addresses for EU users. However, Analytics provides approximate geographic location data by deriving the following metadata from IP addresses: city (and the derived latitude and longitude of the city), continent, country, region and subcontinent (and ID-based counterparts). For EU traffic, IP address data is used exclusively for this derivation of geolocation data before being immediately deleted. It is not logged, is not accessible and is not used for any further purposes. When Google Analytics collects measurement data, all IP queries are carried out on EU-based servers before traffic is forwarded to Analytics servers for processing. Service provider: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland. Legal bases: Consent (Art. 6(1)(a) GDPR). Website:{' '}
                            <Linkout item="https://marketingplatform.google.com/about/analytics/" type="external" className="linkout nodecoration" target="_blank">
                            https://marketingplatform.google.com/about/analytics/
                            </Linkout>
                            . Security measures: IP masking (pseudonymisation of the IP address). Privacy policy:{' '}
                            <Linkout item="https://policies.google.com/privacy" type="external" className="linkout nodecoration" target="_blank">
                            https://policies.google.com/privacy
                            </Linkout>
                            . Data processing agreement:{' '}
                            <Linkout item="https://business.safety.google/adsprocessorterms/" type="external" className="linkout nodecoration" target="_blank">
                            https://business.safety.google/adsprocessorterms/
                            </Linkout>
                            . Basis for third-country transfers: Data Privacy Framework (DPF), Standard Contractual Clauses ({' '}
                            <Linkout item="https://business.safety.google/adsprocessorterms" type="external" className="linkout nodecoration" target="_blank">
                            https://business.safety.google/adsprocessorterms
                            </Linkout>
                            ). Opt-out option: Opt-out plug-in:{' '}
                            <Linkout item="https://tools.google.com/dlpage/gaoptout" type="external" className="linkout nodecoration" target="_blank">
                            https://tools.google.com/dlpage/gaoptout
                            </Linkout>
                            , settings for the display of advertisements:{' '}
                            <Linkout item="https://myadcenter.google.com/personalizationoff" type="external" className="linkout nodecoration" target="_blank">
                            https://myadcenter.google.com/personalizationoff
                            </Linkout>
                            . Further information:{' '}
                            <Linkout item="https://business.safety.google/adsservices/" type="external" className="linkout nodecoration" target="_blank">
                            https://business.safety.google/adsservices/
                            </Linkout>
                            .
                        </>
                        ),
                    },
                    {
                        label: 'Google Tag Manager',
                        text: (
                        <>
                            We use Google Tag Manager, software developed by Google that enables us to manage website tags centrally via a user interface. Tags are small code elements on our website that serve to record and analyse visitor activity. This technology assists us in improving our website and the content offered thereon. Google Tag Manager does not itself create user profiles, store cookies containing user profiles or carry out independent analyses. Its function is limited to facilitating and streamlining the integration and management of the tools and services we use on our website. Nevertheless, when Google Tag Manager is used, the IP address of users is transmitted to Google, which is technically necessary to implement the services we use, and cookies may be set. However, this data processing only occurs where services are integrated via the Tag Manager. For more detailed information on these services and their data processing, please refer to the relevant sections of this Privacy Policy. Service provider: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland. Legal bases: Consent (Art. 6(1)(a) GDPR). Website:{' '}
                            <Linkout item="https://marketingplatform.google.com" type="external" className="linkout nodecoration" target="_blank">
                            https://marketingplatform.google.com
                            </Linkout>
                            . Privacy policy:{' '}
                            <Linkout item="https://policies.google.com/privacy" type="external" className="linkout nodecoration" target="_blank">
                            https://policies.google.com/privacy
                            </Linkout>
                            . Data processing agreement:{' '}
                            <Linkout item="https://business.safety.google/adsprocessorterms" type="external" className="linkout nodecoration" target="_blank">
                            https://business.safety.google/adsprocessorterms
                            </Linkout>
                            . Basis for third-country transfers: Data Privacy Framework (DPF), Standard Contractual Clauses ({' '}
                            <Linkout item="https://business.safety.google/adsprocessorterms" type="external" className="linkout nodecoration" target="_blank">
                            https://business.safety.google/adsprocessorterms
                            </Linkout>
                            ).
                        </>
                        ),
                    },
                ]} />
            </section>
            <section className="section" id="m2324">
                <div className="text-section">
                    <span className="legal-h1">Data Protection Information for Whistleblowers</span>
                </div>
                <div className="text-section">
                    This section provides information on how we handle data relating to persons who submit
                    reports (whistleblowers), as well as data relating to affected and involved parties in the
                    context of our whistleblower procedure. Our aim is to provide an uncomplicated and secure
                    reporting channel.
                </div>
                <div className="text-section">
                    <strong>Legal bases (Germany): </strong>
                    Where we process data to fulfil our statutory obligations pursuant to the Whistleblower
                    Protection Act (HinSchG), the legal basis for processing is Art. 6(1)(c) GDPR and, in the
                    case of special categories of personal data, Art. 9(2)(g) GDPR, § 22 BDSG, each in
                    conjunction with § 10 HinSchG. This relates to the obligation to establish and operate an
                    internal whistleblower reporting office, the fulfilment of its statutory tasks, and, where
                    data collected in the reporting procedure is used, the implementation of further measures.
                </div>
                <div className="text-section">
                    <strong>Types of data processed: </strong>
                    In the context of receiving and processing reports and in the subsequent whistleblower
                    procedure, we may collect various categories of data. These include, in particular, data
                    provided by a whistleblower, such as: name, contact details and location of the person
                    submitting the report; names and data relating to potential witnesses or persons affected
                    by the report; names and data relating to the persons against whom the report is directed;
                    data concerning the alleged misconduct; and further relevant details, where provided.
                </div>
                <div className="text-section">
                    <strong>Special categories of personal data: </strong>
                    It may be necessary for us to collect special categories of personal data in the course of
                    our activities, in particular where such data is disclosed by a whistleblower. These
                    include health-related data and data concerning racial or ethnic origin.
                </div>
                <div className="text-section">
                    <strong>Use of our online forms: </strong>
                    Please note that it is possible to submit reports anonymously. In order to ensure the
                    security of your data when using our online forms, we recommend accessing them in the
                    "incognito mode" of your browser. You may open an incognito window as follows:
                </div>
                <LegalEnumeration items={[
                    { index: 'a)', text: 'On a Windows PC: open your browser and press Ctrl+Shift+N.' },
                    { index: 'b)', text: 'On a Mac: open your browser and press Command+Shift+N.' },
                    { index: 'c)', text: 'On mobile devices: switch to private mode via the tab menu.' },
                ]} />
                <div className="text-section">
                    <strong>Provision of name: </strong>
                    You have the option of submitting reports anonymously. Unless prohibited by national
                    legislation, however, we recommend that you provide your name and contact details. This
                    enables us to follow up the report more effectively and, where necessary, to contact you
                    directly. If you provide your name and contact details, your identity will be treated in
                    strict confidence.
                </div>
                <div className="text-section">
                    <strong>Disclosure of data to third parties: </strong>
                    Data relating to submitted reports will only be disclosed to third parties under certain
                    circumstances, namely: (a) where you have given us your express consent to do so, or (b)
                    where there is a statutory obligation to disclose the data. Potential third parties include
                    public authorities, governmental, regulatory or tax authorities where disclosure is
                    necessary to comply with a statutory or regulatory obligation. Furthermore, in accordance
                    with the applicable legal provisions, we may engage lawyers and other professional
                    advisers who are authorised to investigate alleged misconduct and to take the necessary
                    steps following an investigation, such as initiating disciplinary or legal proceedings.
                    In addition, carefully selected and supervised service providers (e.g. operators of
                    web-based reporting systems) may receive data for these purposes. However, such service
                    providers are contractually obliged to comply with the applicable data protection
                    provisions within the framework of a data processing agreement.
                </div>
                <div className="text-section">
                    <strong>Data retention and erasure: </strong>
                    Personal data is processed only for as long as is necessary to fulfil the processing
                    purposes described above. Where such data is no longer required for the stated purposes,
                    it will be erased. In certain situations, longer retention periods may apply by virtue of
                    statutory obligations.
                </div>
                <div className="text-section">
                    <strong>Technical and organisational measures: </strong>
                    We have implemented the necessary contractual, technical and organisational measures to
                    ensure the security of all data processed by us. Such data is processed exclusively for
                    the defined purposes. Incoming reports are processed exclusively by authorised personnel.
                </div>
                <LegalList items={[
                    {
                        label: 'Types of data processed',
                        text: 'Master data (e.g. full name, residential address, contact information, customer number, etc.); employee data (information on employees and other persons in an employment relationship); contact data (e.g. postal and e-mail addresses or telephone numbers); content data (e.g. textual or visual messages and contributions and the information relating to them, such as details of authorship or the time of creation); usage data (e.g. pages visited and time spent, click paths, intensity and frequency of use, types of devices and operating systems used, interactions with content and functions).',
                    },
                    {
                        label: 'Data subjects',
                        text: 'Employees (e.g. members of staff, applicants, temporary workers and other personnel); third parties; whistleblowers.',
                    },
                    {
                        label: 'Purposes of processing and legitimate interests',
                        text: 'Whistleblower protection.',
                    },
                    {
                        label: 'Retention and erasure',
                        text: 'Erasure in accordance with the information set out in the section "General Information on Data Retention and Erasure".',
                    },
                    {
                        label: 'Legal bases',
                        text: 'Consent (Art. 6(1)(a) GDPR); legal obligation (Art. 6(1)(c) GDPR); legitimate interests (Art. 6(1)(f) GDPR).',
                    },
                ]} />
            </section>
            <section className="section" id="m15">
                <div className="text-section">
                    <span className="legal-h1">Changes and Updates</span>
                </div>
                <div className="text-section">
                    We request that you familiarise yourself regularly with the content of our Privacy Policy.
                    We revise the Privacy Policy as soon as changes to the data processing activities carried
                    out by us make this necessary. We will notify you as soon as changes require an action on
                    your part (e.g. consent) or any other form of individual notification.
                </div>
                <div className="text-section">
                    Where addresses and contact details of companies and organisations are provided in this
                    Privacy Policy, please note that such details may change over time and we recommend that
                    you verify the information before making contact.
                </div>
            </section>
            <section className="section" id="m42">
                <div className="text-section">
                    <span className="legal-h1">Definitions</span>
                </div>
                <div className="text-section">
                    This section provides an overview of the terms used in this Privacy Policy. Where terms
                    are defined by law, the statutory definitions apply. The following explanations are
                    intended primarily to aid understanding.
                </div>
                <LegalList items={[
                    {
                        label: 'Employees',
                        text: 'Employees are persons in an employment relationship, whether as workers, salaried employees or in similar positions. An employment relationship is a legal relationship between an employer and an employee established by an employment contract or agreement. It encompasses the employer\'s obligation to remunerate the employee and the employee\'s obligation to perform work. An employment relationship encompasses various phases, including its establishment (when the employment contract is concluded), its performance (when the employee carries out their work), and its termination (when the employment relationship ends, whether by notice, a termination agreement or otherwise). Employee data comprises all information relating to such persons in the context of their employment, including personal identification data, identification numbers, salary and banking data, working hours, holiday entitlements, health data and performance appraisals.',
                    },
                    {
                        label: 'Master data',
                        text: 'Master data encompasses essential information required for the identification and administration of contractual partners, user accounts, profiles and similar assignments. Such data may include personal and demographic details such as names, contact information (addresses, telephone numbers, e-mail addresses), dates of birth and specific identifiers (user IDs). Master data forms the basis of any formal interaction between individuals and services, institutions or systems by enabling unambiguous assignment and communication.',
                    },
                    {
                        label: 'Content data',
                        text: 'Content data encompasses information generated in the course of creating, editing and publishing content of all kinds. This category of data may include texts, images, videos, audio files and other multimedia content published on various platforms and media. Content data is not limited to the actual content itself but also includes metadata providing information about the content, such as tags, descriptions, author information and publication dates.',
                    },
                    {
                        label: 'Contact data',
                        text: 'Contact data constitutes essential information enabling communication with individuals or organisations. It includes, among other things, telephone numbers, postal addresses and e-mail addresses, as well as means of communication such as social media handles and instant messaging identifiers.',
                    },
                    {
                        label: 'Meta, communication and procedural data',
                        text: 'Meta, communication and procedural data are categories containing information about the manner in which data is processed, transmitted and managed. Metadata, also known as data about data, encompasses information describing the context, origin and structure of other data. It may include details such as file size, creation date, the author of a document and revision histories. Communication data captures the exchange of information between users across various channels, including e-mail correspondence, call logs, messages on social networks and chat histories, including the parties involved, timestamps and transmission routes. Procedural data describes the processes and workflows within systems or organisations, including workflow documentation, records of transactions and activities, and audit logs used to track and verify processes.',
                    },
                    {
                        label: 'Usage data',
                        text: 'Usage data refers to information capturing how users interact with digital products, services or platforms. Such data encompasses a wide range of information showing how users use applications, which features they prefer, how long they spend on particular pages and the paths they navigate through an application. Usage data may also include frequency of use, timestamps of activities, IP addresses, device information and location data. It is particularly valuable for analysing user behaviour, optimising user experiences, personalising content and improving products or services. In addition, usage data plays a crucial role in identifying trends, preferences and potential areas for improvement within digital offerings.',
                    },
                    {
                        label: 'Personal data',
                        text: '"Personal data" means any information relating to an identified or identifiable natural person (hereinafter "data subject"); an identifiable natural person is one who can be identified, directly or indirectly, in particular by reference to an identifier such as a name, an identification number, location data, an online identifier (e.g. a cookie) or one or more factors specific to the physical, physiological, genetic, mental, economic, cultural or social identity of that natural person.',
                    },
                    {
                        label: 'Profiles containing user-related information',
                        text: 'The processing of "profiles containing user-related information", or "profiles" for short, encompasses any form of automated processing of personal data which consists in using such personal data to evaluate certain personal aspects relating to a natural person (depending on the type of profiling, this may include various types of information concerning demographics, behaviour and interests, such as interaction with websites and their content, etc.), to analyse or predict them (e.g. interests in certain content or products, click behaviour on a website or location). Cookies and web beacons are frequently used for profiling purposes.',
                    },
                    {
                        label: 'Log data',
                        text: 'Log data is information about events or activities that have been logged in a system or network. Such data typically includes information such as timestamps, IP addresses, user actions, error messages and other details relating to the use or operation of a system. Log data is frequently used to analyse system problems, for security monitoring or to produce performance reports.',
                    },
                    {
                        label: 'Reach measurement',
                        text: 'Reach measurement (also referred to as web analytics) is used to evaluate the flow of visitors to an online offering and may encompass visitor behaviour or interests in relation to certain information, such as website content. Using reach analysis, operators of online offerings can, for example, identify at what time users visit their websites and which content they are interested in, thereby enabling them to tailor the content of their websites more effectively to the needs of their visitors. Pseudonymous cookies and web beacons are frequently used for reach analysis purposes in order to recognise returning visitors and thereby obtain more precise analyses of the use of an online offering.',
                    },
                    {
                        label: 'Controller',
                        text: '"Controller" means the natural or legal person, public authority, agency or other body which, alone or jointly with others, determines the purposes and means of the processing of personal data.',
                    },
                    {
                        label: 'Processing',
                        text: '"Processing" means any operation or set of operations which is performed on personal data or on sets of personal data, whether or not by automated means. The term is broad and encompasses virtually any handling of data, including collection, evaluation, storage, transmission and erasure.',
                    },
                ]} />
            </section>

        </LegalLayout>
    );
}