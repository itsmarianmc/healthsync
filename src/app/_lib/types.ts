export interface FoodEntry {
  id: string;
  food: string;
  brand?: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  weight?: number;
  amount?: number;
  unit?: string;
  emoji?: string;
  color?: string;
  ts: number;
  date: string;
  source?: string;
  isDrink?: boolean;
  isBarcode?: boolean;
  barcode?: string;
  status?: 'pending' | 'confirmed';
}

export interface PendingFoodDraft {
  id: string;
  food: FoodSearchResult;
  amount: number;
  unit: 'g' | 'ml' | 'pcs';
  ts: number;
}

export type DraftChange =
  | { type: 'create'; draft: PendingFoodDraft }
  | { type: 'delete'; draftId: string }
  | { type: 'update'; draftId: string; amount: number; unit: 'g' | 'ml' | 'pcs' };

export interface DrinkEntry {
  id: string;
  drink: string;
  emoji?: string;
  color?: string;
  amount: number;
  ts: number;
  date: string;
  source?: string;
}

export type ActivityStatusValue = 'active' | 'sick' | 'injured' | 'on_a_break';
export type StatusDurationValue = 'until_changed' | 'until_tomorrow' | '7_days' | '14_days' | 'custom';

export interface ActivityStatusRecord {
  status: ActivityStatusValue;
  duration: StatusDurationValue;
  customStartDate?: string | null;
  customEndDate?: string | null;
}

export interface UserSettings {
  user_id: string;
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
  goal_ml: number;
  creatine_goal?: number | null;
  magnesium_goal?: number | null;
  track_supplements?: boolean | null;
  weight_kg?: number | null;
  supplements_taken?: Record<string, Record<string, boolean>> | null;
  workout_routines?: WorkoutRoutines | null;
  status?: ActivityStatusRecord | null;
  updated_at?: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  gifUrl?: string;
  notes?: string;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  icon: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutRoutines {
  routines: WorkoutRoutine[];
  _updated_at?: string;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
  done: boolean;
}

export interface WorkoutSessionExercise {
  exerciseId: string;
  exerciseName: string;
  intensity?: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  routineId: string;
  routineName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  intensity?: string;
  exercises: WorkoutSessionExercise[];
}

export interface FoodSearchResult {
  name: string;
  brand?: string;
  kcalPer100: number;
  protPer100: number;
  carbPer100: number;
  fatPer100: number;
  satFatPer100?: number | null;
  sugarPer100?: number | null;
  saltPer100?: number | null;
  energyKj?: number;
  emoji?: string;
  color?: string;
  defaultUnit?: string;
  isLiquid?: boolean;
  servingSize?: number | null;
  isBarcode?: boolean;
  isManual?: boolean;
  isPrepared?: boolean;
  isFavourite?: boolean;
  barcode?: string;
}

export interface DashboardData {
  totalCal: number;
  totalWater: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  calGoal: number;
  waterGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
  calPercent: number;
  waterPercent: number;
  proteinPercent: number;
  score: number;
  entryCount: number;
  streak: number;
  lastEntryAgo: string;
  weekData: WeekDay[];
  recentEntries: RecentEntry[];
}

export interface WeekDay {
  date: Date;
  dateKey: string;
  label: string;
  calories: number;
  water: number;
  calPercent: number;
  waterPercent: number;
}

export interface RecentEntry {
  type: 'food' | 'drink';
  name: string;
  icon: string;
  color: string;
  amount: string;
  meta: string;
  ts: number;
  date: string;
}

export type View = 'dashboard' | 'calsync' | 'dropsync';
export type ModalState = 'closed' | 'open' | 'expanded';
