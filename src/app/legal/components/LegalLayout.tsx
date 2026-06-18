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
            <BackToTop />
        </div>
    );
}
