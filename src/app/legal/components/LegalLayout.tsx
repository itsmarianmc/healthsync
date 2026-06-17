import BackToTop from './BackToTop';
import '@/app/legal/legal.css';

interface LegalLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, children }: LegalLayoutProps) {
    return (
        <>
            <main className="main">
                <section className="section" id="header-information">
                <div className="legal-header">
                    <h1>{title}</h1>
                </div>
                </section>
                {children}
            </main>
            <BackToTop />
        </>
    );
}
