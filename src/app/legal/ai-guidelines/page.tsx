import type { Metadata } from 'next'
import LegalLayout from '@/app/legal/components/LegalLayout'
import LegalList from '@/app/legal/components/LegalList'
import LegalEnumeration from '@/app/legal/components/LegalEnumeration'
import Linkout from '@/app/legal/components/Linkout'

export const metadata: Metadata = {
    title: 'AI Guidelines - HealthSync',
    description:
        'How HealthSync uses artificial intelligence: what it can do, what it should never be used for, which risks it brings, and what your responsibilities are when using AI-assisted nutrition estimation.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'AI Guidelines - HealthSync',
        description:
            'Read how HealthSync uses AI, the limits of AI-based nutrition estimation, and what you as a user are responsible for.',
    },
}

export default function AiGuidelinesPage() {
    return (
        <LegalLayout title="AI Guidelines" eyebrow="HealthSync · Legal">
            <section className="section" id="ai-preamble">
                <div className="text-section">
                    <span className="legal-h1">Preamble</span>
                </div>
                <div className="text-section">
                    These AI Guidelines describe how artificial intelligence is integrated into
                    <strong> HealthSync</strong> (part of itsmarian&apos;s projects, available at{' '}
                    <Linkout item="https://healthsync.itsmarian.dev" type="external" className="linkout nodecoration" target="_blank">https://healthsync.itsmarian.dev</Linkout>),
                    what it may and may not be used for, what risks it brings, and what your
                    responsibilities are as a user.
                </div>
                <div className="text-section">
                    They complement and are part of the{' '}
                    <Linkout item="/legal/terms" type="internal" className="linkout nodecoration" target="_blank">Terms of Use</Linkout>
                    {' '}and the{' '}
                    <Linkout item="/legal/privacy" type="internal" className="linkout nodecoration" target="_blank">Privacy Policy</Linkout>.
                    Please read all three before enabling AI features.
                </div>
                <div className="text-section">
                    Last updated: 18 June 2026
                </div>
            </section>

            <section className="section content-section">
                <div className="text-section">
                    <h2>Table of Contents</h2>
                </div>
                <div className="text-section">
                    <div className="legal-contents">
                        {[
                            { id: 'ai-preamble', label: '#1', title: 'Preamble' },
                            { id: 'ai-overview', label: '#2', title: 'Overview of AI in HealthSync' },
                            { id: 'ai-provider', label: '#3', title: 'Provider, model and your API key' },
                            { id: 'ai-permitted', label: '#4', title: 'What AI may be used for' },
                            { id: 'ai-prohibited', label: '#5', title: 'What AI must not be used for' },
                            { id: 'ai-risks', label: '#6', title: 'Known risks and limitations' },
                            { id: 'ai-data', label: '#7', title: 'Data sent to the AI provider' },
                            { id: 'ai-responsibility', label: '#8', title: 'Your responsibilities' },
                            { id: 'ai-control', label: '#9', title: 'Your controls and opt-out' },
                            { id: 'ai-children', label: '#10', title: 'Children and minors' },
                            { id: 'ai-quotas', label: '#11', title: 'Costs, quotas and rate limits' },
                            { id: 'ai-incident', label: '#12', title: 'Incidents and abuse reporting' },
                            { id: 'ai-changes', label: '#13', title: 'Changes and updates' },
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

            <section className="section" id="ai-overview">
                <div className="text-section">
                    <span className="legal-h1">Overview of AI in HealthSync</span>
                </div>
                <div className="text-section">
                    HealthSync uses AI in two clearly separated places. Knowing which is which helps
                    you understand what leaves your device and what does not:
                </div>
                <LegalList items={[
                    {
                        label: 'AI Detection (external, opt-in)',
                        text: 'Inside CalSync, you may optionally use AI to estimate nutrition values from a food photo, a camera capture or a text description (e.g. "two slices of whole-wheat bread with butter"). This sends the input you provided to Google\'s Gemini API and parses the returned JSON into a draft food entry that you can review, edit and save.',
                    },
                    {
                        label: 'AI Tips widget (local, rule-based)',
                        text: 'The "AI Tips" card on the dashboard generates short, motivational hints (e.g. "You are 200 ml away from your hydration goal"). Despite the name, this widget is fully rule-based and runs entirely on your device. It does not contact any AI provider and does not send your data anywhere.',
                    },
                ]} />
                <div className="text-section">
                    Throughout these guidelines, the term &quot;AI&quot; refers to the
                    <strong> AI Detection</strong> feature unless explicitly stated otherwise.
                </div>
            </section>

            <section className="section" id="ai-provider">
                <div className="text-section">
                    <span className="legal-h1">Provider, model and your API key</span>
                </div>
                <div className="text-section">
                    AI Detection is powered by Google&apos;s <strong>Gemini API</strong> (currently
                    <code> gemini-2.0-flash</code> or a comparable successor model). HealthSync
                    integrates the API directly from your browser; we do <strong>not</strong> operate a
                    proxy that stores or relays your AI requests on our servers.
                </div>
                <div className="text-section">
                    To use AI Detection you must:
                </div>
                <LegalEnumeration items={[
                    { index: 'a)', text: 'Open Settings → AI Detection inside HealthSync.' },
                    { index: 'b)', text: 'Accept the in-app AI terms and confirm that you have read these AI Guidelines.' },
                    { index: 'c)', text: 'Have given third-party / functionality cookie consent in the cookie banner (required because AI uses an external service).' },
                    { index: 'd)', text: (<>Provide your own Google Gemini API key. You can obtain a key from <Linkout item="https://ai.google.dev/" type="external" className="linkout nodecoration" target="_blank">https://ai.google.dev/</Linkout>.</>) },
                ]} />
                <div className="text-section">
                    The API key you enter is stored locally in your browser&apos;s localStorage under
                    the key <code>calsync_ai_api_key</code> and is sent only directly to Google when
                    you trigger an AI request. We never receive, log or sync your key.
                </div>
                <div className="text-section">
                    By enabling AI Detection you also agree to{' '}
                    <Linkout item="https://ai.google.dev/gemini-api/terms" type="external" className="linkout nodecoration" target="_blank">
                        Google&apos;s Gemini API Terms
                    </Linkout>
                    {' '}and to the applicable Google privacy notices. Google may use and process the
                    content you submit under those terms.
                </div>
            </section>

            <section className="section" id="ai-permitted">
                <div className="text-section">
                    <span className="legal-h1">What AI may be used for</span>
                </div>
                <div className="text-section">
                    AI Detection is provided as a convenience to speed up logging. You may use it to:
                </div>
                <LegalList items={[
                    { text: 'Estimate calories and macronutrients of a meal from a photo, camera capture or short text description.' },
                    { text: 'Pre-fill the manual food entry form with a draft you can review and adjust before saving.' },
                    { text: 'Quickly recognise foods you don\'t want to look up manually.' },
                ]} />
                <div className="text-section">
                    All AI suggestions are treated as <strong>drafts</strong>. They are never saved
                    automatically. You always confirm - and may freely modify - the values before they
                    become a HealthSync entry.
                </div>
            </section>

            <section className="section" id="ai-prohibited">
                <div className="text-section">
                    <span className="legal-h1">What AI must not be used for</span>
                </div>
                <div className="text-section">
                    AI Detection is a personal estimation aid. It is <strong>not</strong> suitable for
                    any of the following, and you agree not to use it for:
                </div>
                <LegalList items={[
                    { text: 'Medical decisions, diagnosis, treatment, dosing, or anything resembling clinical nutrition counselling.' },
                    { text: 'Decisions affecting infants, children, pregnant or breastfeeding people, athletes during competition, or anyone with a medical condition that requires precise nutritional control (e.g. diabetes, kidney disease, allergies, eating disorders).' },
                    { text: 'Allergen or intolerance checks. AI cannot reliably identify hidden ingredients, traces, or cross-contamination.' },
                    { text: 'Calorie or macro tracking where accuracy actually matters (e.g. competitive bodybuilding cuts, regulated diets). Use the barcode scanner, a verified database, or manual entry instead.' },
                    { text: 'Analysing images that contain other people, faces or any identifying personal data unrelated to food. Crop or recompose the photo first.' },
                    { text: 'Generating, classifying or moderating content beyond the scope of food and nutrition estimation.' },
                    { text: 'Any unlawful, harmful, abusive, deceptive or rights-infringing purpose, or any use that would violate Google\'s Gemini API Terms or applicable law.' },
                ]} />
            </section>

            <section className="section" id="ai-risks">
                <div className="text-section">
                    <span className="legal-h1">Known risks and limitations</span>
                </div>
                <div className="text-section">
                    Generative AI is, by design, probabilistic. You should treat every AI output with
                    healthy scepticism. Among the known limitations:
                </div>
                <LegalList items={[
                    {
                        label: 'Hallucination',
                        text: 'The model can invent details that look plausible but are simply wrong (e.g. a non-existent brand, a misattributed dish, a fabricated nutrient value).',
                    },
                    {
                        label: 'Portion-size errors',
                        text: 'Estimating weights and volumes from a single image is unreliable. The same plate can produce very different calorie totals depending on lighting, angle and visible reference objects.',
                    },
                    {
                        label: 'Ingredient blind spots',
                        text: 'The model cannot see oils, sauces, sugar, butter or other ingredients hidden inside or under food. Real calories are frequently higher than the AI estimate.',
                    },
                    {
                        label: 'Cultural and regional bias',
                        text: 'The model is more accurate for foods that are well-represented in its training data. Regional dishes, home-made meals and atypical preparations are more error-prone.',
                    },
                    {
                        label: 'Inconsistency',
                        text: 'Sending the same input twice may produce noticeably different values. Do not rely on a single AI estimate as if it were a measurement.',
                    },
                    {
                        label: 'Out-of-scope content',
                        text: 'If the input is unclear, not food, or ambiguous, the model may still answer with confidence. Always discard outputs that don\'t match what you actually ate.',
                    },
                    {
                        label: 'Provider-side changes',
                        text: 'Google may update, deprecate or restrict the Gemini API at any time, which may degrade or temporarily disable AI Detection without prior notice.',
                    },
                    {
                        label: 'Network and privacy risks',
                        text: 'AI Detection requires an internet connection. Any data you submit leaves your device and is processed by a third-party provider in accordance with their terms.',
                    },
                ]} />
            </section>

            <section className="section" id="ai-data">
                <div className="text-section">
                    <span className="legal-h1">Data sent to the AI provider</span>
                </div>
                <div className="text-section">
                    When you actively trigger an AI request, HealthSync sends, directly from your
                    browser to{' '}
                    <Linkout item="https://generativelanguage.googleapis.com" type="external" className="linkout nodecoration" target="_blank">
                        generativelanguage.googleapis.com
                    </Linkout>
                    , the following:
                </div>
                <LegalList items={[
                    { text: 'The food image, camera capture or text description you provided as the input.' },
                    { text: 'A short fixed prompt that instructs the model to return nutrition values in a structured JSON format.' },
                    { text: 'Your Gemini API key, used to authenticate the request.' },
                    { text: 'Standard request metadata that any HTTPS call carries (your IP address, user agent, TLS information).' },
                ]} />
                <div className="text-section">
                    HealthSync does <strong>not</strong> send your account e-mail, your full food log,
                    your goals, your workouts, your name or any other unrelated personal data to the
                    AI provider. The request contains only what is necessary to estimate the nutrition
                    of the specific item you submitted.
                </div>
                <div className="text-section">
                    The processing of that request - including retention, training use, region, and
                    sub-processors - is governed by Google&apos;s applicable terms and privacy notices:
                    {' '}
                    <Linkout item="https://ai.google.dev/gemini-api/terms" type="external" className="linkout nodecoration" target="_blank">
                        https://ai.google.dev/gemini-api/terms
                    </Linkout>
                    {' '}and{' '}
                    <Linkout item="https://policies.google.com/privacy" type="external" className="linkout nodecoration" target="_blank">
                        https://policies.google.com/privacy
                    </Linkout>.
                </div>
                <div className="text-section">
                    For the European Union, transfers to the United States are covered by the EU-US
                    Data Privacy Framework (DPF) and, additionally, by Standard Contractual Clauses
                    where applicable. See the{' '}
                    <Linkout item="/legal/privacy" type="internal" className="linkout nodecoration" target="_blank">Privacy Policy</Linkout>
                    {' '}for further details on international transfers.
                </div>
            </section>

            <section className="section" id="ai-responsibility">
                <div className="text-section">
                    <span className="legal-h1">Your responsibilities</span>
                </div>
                <div className="text-section">
                    Because AI Detection sends data to a third-party provider using <strong>your</strong>
                    {' '}API key, you are responsible for the way you use it. By enabling the feature you
                    agree to:
                </div>
                <LegalList items={[
                    { text: 'Use AI Detection only for personal nutrition estimation, in accordance with these Guidelines, the Terms of Use and applicable law.' },
                    { text: 'Treat every AI output as an estimate and verify any values that matter to you against trusted sources (manufacturer label, official nutrition database, dietitian).' },
                    { text: 'Avoid submitting images or text that contain personal data of third parties, sensitive content, intellectual-property-protected material you do not have rights to, or anything that violates Google\'s Gemini API Terms.' },
                    { text: 'Keep your Gemini API key confidential, monitor your own usage and billing, and rotate or revoke the key if it leaks.' },
                    { text: 'Comply with all laws applicable to you (in particular data protection, IP, and any sector-specific rules if you happen to use HealthSync in a professional context).' },
                ]} />
                <div className="text-section">
                    HealthSync, itsmarian and Marian D. assume no liability for AI output, for
                    decisions you take based on that output, or for usage costs incurred on your own
                    Gemini API key, subject to the limits set out in the{' '}
                    <Linkout item="/legal/terms#legal-11liability" type="internal" className="linkout nodecoration" target="_blank">
                        Terms of Use, section #11 (Liability)
                    </Linkout>.
                </div>
            </section>

            <section className="section" id="ai-control">
                <div className="text-section">
                    <span className="legal-h1">Your controls and opt-out</span>
                </div>
                <div className="text-section">
                    You stay in control of AI at all times. You can:
                </div>
                <LegalList items={[
                    { text: 'Use HealthSync entirely without AI - the feature is disabled by default.' },
                    { text: 'Toggle AI Detection off at any time in Settings → AI Detection. Once disabled, HealthSync stops contacting any AI endpoint.' },
                    { text: 'Remove your API key from the Settings panel; it is also erased when you clear the app\'s site data.' },
                    { text: 'Withdraw third-party cookie consent through "Change Cookie Preferences" in the footer; AI features will then be unavailable until consent is granted again.' },
                    { text: 'Discard, edit or modify any value AI proposes before it is saved as an entry.' },
                ]} />
                <div className="text-section">
                    Withdrawing consent or disabling the feature does not affect the lawfulness of any
                    AI processing that took place before withdrawal.
                </div>
            </section>

            <section className="section" id="ai-children">
                <div className="text-section">
                    <span className="legal-h1">Children and minors</span>
                </div>
                <div className="text-section">
                    HealthSync is not directed at children under the age of 16, and AI Detection is in
                    particular not suitable for minors. Do not enable AI features for or on behalf of a
                    person under 16 without verifiable parental consent and a clear understanding of
                    the risks set out in these Guidelines.
                </div>
            </section>

            <section className="section" id="ai-quotas">
                <div className="text-section">
                    <span className="legal-h1">Costs, quotas and rate limits</span>
                </div>
                <div className="text-section">
                    AI requests are billed by Google, not by HealthSync. Free tiers and paid quotas
                    depend on your Google account configuration and may change at any time. HealthSync
                    does not impose its own surcharge for AI usage.
                </div>
                <div className="text-section">
                    HealthSync may apply reasonable client-side rate limits or input-size constraints
                    in order to protect you against accidental over-usage of your API key. These are
                    technical safeguards and not a substitute for monitoring your own Google billing
                    dashboard.
                </div>
            </section>

            <section className="section" id="ai-incident">
                <div className="text-section">
                    <span className="legal-h1">Incidents and abuse reporting</span>
                </div>
                <div className="text-section">
                    If you encounter what you believe is harmful, unsafe or illegal output from AI
                    Detection inside HealthSync, or if you suspect that the feature is being misused,
                    please report it to{' '}
                    <Linkout item="mailto:support@itsmarian.dev" type="internal" className="linkout nodecoration" target="_blank">
                        support@itsmarian.dev
                    </Linkout>
                    {' '}with as much detail as you can reasonably share (without exposing other
                    people&apos;s personal data). I will investigate and take appropriate action,
                    including disabling specific AI behaviour if necessary.
                </div>
                <div className="text-section">
                    Abuse of the Gemini API itself should additionally be reported to Google through
                    the channels listed in their terms.
                </div>
            </section>

            <section className="section" id="ai-changes">
                <div className="text-section">
                    <span className="legal-h1">Changes and updates</span>
                </div>
                <div className="text-section">
                    These AI Guidelines may evolve as the AI feature, applicable law (e.g. the EU AI
                    Act) or the underlying provider changes. I will revise the Guidelines whenever a
                    change is necessary and update the &quot;Last updated&quot; date at the top of
                    this page. Where a change materially affects your rights or the way your data is
                    processed, I will request your consent again in-app before AI Detection can be
                    used.
                </div>
            </section>
        </LegalLayout>
    );
}
