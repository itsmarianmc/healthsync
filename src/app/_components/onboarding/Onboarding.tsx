'use client';

import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'calsync_onboarding_done';

const SLIDES = [
  {
    icon: 'fa-solid fa-fire-flame-curved',
    title: <>Welcome to <span>HealthSync</span></>,
    desc: 'Your personal health tracker in your browser. Log every meal and drink, hit your daily goal, and stay on track - simple, beautiful and privacy focused.',
    features: [
      { icon: 'fa-solid fa-magnifying-glass', title: 'Search millions of foods, drinks and supplements', desc: 'Find any food by name from the Open Food Facts global database.' },
      { icon: 'fa-solid fa-bullseye', title: 'Personal calorie and hydration goals', desc: 'Calculate your individual goal using the Mifflin-St Jeor formula.' },
      { icon: 'fas fa-sparkles', title: 'AI Detection', desc: 'Take a photo of your meal and AI will extract all relevant nutritional information.' },
      { icon: 'fa-solid fa-cloud', title: 'Cloud sync', desc: 'Log in once, sync across all devices, never lose your data.' },
      { icon: 'fa-solid fa-palette', title: 'Customization', desc: '6 color themes available in Settings → Personalization.' },
    ]
  },
  {
    icon: 'fa-solid fa-barcode',
    title: <>Log <span>Food</span></>,
    desc: 'Tap the + button to add food. Search by name, enter or scan a barcode number to instantly pull nutritional data.',
    features: [
      { icon: 'fas fa-check-square', title: 'Step 1 - Set your food type', desc: 'Select the meal category: Breakfast, Lunch, Dinner, Snack, Drink, or Fruit.' },
      { icon: 'fa-solid fa-magnifying-glass', title: 'Step 2 - Search, Enter or Scan', desc: 'Type a food name, enter or scan a barcode, or use AI to analyze your meal.' },
      { icon: 'fa-solid fa-weight-scale', title: 'Step 3 - Set amount', desc: 'Enter weight in grams/ml or pieces. Calories are calculated automatically.' },
      { icon: 'fa-solid fa-check', title: 'Step 4 - Confirm', desc: 'Save the entry to your daily log.' },
    ]
  },
  {
    icon: 'fas fa-plus',
    title: <>Log a <span>Drink</span></>,
    desc: 'Tap the + button to add a drink. Choose the type, then set the amount by dragging the glass or using quick presets.',
    features: [
      { icon: 'fa-solid fa-hand-pointer', title: 'Step 1 - Pick a drink', desc: 'Select your drink from 12 different categories.' },
      { icon: 'fa-solid fa-arrows-up-down', title: 'Step 2 - Set the amount', desc: 'Drag the glass or use quick-select buttons.' },
      { icon: 'fa-solid fa-check', title: 'Step 3 - Confirm', desc: 'Save the entry.' },
    ]
  },
  {
    icon: 'fa-solid fa-bullseye',
    title: <>Your Daily <span>Goal</span></>,
    desc: 'On the main screen, you\'ll see widgets showing your progress towards various health goals.',
    features: [
      { icon: 'fa-solid fa-calculator', title: 'Goal calculator', desc: 'Mifflin-St Jeor formula - enter weight, height, age, activity and goal type.' },
      { icon: 'fa-solid fa-glass-water', title: 'Hydration tracking', desc: 'Monitor your daily water intake and stay hydrated.' },
      { icon: 'fa-solid fa-chart-pie', title: 'Macro tracking', desc: 'See protein, carbs and fat for every logged item.' },
      { icon: 'fa-solid fa-clock-rotate-left', title: 'Full history', desc: 'Review all past entries in one place.' },
    ]
  },
  {
    icon: 'fas fa-file-contract',
    title: <>Additional <span>Notes</span></>,
    desc: 'Please read carefully before using HealthSync.',
    legal: true,
  },
  {
    icon: 'fas fa-rocket',
    title: <>You&apos;re all <span>set!</span></>,
    desc: 'Start tracking your calories right now.',
    last: true,
  },
];

interface OnboardingProps {
  onDone: () => void;
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const [slide, setSlide] = useState(0);
  const [setupTour, setSetupTour] = useState(true);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevSlideRef = useRef(-1);

  useEffect(() => {
    const el = slideRefs.current[slide];
    if (!el) return;
    if (prevSlideRef.current >= 0 && prevSlideRef.current !== slide) {
      const prevEl = slideRefs.current[prevSlideRef.current];
      if (prevEl) prevEl.classList.remove('slide-entering');
    }
    el.classList.remove('slide-entering');
    void el.offsetHeight; // force reflow to re-trigger animation
    el.classList.add('slide-entering');
    prevSlideRef.current = slide;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  const SLIDE_COUNT = SLIDES.length;
  const isLast = slide === SLIDE_COUNT - 1;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    onDone();
    if (setupTour) {
      startTooltipTour([
        { elementId: 'bottomNav', message: 'The bottom navigation bar allows you to easily switch between the Dashboard, the Food Section, and the Hydration section.', progress: '1/8', buttonText: 'Next' },
        { elementId: 'extraActionBtn', message: 'The Quick Add button gives you instant access to add a new food or beverage entry from anywhere in the app.', progress: '2/8', buttonText: 'Next' },
        { elementId: 'db-openSettingsBtn', message: 'The Settings menu allows you to manage your data, set goals, and customise the app.', progress: '3/8', buttonText: 'Next' },
        { elementId: 'quickAddCal', message: 'This button opens the food logging dialogue where you can search, scan barcodes, or enter manually.', progress: '4/8', buttonText: 'Next' },
        { elementId: 'quickAddWater', message: 'This button launches the DropSync dialogue to quickly log a beverage.', progress: '5/8', buttonText: 'Next' },
        { elementId: 'dashboardMetricGrid', message: 'Here you see your daily progress for calories and hydration as progress bars.', progress: '6/8', buttonText: 'Next' },
        { elementId: 'dashboardMacroGrid', message: 'Here your macronutrients - protein, carbs and fat - are displayed clearly.', progress: '7/8', buttonText: 'Next' },
        { elementId: 'dashboardWeekCard', message: 'This card shows an overview of your last seven days of calorie and water intake.', progress: '8/8', buttonText: 'Got it!' },
      ]);
    }
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
          window.location.href = '/login/?signinginto=healthsync';
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
            <div key={i} className="onboarding-slide" ref={el => { slideRefs.current[i] = el; }}>
              <div className="onboarding-slide-icon"><i className={s.icon} /></div>
              <div className="onboarding-slide-title">{s.title}</div>
              <div className="onboarding-slide-desc">{s.desc}</div>
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
                <div className="onboarding-slide">
					<div className="onboarding-legal-list">
						<div className="onboarding-legal-links">
							<a href="https://itsmarian.dev/legal/terms" className="onboarding-legal-link" target="_blank" rel="noopener">
								<i className="fa-solid fa-scale-balanced"></i>
								<span>Terms of Service</span>
								<svg height="14" viewBox="0 -960 960 960" width="14" fill="currentColor">
									<path d="M321-80 250-151l329-329-329-329 71-71 400 400L321-80Z"></path>
								</svg>
							</a>
							<a href="https://itsmarian.dev/legal/privacy" className="onboarding-legal-link" target="_blank" rel="noopener">
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
							<p>HealthSync stores your hydration data locally on your device. If you choose to create an account, this data may optionally be stored in a secure cloud database provided by Supabase. HealthSync does not sell, share, or otherwise monetize your personal data under any circumstances. You may permanently delete all of your data at any time via the Settings menu. Authentication is implemented using email and password credentials; only your user ID and email address are retained for the purpose of account identification. For more information, please refer to our <a href="https://itsmarian.dev/legal/privacy" target="_blank"><strong>Privacy Policy</strong></a>.</p>
						</div>
						<div className="ai-meal-scanning">
							<h3>About AI and Meal Scanning</h3>
							<p>Nutrition values generated by AI are <strong>automated estimates</strong> based on image recognition and machine learning. Results may differ significantly from actual product values.</p>
							<p>Portion size, preparation method, hidden ingredients, sauces, oils, and brand variations can cause inaccurate calorie and macronutrient estimations.</p>
							<p>You are fully responsible for obtaining, securing, and managing your own Google Gemini API key. Never share your API key and API keys from others publicly and set a usage limit (to avoid misusage and a high bill if you are using a paid Gemini Plan for this API Key).</p>
							<p>By using this feature, you agree to comply with <a href="https://ai.google.dev/gemini-api/terms" target="_blank"><strong>Google's Gemini API Terms of Service</strong></a>, <a href="https://cloud.google.com/terms" target="_blank"><strong>Google Cloud Terms</strong></a>, and any applicable usage policies published by Google.</p>
							<p>Your images and prompts are transmitted directly to Google's servers for processing. This may involve international data transfer depending on Google's infrastructure.</p>
							<p>Google may process submitted data according to its Privacy Policy and AI service documentation. Please review Google's privacy practices before using this feature.</p>
							<p>API usage may generate costs based on Google's current pricing model. HealthSync does not monitor, cap, reimburse, or assume responsibility for any API charges incurred.</p>
							<p>Rate limits, service interruptions, quota restrictions, or API changes imposed by Google may affect functionality. HealthSync has no control over external API availability.</p>
							<p>HealthSync does not store your API key on external servers unless explicitly stated. If stored locally in your browser or device, you are responsible for its security.</p>
							<p>The AI may misidentify foods, underestimate or overestimate calories, or provide incomplete macronutrient information.</p>
							<p>Always verify nutrition information using official product packaging, restaurant data, or trusted nutrition databases.</p>
							<p>This feature is provided for convenience only and is <strong>not a medical, nutritional, or professional health service</strong>.</p>
							<p>Do not rely solely on AI-generated values for medical conditions, weight management programs, allergies, diabetes management, or other dietary decisions.</p>
							<p>HealthSync assumes no liability for inaccuracies, financial costs, health outcomes, or damages resulting from the use of AI-based nutrition detection.</p>
						</div>
						<p className="onboarding-legal-agree">By tapping "Let's go!" you confirm that you have read and agree to the Terms of Service and acknowledge the Privacy Policy as well as the AI and Meal Scanning disclosures.</p>
					</div>
				</div>
              )}
              {s.last && (
                <div className="onboarding-feature-list">
                  <div className="onboarding-feature">
                    <div className="onboarding-feature-icon clickable">
                      <input type="checkbox" id="onboardingSetupCheckbox" checked={setupTour} onChange={e => setSetupTour(e.target.checked)} />
                      <span className="checkbox-custom" />
                    </div>
                    <div className="onboarding-feature-text"><strong>Start with setup?</strong><span>Enable the guided tour to learn all key features.</span></div>
                  </div>
                  <div className="onboarding-feature">
                    <div className="onboarding-feature-icon"><i className="fa-solid fa-dollar" /></div>
                    <div className="onboarding-feature-text"><strong>Enjoying this project?</strong><span>If you enjoy this app you can <a href="https://ko-fi.com/itsmarian" target="_blank" rel="noopener">support me</a>.</span></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="onboarding-footer">
        <button className={`onboarding-back-btn${slide === 0 ? ' btn-hidden' : ''}`} id="onboardingBack" onClick={() => setSlide(s => Math.max(0, s - 1))}>
          <svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z"/></svg>
        </button>
        <button className="onboarding-next-btn" id="onboardingNext" onClick={() => { if (isLast) finish(); else setSlide(s => s + 1); }}>
          {isLast ? "Let's go!" : <svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M321-80 250-151l329-329-329-329 71-71 400 400L321-80Z"/></svg>}
        </button>
      </div>
    </div>
  );
}

/* tooltip tour — same logic as the original tooltip.js */
function startTooltipTour(steps: { elementId: string; message: string; progress: string; buttonText: string }[]) {
  let i = 0;
  function show(idx: number) {
    if (idx >= steps.length) return;
    const s = steps[idx];
    const el = document.getElementById(s.elementId);
    if (!el) { show(idx + 1); return; }
    const isLast = idx === steps.length - 1;
    window.dispatchEvent(new CustomEvent('__showTooltip', {
      detail: {
        elementId: s.elementId,
        message: s.message,
        progress: s.progress,
        buttonText: isLast ? (s.buttonText || 'Done') : (s.buttonText || 'Next'),
        onNext: () => { i = idx + 1; setTimeout(() => show(i), 300); }
      }
    }));
  }
  show(i);
}
