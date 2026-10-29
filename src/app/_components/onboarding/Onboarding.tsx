'use client';

import React, { useState, useEffect, useRef } from 'react';
import { markTourPending } from '../../_lib/tour';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { useAuth } from '../../_context/AuthContext';
import { activeOwner, queueSettings } from '../../_lib/localData';
import { runCalc, type CalcFields } from '../../_lib/goalCalculator';
import GoalCalculator from '../settings/GoalCalculator';
import Notifications from '../notifications/Notifications';

const STORAGE_KEY = 'calsync_onboarding_done';

const SLIDES = [
    {
        icon: 'fa-solid fa-fire-flame-curved',
        title: <>Welcome to <span>HealthSync</span></>,
        desc: 'Track food, drinks and daily progress in one place. Start locally in your browser, then sync across devices if you choose to sign in.',
        features: [
            { icon: 'fa-solid fa-magnifying-glass', title: 'Search millions of foods, drinks and supplements', desc: 'Find any food by name from the Open Food Facts global database.' },
            { icon: 'fa-solid fa-bullseye', title: 'Personal calorie and hydration goals', desc: 'Calculate your individual goal using the Mifflin-St Jeor formula and hydration needs.' },
            { icon: 'fas fa-sparkles', title: 'AI Detection', desc: 'Take a photo of your meal or describe it and AI will scan your image and automatically extract all relevant information.' },
            { icon: 'fa-solid fa-chart-line', title: 'Everything in one place', desc: 'See all your intakes and progress on the home screen, without complex menus.' },
            { icon: 'fa-solid fa-cloud', title: 'Cloud sync', desc: 'Log in once, sync across all devices, never lose your data.' },
            { icon: 'fa-solid fa-palette', title: 'Customization', desc: '6 color themes available in Settings → Personalization.' },
            { icon: 'fa-solid fa-mobile-screen', title: 'Install as app', desc: 'Add the app to your homescreen for a better experience and faster access.' }
        ]
    },
    {
        icon: 'fas fa-file-contract',
        title: <>Additional <span>Notes</span></>,
        desc: 'Please read carefully before using HealthSync.',
        legal: true,
    },
    {
        icon: 'fa-solid fa-calculator',
        title: <>Let&apos;s set up HealthSync</>,
        desc: 'Enter your details below to calculate your daily calorie and hydration goals.',
        goal: true,
    },
    {
        icon: 'fa-solid fa-bell',
        title: <>Notifications</>,
        desc: 'A little heads-up. Always your choice.',
        notifications: true,
    },
    {
        icon: 'fas fa-rocket',
        title: <>You&apos;re all <span>set!</span></>,
        desc: 'Start tracking your calories right now. Enable the guided tour if you need a quick introduction.',
        last: true,
    }
];

interface OnboardingProps {
  onDone: () => void;
}

export default function Onboarding({ onDone }: OnboardingProps) {
    const [slide, setSlide] = useState(0);
    const [setupTour, setSetupTour] = useState(true);
    const [calcFields, setCalcFields] = useState<CalcFields>({ gender: 'female', activity: 'sedentary', goalType: 'maintain', hydrationClimate: 'mild' });
    const [calcWeight, setCalcWeight] = useState('');
    const [calcHeight, setCalcHeight] = useState('');
    const [calcAge, setCalcAge] = useState('');
    const { canUsePreferences } = useCookieConsent();
    const { user, retrySync } = useAuth();
    const calcResult = runCalc(calcFields, parseFloat(calcWeight), parseFloat(calcHeight), parseFloat(calcAge));
    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
    const prevSlideRef = useRef(-1);

    useEffect(() => {
        const currentEl = slideRefs.current[slide];
        if (!currentEl) return;

        if (prevSlideRef.current >= 0 && prevSlideRef.current !== slide) {
        const prevEl = slideRefs.current[prevSlideRef.current];
        if (prevEl) prevEl.classList.remove('slide-reset');
        }

        currentEl.classList.add('slide-reset');
        void currentEl.offsetHeight;
        currentEl.classList.remove('slide-reset');

        prevSlideRef.current = slide;
    }, [slide]);

    const SLIDE_COUNT = SLIDES.length;
    const isLast = slide === SLIDE_COUNT - 1;
    const isGoalStep = !!SLIDES[slide].goal;
    const isNotificationsStep = !!SLIDES[slide].notifications;

    const finish = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        if (setupTour) markTourPending();
        onDone();
    };

    const applyGoals = () => {
        if (!canUsePreferences || !calcResult) return;
        const values = {
            calsync_goal: calcResult.kcal,
            dropsync_goal: calcResult.hydration,
            calsync_goal_protein: calcResult.protein,
            calsync_goal_carbs: calcResult.carbs,
            calsync_goal_fat: calcResult.fat,
        };
        for (const [key, value] of Object.entries(values)) localStorage.setItem(key, String(value));
        window.dispatchEvent(new Event('storage'));
        if (user && activeOwner() === user.id) {
            queueSettings({
                calorie_goal: calcResult.kcal,
                goal_ml: calcResult.hydration,
                protein_goal: calcResult.protein,
                carbs_goal: calcResult.carbs,
                fat_goal: calcResult.fat,
            });
            void retrySync();
        }
        setSlide(SLIDES.findIndex(step => step.notifications));
    };

    return (
        <div className="onboarding-overlay" id="onboardingOverlay">
            <div className="onboarding-header">
                <div className="onboarding-header-left">
                <div className="onboarding-logo"><img src="/favicon.png" alt="HealthSync" /></div>
                <div className="onboarding-app-name">Health<span>Sync</span></div>
                </div>
                <button className="onboarding-login" id="onboardingLogin" onClick={() => {
                    localStorage.setItem(STORAGE_KEY, '1');
                    window.location.href = '/login/';
                }}>Login</button>
            </div>

            <div className="onboarding-progress" id="onboardingProgress">
                {Array.from({ length: SLIDE_COUNT }, (_, i) => (
                <div key={i} className={`onboarding-dot${i <= slide ? ' active' : ''}`} />
                ))}
            </div>

            <div className="onboarding-body">
                <div className="onboarding-slides" id="onboardingSlides" style={{ transform: `translateX(-${slide * 100}%)`, transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
                    {SLIDES.map((s, i) => (
                        <div key={i} className={`onboarding-slide${s.goal ? ' onboarding-slide--goal' : ''}${s.notifications ? ' onboarding-slide--notifications' : ''}`} inert={i !== slide} aria-hidden={i !== slide} ref={el => { slideRefs.current[i] = el; }}>
                            <div className="onboarding-slide-icon"><i className={s.icon} /></div>
                            <div className="onboarding-slide-title">{s.title}</div>
                            <div className="onboarding-slide-desc">{s.desc}</div>
                            {s.notifications && i === slide && <Notifications variant="onboarding" onEnabled={() => setSlide(SLIDE_COUNT - 1)} />}
                            {s.features && (
                                <div className="onboarding-feature-list">
                                {s.features.map((f, j) => (
                                    <div key={j} className="onboarding-feature">
                                    <div className="onboarding-feature-icon"><i className={f.icon} /></div>
                                    <div className="onboarding-feature-text"><strong>{f.title}</strong><span>{f.desc}</span></div>
                                    </div>
                                ))}
                                </div>
                            )}
                            {s.legal && (
                                <div className="onboarding-legal-list">
                                    <div className="onboarding-legal-links">
                                        <a href="https://healthsync.itsmarian.dev/legal/terms" className="onboarding-legal-link" target="_blank" rel="noopener">
                                        <i className="fa-solid fa-scale-balanced"></i>
                                        <span>Terms of Service</span>
                                        <svg height="14" viewBox="0 -960 960 960" width="14" fill="currentColor">
                                            <path d="M321-80 250-151l329-329-329-329 71-71 400 400L321-80Z"></path>
                                        </svg>
                                        </a>
                                        <a href="https://healthsync.itsmarian.dev/legal/privacy" className="onboarding-legal-link" target="_blank" rel="noopener">
                                        <i className="fa-solid fa-shield-halved"></i>
                                        <span>Privacy Policy</span>
                                        <svg height="14" viewBox="0 -960 960 960" width="14" fill="currentColor">
                                            <path d="M321-80 250-151l329-329-329-329 71-71 400 400L321-80Z"></path>
                                        </svg>
                                        </a>
                                    </div>
                                    <div className="onboarding-legal-text">
                                        <h3>About Your Hydration & Calorie Goal</h3>
                                        <p>The displayed values are for informational purposes only and are calculated based on standardized algorithms and general health guidelines. These calculations serve as approximate guidelines and should not be considered as definitive medical advice.</p>
                                        <p>Individual hydration and calorie needs can vary significantly based on multiple factors including but not limited to: body weight, height, physical activity level, age, gender, climate conditions, medical conditions, medications, and overall health status. Environmental factors such as temperature, humidity, and altitude may also affect daily fluid requirements as well as daily calorie needs.</p>
                                        <p>The provided values represent statistical averages and may need adjustment based on your specific circumstances. For personalized hydration and nutrition recommendations, especially if you have underlying health conditions or specific dietary requirements, please consult with a qualified healthcare provider or registered dietitian.</p>
                                        <p>Use is at your own risk. No liability is accepted for damage to health that may arise from errors in the calculation.</p>
                                        <p>HealthSync stores your hydration data locally on your device. If you choose to create an account, this data may optionally be stored in a secure cloud database provided by Supabase. HealthSync does not sell, share, or otherwise monetize your personal data under any circumstances. You may permanently delete all of your data at any time via the Settings menu. Authentication is implemented using email and password credentials; only your user ID and email address are retained for the purpose of account identification. For more information, please refer to our <a href="https://healthsync.itsmarian.dev/legal/privacy" target="_blank"><strong>Privacy Policy</strong></a>.</p>
                                    </div>
                                    <div className="ai-meal-scanning">
                                        <h3>About AI and Meal Scanning</h3>
                                        <p>Nutrition values generated by AI are <strong>automated estimates</strong> based on image recognition and machine learning. Results may differ significantly from actual product values.</p>
                                        <p>Portion size, preparation method, hidden ingredients, sauces, oils, and brand variations can cause inaccurate calorie and macronutrient estimations.</p>
                                        <p>All AI-powered nutrition estimates - text or image-based - are processed by Google&apos;s Gemini API using your personal API key (set in **Settings**). Results may differ significantly from actual product values.</p>

                                        <p>By using this feature, you agree to <a href="https://healthsync.itsmarian.dev/legal/ai-guidelines" target="_blank" rel="noopener"><strong>HealthSync&apos;s AI Guidelines</strong></a> and to use it at your own risk and verify any nutrition data against trusted sources before relying on it.</p>
                                        <p>No data or image is processed locally - every call goes directly to Google&apos;s Gemini API with your personal key stored in the browser.</p><br/>                                        <p>API usage may generate costs based on Google&apos;s current pricing model. HealthSync does not monitor, cap, reimburse, or assume responsibility for any API charges incurred.</p>
                                        <p>Rate limits, service interruptions, quota restrictions, or API changes imposed by Google may affect functionality. HealthSync has no control over external API availability.</p>
                                        <p>HealthSync does not store your API key on external servers unless explicitly stated. If stored locally in your browser or device, you are responsible for its security.</p>
                                        <p>The AI may misidentify foods, underestimate or overestimate calories, or provide incomplete macronutrient information.</p>
                                        <p>Always verify nutrition information using official product packaging, restaurant data, or trusted nutrition databases.</p>
                                        <p>This feature is provided for convenience only and is <strong>not a medical, nutritional, or professional health service</strong>.</p>
                                        <p>Do not rely solely on AI-generated values for medical conditions, weight management programs, allergies, diabetes management, or other dietary decisions.</p>
                                        <p>HealthSync assumes no liability for inaccuracies, financial costs, health outcomes, or damages resulting from the use of AI-based nutrition detection.</p>
                                    </div>
                                    <p className="onboarding-legal-agree">By continuing, you confirm that you have read and agree to the Terms of Service and acknowledge the Privacy Policy as well as the AI and Meal Scanning disclosures.</p>
                                </div>
                            )}
                            {s.goal && <div className="onboarding-goal-setup">
                                <GoalCalculator fields={calcFields} weight={calcWeight} height={calcHeight} age={calcAge} result={calcResult}
                                    onFieldChange={(key, value) => setCalcFields(current => ({ ...current, [key]: value }))}
                                    onWeightChange={setCalcWeight} onHeightChange={setCalcHeight} onAgeChange={setCalcAge}
                                    actions={() => null} />
                                {!canUsePreferences && <p className="onboarding-goal-consent" role="status">Saving goals requires Preferences consent. You can change it in the cookie settings later, or skip this step and set goals in Settings.</p>}
                                {calcResult && <button type="button" className="onboarding-apply-btn" id="onboardingApplyGoals" disabled={!canUsePreferences} onClick={applyGoals}>Apply goals</button>}
                            </div>}
                            {s.last && (
                                <div className="onboarding-feature-list">
                                    <div className="onboarding-feature">
                                        <div className="onboarding-feature-icon clickable">
                                        <input type="checkbox" id="onboardingSetupCheckbox" checked={setupTour} onChange={e => setSetupTour(e.target.checked)} aria-label="Enable guided tour" />
                                        <span className="checkbox-custom" />
                                        </div>
                                        <div className="onboarding-feature-text"><strong>Start with setup?</strong><span>Enable the guided tour to learn all key features.</span></div>
                                    </div>
                                    <div className="onboarding-feature">
                                        <div className="onboarding-feature-icon"><i className="fa-solid fa-dollar" /></div>
                                        <div className="onboarding-feature-text"><strong>Enjoying this project?</strong><span>If you enjoy this app you can <a href="https://ko-fi.com/itsmarian" target="_blank" rel="noopener">support me</a>.</span></div>
                                    </div>
                                    <div className="onboarding-feature">
                                        <div className="onboarding-feature-icon"><i className="fa-solid fa-hands-holding-heart" /></div>
                                        <div className="onboarding-feature-text"><strong>Thank you for using HealthSync!</strong><span>I hope you enjoy this app and if you encounter any errors or bugs, you can <a href="https://github.com/itsmarianmc/healthsync/issues" target="_blank" rel="noopener">report them on GitHub</a>.</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="onboarding-footer">
                <button type="button" className={`onboarding-back-btn${slide === 0 ? ' btn-hidden' : ''}`} id="onboardingBack" aria-label="Previous step" disabled={slide === 0} onClick={() => setSlide(s => Math.max(0, s - 1))}>
                    <svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z"/></svg>
                </button>
                <button type="button" className="onboarding-next-btn" id="onboardingNext" aria-label={isLast ? "Let's go!" : isGoalStep ? 'Skip for Now' : isNotificationsStep ? 'Not now' : 'Next step'} onClick={() => { if (isLast) finish(); else setSlide(s => s + 1); }}>
                    {isLast ? "Let's go!" : <>{isGoalStep ? 'Skip for Now' : isNotificationsStep ? 'Not now' : ''}<svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor" aria-hidden="true"><path d="M321-80 250-151l329-329-329-329 71-71 400 400L321-80Z"/></svg></>}
                </button>
            </div>
        </div>
    );
}
