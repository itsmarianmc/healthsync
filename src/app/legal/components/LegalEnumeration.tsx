import '@/app/legal/legal.css';

interface EnumerationItem {
    index: string;
    text: React.ReactNode;
}

interface LegalEnumerationProps {
    items: EnumerationItem[];
    sub?: boolean;
}

export default function LegalEnumeration({ items, sub = false }: LegalEnumerationProps) {
    const wrapper = sub ? 'legal-subcontent' : 'legal-text-enumerations';
    return (
        <div className={wrapper}>
            {items.map((item, i) => (
                <div key={i} className="legal-text-enumeration-line">
                    <span className="legal-text-enumeration-left">{item.index}</span>
                    <span className="legal-text-enumeration-right">{item.text}</span>
                </div>
            ))}
        </div>
    );
}
