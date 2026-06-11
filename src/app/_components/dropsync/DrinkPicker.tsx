'use client';

interface DrinkOption {
  name: string;
  emoji: string;
  color: string;
}

const DRINK_OPTIONS: DrinkOption[] = [
  { name: 'Water', emoji: 'fa-solid fa-droplet', color: '#5AC8FA' },
  { name: 'Tea', emoji: 'fa-solid fa-mug-hot', color: '#C67C4E' },
  { name: 'Coffee', emoji: 'fa-solid fa-mug-hot', color: '#6F4E37' },
  { name: 'Juice', emoji: 'fa-solid fa-glass-citrus', color: '#FF9F0A' },
  { name: 'Milk', emoji: 'fa-solid fa-glass', color: '#F0F0F0' },
  { name: 'Sports Drink', emoji: 'fa-solid fa-dumbbell', color: '#30D158' },
  { name: 'Soda', emoji: 'fa-solid fa-bottle-water', color: '#FF6B6B' },
  { name: 'Smoothie', emoji: 'fa-solid fa-blender', color: '#BF5AF2' },
  { name: 'Beer', emoji: 'fa-solid fa-beer-mug-empty', color: '#F0C040' },
  { name: 'Wine', emoji: 'fa-solid fa-wine-glass', color: '#9B3A55' },
  { name: 'Protein Shake', emoji: 'fa-solid fa-dumbbell', color: '#E4840F' },
  { name: 'Other', emoji: 'fa-solid fa-droplet', color: '#8E8E93' },
];

interface DrinkPickerProps {
  selected: DrinkOption | null;
  onSelect: (drink: DrinkOption) => void;
}

export default function DrinkPicker({ selected, onSelect }: DrinkPickerProps) {
  return (
    <div id="ds-step1" className="modal-step active">
      <div className="drink-grid">
        {DRINK_OPTIONS.map(drink => (
          <div
            key={drink.name}
            className={`drink-option${selected?.name === drink.name ? ' selected' : ''}`}
            data-drink={drink.name}
            data-emoji={drink.emoji}
            data-color={drink.color}
            onClick={() => onSelect(drink)}
          >
            <div className="drink-option-icon">
              <i className={drink.emoji} style={{ color: drink.color }} />
            </div>
            <div className="drink-option-name">{drink.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { DrinkOption };
