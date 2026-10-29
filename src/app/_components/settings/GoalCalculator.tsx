'use client';

import React from 'react';
import type { CalcFields, CalcResult } from '../../_lib/goalCalculator';

interface GoalCalculatorProps {
    fields: CalcFields;
    weight: string;
    height: string;
    age: string;
    result: CalcResult | null;
    onFieldChange: (key: string, value: string) => void;
    onWeightChange: (value: string) => void;
    onHeightChange: (value: string) => void;
    onAgeChange: (value: string) => void;
    actions: (result: CalcResult) => React.ReactNode;
}

function OptionGroup({ id, value, options, onChange }: { id: string; value: string; options: { label: string; value: string }[]; onChange: (value: string) => void }) {
    return <div className="option-group" id={id} role="group" aria-label={id === 'calcGender' ? 'Gender' : id === 'calcActivity' ? 'Activity Level' : id === 'calcGoalType' ? 'Goal' : 'Climate'}>
        {options.map(option => <button key={option.value} type="button" className={`option-btn${value === option.value ? ' active' : ''}`} data-val={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>;
}

export default function GoalCalculator({ fields, weight, height, age, result, onFieldChange, onWeightChange, onHeightChange, onAgeChange, actions }: GoalCalculatorProps) {
    return <div className="goal-calculator">
        <div className="form-row"><label className="form-label" htmlFor="calcWeight"><i className="fa-solid fa-weight-scale" /> Body weight (kg)</label><input className="form-input" id="calcWeight" type="number" min={20} max={300} placeholder="e.g. 70" inputMode="decimal" value={weight} onChange={e => onWeightChange(e.target.value)} /></div>
        <div className="form-row"><label className="form-label" htmlFor="calcHeight"><i className="fa-solid fa-ruler" /> Height (cm)</label><input className="form-input" id="calcHeight" type="number" min={100} max={250} placeholder="e.g. 170" inputMode="numeric" value={height} onChange={e => onHeightChange(e.target.value)} /></div>
        <div className="form-row"><label className="form-label" htmlFor="calcAge"><i className="fa-solid fa-cake-candles" /> Age</label><input className="form-input" id="calcAge" type="number" min={10} max={100} placeholder="e.g. 25" inputMode="numeric" value={age} onChange={e => onAgeChange(e.target.value)} /></div>
        <div className="form-row"><div className="form-label"><i className="fa-solid fa-venus-mars" /> Gender</div><OptionGroup id="calcGender" value={fields.gender} options={[{label:'Female',value:'female'},{label:'Male',value:'male'}]} onChange={value => onFieldChange('gender', value)} /></div>
        <div className="form-row"><div className="form-label"><i className="fa-solid fa-person-walking" /> Activity Level</div><OptionGroup id="calcActivity" value={fields.activity} options={[{label:'Sedentary',value:'sedentary'},{label:'Light',value:'light'},{label:'Moderate',value:'moderate'},{label:'Active',value:'active'},{label:'Very Active',value:'very_active'}]} onChange={value => onFieldChange('activity', value)} /></div>
        <div className="form-row"><div className="form-label"><i className="fa-solid fa-chart-line" /> Goal</div><OptionGroup id="calcGoalType" value={fields.goalType} options={[{label:'Maintain',value:'maintain'},{label:'Lose weight',value:'lose'},{label:'Gain weight',value:'gain'}]} onChange={value => onFieldChange('goalType', value)} /></div>
        <div className="form-row"><div className="form-label"><i className="fa-solid fa-temperature-low" /> Climate</div><OptionGroup id="hydrationClimate" value={fields.hydrationClimate} options={[{label:'Cool',value:'cool'},{label:'Mild',value:'mild'},{label:'Warm',value:'warm'},{label:'Hot',value:'hot'}]} onChange={value => onFieldChange('hydrationClimate', value)} /></div>
        {result && <>
            <div className="result-row" id="calcResultRow">
                <div className="result-label">Recommended daily calories</div>
                <div className="result-value" id="calcResultVal">{result.kcal} kcal</div>
                <div className="macro-suggest-box">
                    <div className="macro-suggest-title"><i className="fa-solid fa-chart-simple" /> Suggested macros (30 / 40 / 30 split)</div>
                    <div className="macro-suggest-grid">
                        <div className="macro-suggest-item"><div className="macro-suggest-value" id="calcSuggestProtein" style={{ color:'#30D158' }}>{result.protein}g</div><div className="macro-suggest-label">Protein</div></div>
                        <div className="macro-suggest-item"><div className="macro-suggest-value" id="calcSuggestCarbs" style={{ color:'#FFD60A' }}>{result.carbs}g</div><div className="macro-suggest-label">Carbs</div></div>
                        <div className="macro-suggest-item"><div className="macro-suggest-value" id="calcSuggestFat" style={{ color:'#FF6B35' }}>{result.fat}g</div><div className="macro-suggest-label">Fat</div></div>
                    </div>
                </div>
            </div>
            <div className="result-row" id="hydrationResultRow" style={{ marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                <div className="result-label"><i className="fa-solid fa-droplet" /> Recommended daily hydration</div>
                <div className="result-value" id="hydrationResultVal" style={{ color:'#5AC8FA' }}>{result.hydration} ml</div>
            </div>
            {actions(result)}
        </>}
    </div>;
}
