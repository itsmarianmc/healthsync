import '@/app/legal/legal.css';

interface LegalSectionProps {
    id?: string;
    heading?: string;
    subheading?: string;
    children: React.ReactNode;
    card?: boolean;
}

export default function LegalSection({
    id,
    heading,
    subheading,
    children,
    card = false,
}: LegalSectionProps) {
    return (
        <section className="section" id={id}>
            {heading && (
                <div className="text-section header-section">
                    <h2>{heading}</h2>
                </div>
            )}
            {card ? (
                <div className="legal-section">
                    {subheading && <span className="legal-h2">{subheading}</span>}
                    {children}
                </div>
            ) : (
                <div className="text-section">
                    {subheading && <span className="legal-h2">{subheading}</span>}
                    {children}
                </div>
            )}
        </section>
    );
}
