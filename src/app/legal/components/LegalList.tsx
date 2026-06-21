import '@/app/legal/legal.css';

interface LegalListItem {
    label?: string;
    text: React.ReactNode;
}

interface LegalListProps {
    items: LegalListItem[];
}

export default function LegalList({ items }: LegalListProps) {
    return (
        <ul className="legal-list">
            {items.map((item, i) => (
                <li key={i}>
                    {item.label && <strong>{item.label}: </strong>}
                    {item.text}
                </li>
            ))}
        </ul>
    );
}
