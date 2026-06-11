'use client';

interface ManualEntryProps {
  onChange: (vals: { kcal: number; protein: number; carbs: number; fat: number }) => void;
  values: { kcal: number; protein: number; carbs: number; fat: number };
}

export default function ManualEntry({ onChange, values }: ManualEntryProps) {
  const handle = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value.replace(',', '.')) || 0;
    onChange({ ...values, [field]: v });
  };

  return (
    <div className="manual-nutrients" id="manualNutrients">
      <div className="manual-nutrients-title">Nährwerte pro 100 g/ml</div>
      <div className="manual-nutrients-grid">
        <div className="manual-nutrient-item">
          <label>Kalorien (kcal)</label>
          <input type="number" id="manualKcal" className="form-input" value={values.kcal} min="0" step="0.1" inputMode="decimal" onChange={handle('kcal')} />
        </div>
        <div className="manual-nutrient-item">
          <label>Protein (g)</label>
          <input type="number" id="manualProtein" className="form-input" value={values.protein} min="0" step="0.1" inputMode="decimal" onChange={handle('protein')} />
        </div>
        <div className="manual-nutrient-item">
          <label>Kohlenhydrate (g)</label>
          <input type="number" id="manualCarbs" className="form-input" value={values.carbs} min="0" step="0.1" inputMode="decimal" onChange={handle('carbs')} />
        </div>
        <div className="manual-nutrient-item">
          <label>Fett (g)</label>
          <input type="number" id="manualFat" className="form-input" value={values.fat} min="0" step="0.1" inputMode="decimal" onChange={handle('fat')} />
        </div>
      </div>
    </div>
  );
}
