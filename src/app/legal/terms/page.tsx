import type { Metadata } from 'next'
import LegalLayout from '@/app/legal/components/LegalLayout'
import LegalList from '@/app/legal/components/LegalList'
import Linkout from '@/app/legal/components/Linkout'

export const metadata: Metadata = {
    title: 'Terms of Use',
    description: 'Terms of use for itsmarian.dev - Read the rules, guidelines, and legal agreements for using my website and services.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'Terms of Use',
        description: 'Terms of use for itsmarian.dev - Read the rules and guidelines for using my website.',
    },
}

export default function TermsPage() {
    return (
        <LegalLayout title="Terms of Use">
            <section className="section">
                <div className="text-section">
                    Itsmarian provides this service to you free of charge. Under the terms of this Agreement,
                    you are authorised to use the site and the projects contained therein and to further
                    develop them under the MIT licence (where applicable).
                </div>
                <div className="text-section">
                    Please read this agreement carefully and thoroughly, as it explains how, for what purposes,
                    under what conditions and with what restrictions you may use the website and services
                    offered by itsmarian ("itsmarian", "itsmarian.mc", "itsmarianmc", "I", "my"), and how I
                    collect and process your data.
                </div>
                <div className="text-section">
                    By continuing, you confirm that you have read and agree to the{' '}
                    <Linkout item="/legal/privacy" type="internal" className="linkout nodecoration" target="_blank">Privacy Policy</Linkout> and these{' '}
                    <Linkout item="/legal/terms" type="internal" className="linkout nodecoration" target="_blank">Terms of Use</Linkout>. If you do not
                    agree, please leave my website and refrain from using my services.
                </div>
                <div className="text-section">
                    Last updated: 9 May 2026
                </div>
            </section>
            <section className="section">
                <div className="text-section">
                    <span className="legal-h1">Contents</span>
                </div>
                <div className="text-section">
                    <div className="legal-contents">
                        {[
                            { id: 'legal-1introduction',label: '#1', title: 'Introduction' },
                            { id: 'legal-2contactdetailsandlegalinformation', label: '#2',  title: 'Contact details and legal information' },
                            { id: 'legal-3availabilityofthewebsite', label: '#3',  title: 'Availability of the website' },
                            { id: 'legal-4electroniccommunication', label: '#4',  title: 'Electronic communication' },
                            { id: 'legal-5copyrightanddatabaserights', label: '#5',  title: 'Copyright and database rights' },
                            { id: 'legal-6intellectualpropertyclaims', label: '#6',  title: 'Intellectual property claims' },
                            { id: 'legal-7liability', label: '#7',  title: 'Liability' },
                            { id: 'legal-8linkstootherwebsites', label: '#8',  title: 'Links to other websites' },
                            { id: 'legal-9dataprotection', label: '#9',  title: 'Data protection' },
                            { id: 'legal-10cookies', label: '#10', title: 'Cookies' },
                            { id: 'legal-11nowaiver', label: '#11', title: 'No waiver' },
                            { id: 'legal-12finalprovisions', label: '#12', title: 'Final provisions' },
                        ].map((item, idx) => (
                            <div key={idx} className="legal-content" data-tag-type="scroll-to" data-scroll-to-id={item.id}>
                                <div className="legal-content-l">
                                    <Linkout item={`#${item.id}`} type="internal" className="linkout nodecoration" target="_blank">
                                        {item.label}
                                    </Linkout>
                                </div>
                                <div className="legal-content-r">
                                    <Linkout item={`#${item.id}`} type="internal" className="linkout nodecoration" target="_blank">
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
                    1.1 The following terms and conditions govern the use of the website{' '}
                    <Linkout item="https://itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        https://itsmarian.dev
                    </Linkout>
                    {' '}
                    and all its sub-pages and associated services (hereinafter "website" and "site"). In order
                    to use the website, it is necessary that you, as a user, accept these terms and conditions.
                </div>
                <div className="text-section">
                    1.2 By using my website, you agree to these Terms of Use and warrant that you will not
                    make any contributions or engage in any conduct that violates them.
                </div>
                <div className="text-section">
                    1.3 The services provided by itsmarian include, but are not limited to:
                    <LegalList items={[
                        { text: 'A personal portfolio for itsmarian.' },
                        { text: 'An overview of itsmarian\'s projects.' },
                        { text: 'Access to and use of itsmarian\'s open-source projects.' },
                        { text: 'Personal content and opinions (e.g. blog posts).' },
                        { text: 'Photography and personal photo galleries.' },
                    ]} />
                </div>
            </section>
            <section className="section" id="legal-2contactdetailsandlegalinformation">
                <div className="text-section">
                    <span className="legal-h1">#2 Contact details and legal information</span>
                </div>
                <div className="text-section">
                    If you have any questions regarding my website or these Terms of Use, you may contact me
                    using the following details:
                </div>
                <div className="text-section">
                    Marian D. (also known as itsmarian / itsmarian.mc / itsmarianmc)
                    <br />
                    67105 Schifferstadt, Rhineland-Palatinate, Germany
                    <br />
                    E-mail: <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        support@itsmarian.dev
                    </Linkout>
                    <br />
                    Legal notice:{' '}
                    <Linkout item="https://itsmarian.dev/imprint" type="internal" className="linkout nodecoration" target="_blank">
                        https://itsmarian.dev/imprint
                    </Linkout>
                </div>
            </section>
            <section className="section" id="legal-3availabilityofthewebsite">
                <div className="text-section">
                    <span className="legal-h1">#3 Availability of the website</span>
                </div>
                <div className="text-section">
                    3.1 I endeavour to ensure the availability of itsmarian's services at all times. However,
                    temporary interruptions may occur due to scheduled maintenance, system updates, or
                    circumstances beyond my control. I will make reasonable efforts to limit the frequency and
                    duration of any such interruptions.
                </div>
                <div className="text-section">
                    3.2 I expressly note:
                    <LegalList items={[
                        { text: 'That errors may result in the temporary unavailability of the website.' },
                        { text: 'That it is technically not possible to guarantee a website entirely free of errors, and I therefore accept no liability in this respect.' },
                        { text: 'That the availability of this website depends on conditions and services outside of my control, such as transmission capacities and network infrastructure. I am not responsible for disruptions in those areas.' },
                    ]} />
                </div>
            </section>
            <section className="section" id="legal-4electroniccommunication">
                <div className="text-section">
                    <span className="legal-h1">#4 Electronic communication</span>
                </div>
                <div className="text-section">
                    When you use a service provided by itsmarian or send e-mails or other communications to
                    me from your computer or mobile device, you are communicating electronically. I will
                    communicate with you electronically in a variety of ways, including via e-mail or by
                    posting notices on the website. For contractual purposes, you agree to receive electronic
                    communications from me and acknowledge that all notices, disclosures and other
                    communications provided to you electronically satisfy any legal requirement that such
                    communications be made in writing, unless mandatory applicable law expressly requires a
                    different form.
                </div>
            </section>
            <section className="section" id="legal-5copyrightanddatabaserights">
                <div className="text-section">
                    <span className="legal-h1">#5 Copyright and database rights</span>
                </div>
                <div className="text-section">
                    5.1 All content included in or made available through itsmarian's services — such as
                    text, graphics, logos, icons, images, audio clips, digital downloads and data
                    compilations — is the property of itsmarian or of third parties who supply or make such
                    content available, and is protected by German and international copyright and database
                    right laws.
                </div>
                <div className="text-section">
                    5.2 You may not systematically extract or re-utilise substantial parts of the content
                    available at{' '}
                    <Linkout item="https://itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        https://itsmarian.dev
                    </Linkout>
                    {' '}
                    without my express prior written consent. In particular, you may not use data mining,
                    automated scripts, robots or similar data gathering tools to extract substantial portions
                    of any itsmarian service for re-use, nor create and publish your own database
                    incorporating substantial parts of my content, without such consent.
                </div>
                <div className="text-section">
                    5.3 Individual projects published on this website may be subject to open-source licences
                    (e.g. the MIT Licence). Where this is the case, the terms of the applicable licence
                    govern your use of that project. Please refer to the licence file included with each
                    project for details.
                </div>
            </section>
            <section className="section" id="legal-6intellectualpropertyclaims">
                <div className="text-section">
                    <span className="legal-h1">#6 Intellectual property claims</span>
                </div>
                <div className="text-section">
                    I respect the intellectual property rights of others. If you believe that content
                    available on this website infringes your intellectual property rights, please contact me
                    at{' '}
                    <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        support@itsmarian.dev
                    </Linkout>
                    {' '}
                    with a description of the alleged infringement and sufficient information to identify the
                    material concerned. I will investigate all legitimate notices and respond accordingly.
                </div>
            </section>
            <section className="section" id="legal-7liability">
                <div className="text-section">
                    <span className="legal-h1">#7 Liability</span>
                </div>
                <div className="text-section">
                    7.1 I endeavour to ensure that my services are available without interruption and that
                    transmissions are error-free. However, due to the nature of the internet, this cannot be
                    guaranteed. Access to my services may be interrupted or restricted from time to time to
                    allow for repairs, maintenance or the introduction of new features.
                </div>
                <div className="text-section">
                    7.2 I shall be liable without limitation where the cause of damage is based on an
                    intentional or grossly negligent breach of duty by me.
                </div>
                <div className="text-section">
                    7.3 I shall further be liable for the slightly negligent breach of material obligations.
                    Material obligations are those whose breach endangers the purpose of the agreement or
                    whose fulfilment is essential to its proper performance and upon which you may reasonably
                    rely. In such cases, however, my liability is limited to the foreseeable damage typical
                    for this type of agreement. I am not liable for the slightly negligent breach of
                    non-material obligations.
                </div>
                <div className="text-section">
                    7.4 The above limitations of liability shall not apply in the event of injury to life,
                    body or health, in the case of a defect following the assumption of a guarantee for the
                    quality of a product, or in the event of fraudulently concealed defects. Statutory
                    liability under the Product Liability Act (Produkthaftungsgesetz) remains unaffected.
                </div>
                <div className="text-section">
                    7.5 To the extent that my liability is excluded or limited, this also applies to the
                    personal liability of any persons acting on my behalf.
                </div>
            </section>
            <section className="section" id="legal-8linkstootherwebsites">
                <div className="text-section">
                    <span className="legal-h1">#8 Links to other websites</span>
                </div>
                <div className="text-section">
                    My website contains links to third-party websites. These are provided for convenience and
                    informational purposes only. I assume no liability for and am not responsible for the
                    content of any linked third-party website; responsibility for that content lies solely
                    with the respective operator. I make reasonable efforts to keep links up to date, but
                    cannot guarantee that linked pages remain accessible. If you encounter a broken or
                    incorrect link, please notify me at{' '}
                    <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        support@itsmarian.dev
                    </Linkout>
                    {' '}
                    so that I may address it promptly.
                </div>
            </section>
            <section className="section" id="legal-9dataprotection">
                <div className="text-section">
                    <span className="legal-h1">#9 Data protection</span>
                </div>
                <div className="text-section">
                    9.1 Certain visitor and usage data (such as date, time and pages accessed) may be
                    recorded on the server. No personal data (e.g. name, address or e-mail address) is
                    stored without your prior consent.
                </div>
                <div className="text-section">
                    9.2 Where personal data is collected, I undertake to obtain your prior consent and not
                    to disclose that data to third parties without your prior consent, unless I am legally
                    obliged to do so.
                </div>
                <div className="text-section">
                    9.3 Please note that the transmission of data over the internet (e.g. by e-mail) may
                    involve security risks. Complete protection against access by third parties cannot be
                    fully guaranteed.
                </div>
                <div className="text-section">
                    9.4 As a data subject under the GDPR, you hold rights including the right of access,
                    the right to rectification, the right to erasure and the right to restriction of
                    processing, among others. Full details are set out in the{' '}
                    <Linkout item="/legal/privacy" type="internal" className="linkout nodecoration" target="_blank">Privacy Policy</Linkout>.
                </div>
            </section>
            <section className="section" id="legal-10cookies">
                <div className="text-section">
                    <span className="legal-h1">#10 Cookies</span>
                </div>
                <div className="text-section">
                    10.1 This website may use cookies. Cookies are small text files stored locally in your
                    browser's cache that help the website function correctly, remember your preferences and
                    analyse how the site is used.
                </div>
                <div className="text-section">
                    10.2 Where cookies that are not strictly necessary for the operation of the website are
                    used, your consent will be requested via a cookie banner before such cookies are placed.
                    You may accept or decline non-essential cookies at any time through that banner or your
                    browser settings.
                </div>
                <div className="text-section">
                    10.3 Full details on the cookies used, their purpose and their retention periods are
                    provided in the{' '}
                    <Linkout item="/legal/privacy" type="internal" className="linkout nodecoration" target="_blank">
                        Privacy Policy
                    </Linkout>
                    .
                </div>
            </section>
            <section className="section" id="legal-11nowaiver">
                <div className="text-section">
                    <span className="legal-h1">#11 No waiver</span>
                </div>
                <div className="text-section">
                    No failure or delay by me in exercising any right or provision under these Terms of Use
                    shall constitute a waiver of that right or provision. If I do not act in response to a
                    breach of these Terms of Use on one occasion, I retain the right to enforce these Terms
                    of Use in full on any subsequent occasion.
                </div>
            </section>
            <section className="section" id="legal-12finalprovisions">
                <div className="text-section">
                    <span className="legal-h1">#12 Final provisions</span>
                </div>
                <div className="text-section">
                    12.1 These Terms of Use are governed by the laws of the Federal Republic of Germany.
                    The language of this agreement is English.
                </div>
                <div className="text-section">
                    12.2 I reserve the right to amend these Terms of Use at any time. The version of the
                    Terms of Use in effect at the time you access or use the website shall apply to your
                    use. Continued use of the website following the publication of amended terms constitutes
                    your acceptance of those amendments. Where changes are material, I will endeavour to
                    provide reasonable notice.
                </div>
                <div className="text-section">
                    12.3 Should any individual provision of these Terms of Use be or become invalid or
                    unenforceable, the remaining provisions shall continue in full force and effect. The
                    invalid or unenforceable provision shall be replaced by a legally permissible provision
                    that most closely reflects the intent and purpose of the original.
                </div>
            </section>
        </LegalLayout>
    );
}