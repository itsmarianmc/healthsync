'use client';

interface MacroGridProps {
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  macroGoals: { protein: number; carbs: number; fat: number };
}

interface MacroCardProps {
  name: string;
  label: string;
  value: number;
  goal: number;
  color: string;
  icon: string;
  idPrefix: string;
}

function MacroCard({ name, label, value, goal, color, icon, idPrefix }: MacroCardProps) {
  const pct = goal > 0 ? Math.max(0, Math.min(100, (value / goal) * 100)) : 0;
  const goalText = goal > 0 ? `${Math.round(value)} / ${goal} g` : 'No goal';
  return (
    <div className="dashboard-macro-card" style={{ '--macro-color': color } as React.CSSProperties}>
      <div className="dashboard-macro-top"><i className={icon} /><span>{label}</span></div>
      <div className="dashboard-macro-value"><span id={`dashboard${name}`}>{Math.round(value)}</span> g</div>
      <div className="dashboard-macro-goal" id={`dashboard${name}Goal`}>{goalText}</div>
      <div className="dashboard-macro-track">
        <div id={`dashboard${name}Progress`} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

export default function MacroGrid({ totalProtein, totalCarbs, totalFat, macroGoals }: MacroGridProps) {
  const totalMacro = Math.round(totalProtein + totalCarbs + totalFat);
  return (
    <>
      <div className="dashboard-section-head">
        <span>Macros</span>
        <small id="dashboardMacroSummary">{totalMacro} g total</small>
      </div>
      <div className="dashboard-macro-grid" id="dashboardMacroGrid">
        <MacroCard name="Protein" label="Protein" value={totalProtein} goal={macroGoals.protein} color="#30D158" icon="fa-solid fa-dumbbell" idPrefix="protein" />
        <MacroCard name="Carbs" label="Carbs" value={totalCarbs} goal={macroGoals.carbs} color="#FFD60A" icon="fa-solid fa-wheat-awn" idPrefix="carbs" />
        <MacroCard name="Fat" label="Fat" value={totalFat} goal={macroGoals.fat} color="#FF6B35" icon="fa-solid fa-oil-can" idPrefix="fat" />
      </div>
    </>
  );
}
