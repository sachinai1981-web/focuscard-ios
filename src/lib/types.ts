export const taskColorOptions = [
  'green',
  'orange',
  'red',
] as const;

export type TaskColor = (typeof taskColorOptions)[number];
export type TaskEndState = 'complete' | 'carryover';

export type FocusTask = {
  id: string;
  title: string;
  start: number;
  end: number;
  color: TaskColor;
  endState: TaskEndState;
};

export type FocusDayRecord = {
  date: string;
  tasks: FocusTask[];
  notes: string;
};

export type FocusPlannerStore = {
  activeDate: string;
  records: FocusDayRecord[];
};
