import type { Metadata } from 'next'
import LegalLayout from '@/app/legal/components/LegalLayout'
import LegalList from '@/app/legal/components/LegalList'
import Linkout from '@/app/legal/components/Linkout'

export const metadata: Metadata = {
    title: 'Terms of Use — HealthSync',
    description:
        'Terms of use for HealthSync, a personal health-tracking app by itsmarian. Read the rules, guidelines and legal agreements for using the app.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'Terms of Use — HealthSync',
        description:
            'Terms of use for HealthSync, part of itsmarian\'s projects. Read the rules and guidelines for using the app.',
    },
}

export default function TermsPage() {
    return (
        <LegalLayout title="Terms of Use" eyebrow="HealthSync · Legal">
            <section className="section">
                <div className="text-section">
                    HealthSync is provided to you free of charge as part of itsmarian&apos;s projects.
                    Under the terms of this Agreement, you are authorised to use the app, its features
                    and any associated content for personal, non-commercial purposes. Selected parts of
                    the source code may additionally be available under an open-source licence (e.g. the
                    MIT Licence); where applicable, the relevant licence file governs your use of that
                    part.
                </div>
                <div className="text-section">
                    Please read this agreement carefully, as it explains how, for what purposes, under
                    what conditions and with what restrictions you may use the app and services offered
                    at <Linkout item="https://healthsync.itsmarian.dev" type="external" className="linkout nodecoration" target="_blank">https://healthsync.itsmarian.dev</Linkout>
                    {' '}(hereinafter <strong>&quot;HealthSync&quot;</strong>, <strong>&quot;the app&quot;</strong>,
                    <strong> &quot;our&quot;</strong>, <strong>&quot;we&quot;</strong>) by Marian D.
                    (also known as <strong>itsmarian</strong>, <strong>itsmarian.mc</strong> or
                    <strong> itsmarianmc</strong>; hereinafter <strong>&quot;I&quot;</strong>,
                    <strong> &quot;me&quot;</strong>, <strong>&quot;my&quot;</strong>).
                </div>
                <div className="text-section">
                    By continuing, you confirm that you have read and agree to the{' '}
                    <Linkout item="/legal/privacy" type="internal" className="linkout nodecoration" target="_blank">Privacy Policy</Linkout>, the{' '}
                    <Linkout item="/legal/cookies" type="internal" className="linkout nodecoration" target="_blank">Cookie Policy</Linkout>, the{' '}
                    <Linkout item="/legal/ai-guidelines" type="internal" className="linkout nodecoration" target="_blank">AI Guidelines</Linkout>
                    {' '}and these{' '}
                    <Linkout item="/legal/terms" type="internal" className="linkout nodecoration" target="_blank">Terms of Use</Linkout>.
                    If you do not agree, please leave HealthSync and refrain from using its features.
                </div>
                <div className="text-section">
                    Last updated: 18 June 2026
                </div>
            </section>

            <section className="section content-section">
                <div className="text-section">
                    <span className="legal-h1">Contents</span>
                </div>
                <div className="text-section">
                    <div className="legal-contents">
                        {[
                            { id: 'legal-1introduction',                     label: '#1',  title: 'Introduction' },
                            { id: 'legal-2contactdetailsandlegalinformation',label: '#2',  title: 'Contact details and legal information' },
                            { id: 'legal-3availabilityoftheservice',         label: '#3',  title: 'Availability of the service' },
                            { id: 'legal-4accountsandauthentication',        label: '#4',  title: 'Accounts and authentication' },
                            { id: 'legal-5acceptableuse',                    label: '#5',  title: 'Acceptable use' },
                            { id: 'legal-6healthrelatedcontent',             label: '#6',  title: 'Health-related content & no medical advice' },
                            { id: 'legal-7aifeatures',                       label: '#7',  title: 'AI features' },
                            { id: 'legal-8electroniccommunication',          label: '#8',  title: 'Electronic communication' },
                            { id: 'legal-9copyrightanddatabaserights',       label: '#9',  title: 'Copyright and database rights' },
                            { id: 'legal-10intellectualpropertyclaims',      label: '#10', title: 'Intellectual property claims' },
                            { id: 'legal-11liability',                       label: '#11', title: 'Liability' },
                            { id: 'legal-12linkstootherwebsites',            label: '#12', title: 'Links to other websites' },
                            { id: 'legal-13dataprotection',                  label: '#13', title: 'Data protection' },
                            { id: 'legal-14cookies',                         label: '#14', title: 'Cookies' },
                            { id: 'legal-15nowaiver',                        label: '#15', title: 'No waiver' },
                            { id: 'legal-16finalprovisions',                 label: '#16', title: 'Final provisions' },
                        ].map((item, idx) => (
                            <div key={idx} className="legal-content" data-tag-type="scroll-to" data-scroll-to-id={item.id}>
                                <div className="legal-content-l">
                                    <Linkout item={`#${item.id}`} type="internal" className="linkout nodecoration">
                                        {item.label}
                                    </Linkout>
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

            <section className="section" id="legal-1introduction">
                <div className="text-section">
                    <span className="legal-h1">#1 Introduction</span>
                </div>
                <div className="text-section">
                    1.1 These Terms of Use govern the use of HealthSync, available at{' '}
                    <Linkout item="https://healthsync.itsmarian.dev" type="external" className="linkout nodecoration" target="_blank">
                        https://healthsync.itsmarian.dev
                    </Linkout>
                    {' '}and any associated sub-pages, APIs and services. HealthSync is a personal project
                    and part of itsmarian&apos;s projects. In order to use HealthSync, you accept these
                    Terms of Use.
                </div>
                <div className="text-section">
                    1.2 By using HealthSync, you agree to these Terms of Use and warrant that you will
                    not engage in any conduct that violates them.
                </div>
                <div className="text-section">
                    1.3 The features provided by HealthSync include, but are not limited to:
                    <LegalList items={[
                        { text: 'Calorie and macro tracking (CalSync), including manual entry, barcode scanning via Open Food Facts and optional AI-assisted nutrition estimation.' },
                        { text: 'Hydration tracking (DropSync) with quick logging and history.' },
                        { text: 'Workout logging with routines, live session timer and set tracking.' },
                        { text: 'A personal dashboard with daily score, recent log and trend chart.' },
                        { text: 'Optional cloud synchronisation across devices via a user account.' },
                    ]} />
                </div>
            </section>

            <section className="section" id="legal-2contactdetailsandlegalinformation">
                <div className="text-section">
                    <span className="legal-h1">#2 Contact details and legal information</span>
                </div>
                <div className="text-section">
                    If you have any questions regarding HealthSync or these Terms of Use, you may
                    contact me using the following details:
                </div>
                <div className="text-section">
                    Marian D. (also known as itsmarian / itsmarian.mc / itsmarianmc)<br />
                    Germany<br />
                    E-mail:{' '}
                    <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        support@itsmarian.dev
                    </Linkout>
                    <br />
                    Legal notice / imprint:{' '}
                    <Linkout item="https://itsmarian.dev/imprint" type="external" className="linkout nodecoration" target="_blank">
                        https://itsmarian.dev/imprint
                    </Linkout>
                </div>
            </section>

            <section className="section" id="legal-3availabilityoftheservice">
                <div className="text-section">
                    <span className="legal-h1">#3 Availability of the service</span>
                </div>
                <div className="text-section">
                    3.1 I endeavour to ensure the availability of HealthSync at all times. However,
                    temporary interruptions may occur due to scheduled maintenance, system updates,
                    or circumstances beyond my control. I will make reasonable efforts to limit the
                    frequency and duration of any such interruptions.
                </div>
                <div className="text-section">
                    3.2 I expressly note:
                    <LegalList items={[
                        { text: 'That errors may result in the temporary unavailability of the app or of cloud synchronisation.' },
                        { text: 'That it is technically not possible to guarantee software entirely free of errors, and I therefore accept no liability in this respect beyond the limits set out in #11 (Liability).' },
                        { text: 'That the availability of HealthSync depends on conditions and services outside of my control, including the hosting provider, the authentication/database provider and your own network and device. I am not responsible for disruptions in those areas.' },
                        { text: 'That HealthSync is a personal project. Features may be added, modified or removed at any time as the app evolves.' },
                    ]} />
                </div>
            </section>

            <section className="section" id="legal-4accountsandauthentication">
                <div className="text-section">
                    <span className="legal-h1">#4 Accounts and authentication</span>
                </div>
                <div className="text-section">
                    4.1 HealthSync can be used without an account; in that case, your data remains
                    locally in your browser. To synchronise data across devices, you may create a free
                    user account.
                </div>
                <div className="text-section">
                    4.2 You are responsible for keeping your login credentials confidential and for all
                    activity that occurs under your account. You agree to notify me without undue delay
                    if you become aware of any unauthorised use of your account.
                </div>
                <div className="text-section">
                    4.3 I strongly recommend enabling Two-Factor Authentication (TOTP) where available.
                </div>
                <div className="text-section">
                    4.4 You may delete your account at any time from within the app. Deleting your
                    account removes the data associated with your user ID from the cloud backend, subject
                    only to statutory retention obligations.
                </div>
            </section>

            <section className="section" id="legal-5acceptableuse">
                <div className="text-section">
                    <span className="legal-h1">#5 Acceptable use</span>
                </div>
                <div className="text-section">
                    5.1 You agree to use HealthSync only for lawful personal purposes and in accordance
                    with these Terms of Use. In particular, you agree not to:
                </div>
                <div className="text-section">
                    <LegalList items={[
                        { text: 'Attempt to gain unauthorised access to any part of HealthSync, other user accounts, or the underlying systems and infrastructure.' },
                        { text: 'Interfere with or disrupt HealthSync, including by submitting malicious code, attempting denial-of-service attacks, or systematically overloading the service.' },
                        { text: 'Use automated scripts, bots or scrapers to extract data from HealthSync, except as expressly permitted.' },
                        { text: 'Use HealthSync in any way that infringes the rights of others, including intellectual property, privacy or personality rights.' },
                        { text: 'Upload or submit content that is unlawful, harmful, defamatory or that violates applicable law.' },
                        { text: 'Use HealthSync in a manner that exceeds reasonable personal use, e.g. by acting as a service provider to third parties without prior written agreement.' },
                    ]} />
                </div>
                <div className="text-section">
                    5.2 I may, at my reasonable discretion, suspend or terminate access to HealthSync
                    in response to violations of these Terms of Use.
                </div>
            </section>

            <section className="section" id="legal-6healthrelatedcontent">
                <div className="text-section">
                    <span className="legal-h1">#6 Health-related content &amp; no medical advice</span>
                </div>
                <div className="text-section">
                    6.1 HealthSync is a personal tracking tool. It is <strong>not a medical device</strong>,
                    it does not provide medical advice, diagnosis or treatment, and it is not certified
                    under the EU Medical Device Regulation (MDR) or any comparable framework.
                </div>
                <div className="text-section">
                    6.2 The calorie, macro and hydration goals suggested or calculated by HealthSync
                    (e.g. via the Mifflin–St Jeor formula) are <strong>indicative only</strong> and may
                    not reflect your individual nutritional needs. Always consult a qualified health
                    professional before making significant changes to your diet, hydration or training
                    routine, in particular if you have any medical condition, are pregnant or
                    breastfeeding, or are under 18.
                </div>
                <div className="text-section">
                    6.3 You are solely responsible for how you act on information displayed by
                    HealthSync. I accept no liability for decisions or actions taken on the basis of
                    HealthSync data, within the limits set out in #11 (Liability).
                </div>
            </section>

            <section className="section" id="legal-7aifeatures">
                <div className="text-section">
                    <span className="legal-h1">#7 AI features</span>
                </div>
                <div className="text-section">
                    7.1 HealthSync offers optional AI-assisted features, in particular nutrition
                    estimation from photos, camera input or text descriptions via Google&apos;s Gemini
                    API. These features are <strong>strictly opt-in</strong>, disabled by default, and
                    require <strong>your own Gemini API key</strong>.
                </div>
                <div className="text-section">
                    7.2 By enabling AI Detection you confirm that you have read and accept the
                    {' '}
                    <Linkout item="/legal/ai-guidelines" type="internal" className="linkout nodecoration" target="_blank">AI Guidelines</Linkout>
                    {' '}and that you will use the feature in accordance with{' '}
                    <Linkout item="https://ai.google.dev/gemini-api/terms" type="external" className="linkout nodecoration" target="_blank">
                        Google&apos;s Gemini API Terms
                    </Linkout>.
                </div>
                <div className="text-section">
                    7.3 AI output is an estimate and may be inaccurate. You must verify critical
                    nutrition information before relying on it. See #6 (Health-related content) and the
                    AI Guidelines for further details.
                </div>
            </section>

            <section className="section" id="legal-8electroniccommunication">
                <div className="text-section">
                    <span className="legal-h1">#8 Electronic communication</span>
                </div>
                <div className="text-section">
                    When you use HealthSync or send e-mails to me, you are communicating electronically.
                    I will communicate with you electronically, including via e-mail, in-app notices, or
                    notices on the website. For contractual purposes, you agree to receive electronic
                    communications from me and acknowledge that all notices, disclosures and other
                    communications provided electronically satisfy any legal requirement that such
                    communications be made in writing, unless mandatory applicable law expressly
                    requires a different form.
                </div>
            </section>

            <section className="section" id="legal-9copyrightanddatabaserights">
                <div className="text-section">
                    <span className="legal-h1">#9 Copyright and database rights</span>
                </div>
                <div className="text-section">
                    9.1 Unless otherwise stated, all content included in or made available through
                    HealthSync — such as the user interface, text, graphics, logos, icons, images and
                    data compilations — is the property of itsmarian or of third parties who supply or
                    make such content available, and is protected by German and international copyright
                    and database right laws.
                </div>
                <div className="text-section">
                    9.2 You may not systematically extract or re-utilise substantial parts of the
                    content available at{' '}
                    <Linkout item="https://healthsync.itsmarian.dev" type="external" className="linkout nodecoration" target="_blank">
                        https://healthsync.itsmarian.dev
                    </Linkout>
                    {' '}without my express prior written consent. In particular, you may not use data
                    mining, automated scripts, robots or similar data gathering tools to extract
                    substantial portions of HealthSync, nor create and publish your own database or
                    service incorporating substantial parts of my content, without such consent.
                </div>
                <div className="text-section">
                    9.3 Selected parts of HealthSync&apos;s source code may be published under an
                    open-source licence (e.g. the MIT Licence). Where this is the case, the terms of
                    the applicable licence govern your use of those parts. Please refer to the licence
                    file included with each project for details.
                </div>
                <div className="text-section">
                    9.4 Third-party libraries used by HealthSync (e.g. Next.js, Supabase client, ZXing
                    barcode library, DM Sans font, Font Awesome icons, exercise data) remain the
                    property of their respective owners and are subject to their respective licences.
                </div>
            </section>

            <section className="section" id="legal-10intellectualpropertyclaims">
                <div className="text-section">
                    <span className="legal-h1">#10 Intellectual property claims</span>
                </div>
                <div className="text-section">
                    I respect the intellectual property rights of others. If you believe that content
                    available in HealthSync infringes your intellectual property rights, please contact
                    me at{' '}
                    <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        support@itsmarian.dev
                    </Linkout>
                    {' '}with a description of the alleged infringement and sufficient information to
                    identify the material concerned. I will investigate all legitimate notices and
                    respond accordingly.
                </div>
            </section>

            <section className="section" id="legal-11liability">
                <div className="text-section">
                    <span className="legal-h1">#11 Liability</span>
                </div>
                <div className="text-section">
                    11.1 HealthSync is provided free of charge. I endeavour to ensure that the service
                    is available without interruption and that transmissions are error-free. However,
                    due to the nature of the internet and the experimental nature of some features,
                    this cannot be guaranteed.
                </div>
                <div className="text-section">
                    11.2 I shall be liable without limitation where the cause of damage is based on an
                    intentional or grossly negligent breach of duty by me.
                </div>
                <div className="text-section">
                    11.3 I shall further be liable for the slightly negligent breach of material
                    obligations. Material obligations are those whose breach endangers the purpose of
                    the agreement or whose fulfilment is essential to its proper performance and upon
                    which you may reasonably rely. In such cases, however, my liability is limited to
                    the foreseeable damage typical for this type of agreement. I am not liable for the
                    slightly negligent breach of non-material obligations.
                </div>
                <div className="text-section">
                    11.4 The above limitations of liability shall not apply in the event of injury to
                    life, body or health, in the case of a defect following the assumption of a
                    guarantee for the quality of a product, or in the event of fraudulently concealed
                    defects. Statutory liability under the Product Liability Act
                    (Produkthaftungsgesetz) remains unaffected.
                </div>
                <div className="text-section">
                    11.5 To the extent that my liability is excluded or limited, this also applies to
                    the personal liability of any persons acting on my behalf.
                </div>
                <div className="text-section">
                    11.6 I assume no liability for loss of data caused by the loss or destruction of
                    your local device, by clearing your browser&apos;s storage, by misconfiguration on
                    your part, or by outages of third-party providers (e.g. hosting or authentication
                    provider). You are responsible for backing up data that is important to you.
                </div>
                <div className="text-section">
                    11.7 I assume no liability for the accuracy of AI-generated nutrition values, third-
                    party data sources (e.g. Open Food Facts) or any decisions you make on the basis of
                    such data. See #6 and #7 above.
                </div>
            </section>

            <section className="section" id="legal-12linkstootherwebsites">
                <div className="text-section">
                    <span className="legal-h1">#12 Links to other websites</span>
                </div>
                <div className="text-section">
                    HealthSync contains links to third-party websites. These are provided for
                    convenience and informational purposes only. I assume no liability for and am not
                    responsible for the content of any linked third-party website; responsibility for
                    that content lies solely with the respective operator. If you encounter a broken or
                    incorrect link, please notify me at{' '}
                    <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        support@itsmarian.dev
                    </Linkout>
                    {' '}so that I may address it promptly.
                </div>
            </section>

            <section className="section" id="legal-13dataprotection">
                <div className="text-section">
                    <span className="legal-h1">#13 Data protection</span>
                </div>
                <div className="text-section">
                    13.1 Information on how I process personal data in connection with HealthSync is
                    set out in the{' '}
                    <Linkout item="/legal/privacy" type="internal" className="linkout nodecoration" target="_blank">Privacy Policy</Linkout>.
                    Because HealthSync may process data concerning your health within the meaning of
                    Art. 9 GDPR, please read that policy carefully.
                </div>
                <div className="text-section">
                    13.2 As a data subject under the GDPR, you hold rights including the right of
                    access, the right to rectification, the right to erasure and the right to
                    restriction of processing, among others. Full details are set out in the Privacy
                    Policy.
                </div>
                <div className="text-section">
                    13.3 Please note that the transmission of data over the internet may involve
                    security risks. Complete protection against access by third parties cannot be fully
                    guaranteed.
                </div>
            </section>

            <section className="section" id="legal-14cookies">
                <div className="text-section">
                    <span className="legal-h1">#14 Cookies</span>
                </div>
                <div className="text-section">
                    14.1 HealthSync uses a small number of cookies and similar browser-storage
                    technologies. Strictly necessary cookies (e.g. for authentication) are used on the
                    basis of legitimate interest; all other cookies are used only with your prior
                    consent through the cookie banner.
                </div>
                <div className="text-section">
                    14.2 Full details on the cookies used, their purpose and their retention periods
                    are provided in the{' '}
                    <Linkout item="/legal/cookies" type="internal" className="linkout nodecoration" target="_blank">Cookie Policy</Linkout>.
                </div>
            </section>

            <section className="section" id="legal-15nowaiver">
                <div className="text-section">
                    <span className="legal-h1">#15 No waiver</span>
                </div>
                <div className="text-section">
                    No failure or delay by me in exercising any right or provision under these Terms of
                    Use shall constitute a waiver of that right or provision. If I do not act in
                    response to a breach of these Terms of Use on one occasion, I retain the right to
                    enforce these Terms of Use in full on any subsequent occasion.
                </div>
            </section>

            <section className="section" id="legal-16finalprovisions">
                <div className="text-section">
                    <span className="legal-h1">#16 Final provisions</span>
                </div>
                <div className="text-section">
                    16.1 These Terms of Use are governed by the laws of the Federal Republic of Germany.
                    The language of this agreement is English. Mandatory consumer-protection provisions
                    of your country of residence remain unaffected.
                </div>
                <div className="text-section">
                    16.2 I reserve the right to amend these Terms of Use at any time. The version of
                    the Terms of Use in effect at the time you access or use HealthSync shall apply to
                    your use. Continued use of HealthSync following the publication of amended terms
                    constitutes your acceptance of those amendments. Where changes are material, I will
                    endeavour to provide reasonable notice.
                </div>
                <div className="text-section">
                    16.3 Should any individual provision of these Terms of Use be or become invalid or
                    unenforceable, the remaining provisions shall continue in full force and effect.
                    The invalid or unenforceable provision shall be replaced by a legally permissible
                    provision that most closely reflects the intent and purpose of the original.
                </div>
            </section>
        </LegalLayout>
    );
}
