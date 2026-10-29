export type CalcFields = { gender: string; activity: string; goalType: string; hydrationClimate: string };

export function runCalc(fields: CalcFields, w: number, h: number, age: number) {
    if (!w || !h || !age) return null;
    const bmr = fields.gender === 'male' ? 10*w + 6.25*h - 5*age + 5 : 10*w + 6.25*h - 5*age - 161;
    const actMap: Record<string, number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
    let tdee = bmr * (actMap[fields.activity] || 1.2);
    if (fields.goalType === 'lose') tdee -= 500; else if (fields.goalType === 'gain') tdee += 500;
    const kcal = Math.round(tdee);
    const protein = Math.round(kcal * 0.30 / 4);
    const carbs   = Math.round(kcal * 0.40 / 4);
    const fat     = Math.round(kcal * 0.30 / 9);
    let hydration = w * 24.33333333333333;
    if (fields.gender === 'male') hydration += 150;
    if (fields.gender === 'pregnant') hydration += 300;
    if (fields.gender === 'breastfeeding') hydration += 700;
    const actHyd: Record<string,number> = { light:150, moderate:300, active:700, very_active:700 };
    hydration += (actHyd[fields.activity] || 0);
    const climateAdd: Record<string,number> = { cool:0, mild:200, warm:450, hot:650 };
    hydration += (climateAdd[fields.hydrationClimate] || 0);
    return { kcal, protein, carbs, fat, hydration: Math.round(hydration) };
}

export type CalcResult = NonNullable<ReturnType<typeof runCalc>>;
