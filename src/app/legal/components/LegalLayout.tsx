import BackToTop from './BackToTop';
import LegalScroller from './LegalScroller';
import '@/app/legal/legal.css';

interface LegalLayoutProps {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, eyebrow = 'HealthSync', children }: LegalLayoutProps) {
    return (
        <div className="legal-page">
            <LegalScroller />
            <main className="main">
                <section className="section" id="header-information">
                    <div className="legal-header">
                        {eyebrow && <span className="legal-eyebrow">{eyebrow}</span>}
                        <h1>{title}</h1>
                    </div>
                </section>
                {children}
            </main>
            <footer className="settings-legal">
                <div className="settings-legal-footer">
                    <table style={{ borderCollapse: 'collapse', margin: '2rem 0', tableLayout: 'fixed', width: '100%' }}>
                        <tbody>
                            <tr>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle', width: '47.5%' }}>
                                <a className="link" href="https://github.com/itsmarianmc/healthsync" target="_blank" rel="noopener">
                                <img height={42.5} alt="GitHub" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/available/github_vector.svg" />
                                </a>
                            </td>
                            <td style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', verticalAlign: 'middle', width: '52.5%' }}>
                                <a className="link" href="https://ko-fi.com/itsmarian" target="_blank" rel="noopener">
                                <img height={42.5} alt="Ko-fi" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/donate/kofi-singular_vector.svg" />
                                </a>
                            </td>
                            </tr>
                        </tbody>
                    </table>
                    <div>
                        <p>
                            <a href="https://healthsync.itsmarian.dev/legal/ai-guidelines">AI Guidelines</a> • <a href="https://contact.itsmarian.dev/">Contact</a> • <a href="https://healthsync.itsmarian.dev/legal/cookies">Cookies</a> • <a href="https://healthsync.itsmarian.dev/legal/privacy">Privacy Policy</a> • <a href="https://healthsync.itsmarian.dev/legal/terms">Terms of Use</a>
                        </p>
                        <p className="change-settings">Change Cookie Preferences</p>
                        <p style={{ marginTop: 'calc(-7.5px + 1rem)' }}>© 2026 itsmarian | All rights reserved!</p>
                    </div>
                </div>
            </footer>
            <BackToTop />
        </div>
    );
}
