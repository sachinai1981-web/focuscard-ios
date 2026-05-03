import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { EditTaskSheet } from './src/components/EditTaskSheet';
import { TimeRail } from './src/components/TimeRail';
import {
  clampToTimeline,
  clampToTimelineBoundary,
  formatClockTime,
  formatDuration,
  getDurationMinutes,
  LAST_START_OFFSET,
  MINUTES_PER_SLOT,
  offsetFromClock,
  TIMELINE_DURATION_MINUTES,
} from './src/lib/time';
import { fonts, palette, taskPalette } from './src/lib/theme';
import type {
  FocusDayRecord,
  FocusPlannerStore,
  FocusTask,
  TaskColor,
  TaskEndState,
} from './src/lib/types';

const initialTasks: FocusTask[] = [
  {
    id: 'task-1',
    title: 'Blog post',
    start: offsetFromClock(5, 0),
    end: offsetFromClock(5, 45),
    color: 'green',
    endState: 'complete',
  },
  {
    id: 'task-2',
    title: 'Venture fund',
    start: offsetFromClock(9, 45),
    end: offsetFromClock(11, 0),
    color: 'orange',
    endState: 'carryover',
  },
  {
    id: 'task-3',
    title: 'Learn 5 concepts',
    start: offsetFromClock(11, 30),
    end: offsetFromClock(13, 0),
    color: 'orange',
    endState: 'complete',
  },
  {
    id: 'task-4',
    title: 'Walk / break',
    start: offsetFromClock(16, 0),
    end: offsetFromClock(17, 30),
    color: 'green',
    endState: 'complete',
  },
  {
    id: 'task-5',
    title: 'Journal',
    start: offsetFromClock(18, 0),
    end: offsetFromClock(19, 0),
    color: 'red',
    endState: 'complete',
  },
];

const storageKey = 'focuscard.planner.v4';
const legacyStorageKey = 'focuscard.tasks.v3';

export default function App() {
  const todayDate = getTodayDateKey();
  const { width } = useWindowDimensions();
  const isPhoneLayout = width < 520;
  const isWorkspaceStacked = width < 360;
  const isStackedLayout = width < 720;

  const [planner, setPlanner] = useState<FocusPlannerStore>({
    activeDate: todayDate,
    records: [createSeedRecord(todayDate)],
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTasks[0]?.id ?? null,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [draftTask, setDraftTask] = useState<FocusTask>(createEmptyTask());

  const currentRecord = useMemo(
    () => getRecordByDate(planner.records, planner.activeDate) ?? createEmptyRecord(planner.activeDate),
    [planner.activeDate, planner.records],
  );

  const previousDate = useMemo(
    () => shiftDateKey(planner.activeDate, -1),
    [planner.activeDate],
  );

  const previousRecord = useMemo(
    () => getRecordByDate(planner.records, previousDate) ?? createEmptyRecord(previousDate),
    [planner.records, previousDate],
  );

  const tasks = currentRecord.tasks;
  const notes = currentRecord.notes;

  const totalMinutes = useMemo(
    () => tasks.reduce((sum, task) => sum + getDurationMinutes(task), 0),
    [tasks],
  );

  const orderedTasks = useMemo(
    () => [...tasks].sort((left, right) => left.start - right.start),
    [tasks],
  );

  useEffect(() => {
    let isActive = true;

    async function hydratePlanner() {
      try {
        const storedPlanner = await AsyncStorage.getItem(storageKey);

        if (storedPlanner) {
          const parsedPlanner = JSON.parse(storedPlanner);

          if (isActive && isFocusPlannerStore(parsedPlanner)) {
            const normalizedRecords = parsedPlanner.records.map(normalizeRecord);
            setPlanner({
              activeDate: parsedPlanner.activeDate,
              records: normalizedRecords,
            });
            return;
          }
        }

        const legacyTasks = await AsyncStorage.getItem(legacyStorageKey);

        if (legacyTasks) {
          const parsedLegacyTasks = JSON.parse(legacyTasks);

          if (isActive && isFocusTaskArray(parsedLegacyTasks)) {
            setPlanner({
              activeDate: todayDate,
              records: [
                {
                  date: todayDate,
                  tasks: parsedLegacyTasks.map(normalizeTask),
                  notes: '',
                },
              ],
            });
            return;
          }
        }

        if (isActive) {
          setPlanner({
            activeDate: todayDate,
            records: [createSeedRecord(todayDate)],
          });
        }
      } catch (error) {
        console.error('Failed to load planner data.', error);
      } finally {
        if (isActive) {
          setIsHydrated(true);
        }
      }
    }

    hydratePlanner();

    return () => {
      isActive = false;
    };
  }, [todayDate]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    AsyncStorage.setItem(storageKey, JSON.stringify(planner)).catch((error) => {
      console.error('Failed to save planner data.', error);
    });
  }, [isHydrated, planner]);

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }

    if (!selectedTaskId || !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [selectedTaskId, tasks]);

  const updateCurrentRecord = (updater: (record: FocusDayRecord) => FocusDayRecord) => {
    setPlanner((currentPlanner) => {
      const existingRecord =
        getRecordByDate(currentPlanner.records, currentPlanner.activeDate) ??
        createEmptyRecord(currentPlanner.activeDate);

      const nextRecord = normalizeRecord(updater(existingRecord));
      const otherRecords = currentPlanner.records.filter(
        (record) => record.date !== currentPlanner.activeDate,
      );

      return {
        ...currentPlanner,
        records: [...otherRecords, nextRecord].sort((left, right) =>
          left.date.localeCompare(right.date),
        ),
      };
    });
  };

  const setActiveDate = (date: string) => {
    setPlanner((currentPlanner) => ({
      ...currentPlanner,
      activeDate: date,
    }));
  };

  const updateNotes = (nextNotes: string) => {
    updateCurrentRecord((record) => ({
      ...record,
      notes: nextNotes,
    }));
  };

  const openNewTask = () => {
    const lastTask = orderedTasks[orderedTasks.length - 1];
    const start = lastTask
      ? Math.min(lastTask.end + MINUTES_PER_SLOT, LAST_START_OFFSET)
      : offsetFromClock(8, 0);

    setDraftTask(createEmptyTask(start));
    setEditorMode('create');
    setEditorVisible(true);
  };

  const openExistingTask = (task: FocusTask) => {
    setDraftTask(task);
    setSelectedTaskId(task.id);
    setEditorMode('edit');
    setEditorVisible(true);
  };

  const closeEditor = () => {
    setEditorVisible(false);
  };

  const saveTask = (task: FocusTask) => {
    const normalizedTask = normalizeTask(task);

    updateCurrentRecord((record) => ({
      ...record,
      tasks:
        editorMode === 'create'
          ? [...record.tasks, normalizedTask]
          : record.tasks.map((currentTask) =>
              currentTask.id === normalizedTask.id ? normalizedTask : currentTask,
            ),
    }));

    setSelectedTaskId(normalizedTask.id);
    setEditorVisible(false);
  };

  const deleteTask = () => {
    updateCurrentRecord((record) => ({
      ...record,
      tasks: record.tasks.filter((task) => task.id !== draftTask.id),
    }));

    setSelectedTaskId((currentSelected) =>
      currentSelected === draftTask.id ? null : currentSelected,
    );
    setEditorVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={[styles.sysbar, isPhoneLayout && styles.sysbarPhone]}>
        <View style={styles.brandDots}>
          <View style={[styles.brandDot, { backgroundColor: palette.red }]} />
          <View style={[styles.brandDot, { backgroundColor: palette.orange }]} />
          <View style={[styles.brandDot, { backgroundColor: palette.green }]} />
        </View>
        <View style={styles.sysbarCell}>
          <View style={[styles.sysbarSignal, { backgroundColor: palette.green }]} />
          <Text style={styles.sysbarText}>LIVE</Text>
        </View>
        <View style={styles.sysbarCell}>
          <View style={[styles.sysbarSignal, { backgroundColor: palette.orange }]} />
          <Text style={styles.sysbarText}>05:00-23:00</Text>
        </View>
        <View style={styles.sysbarCell}>
          <View style={[styles.sysbarSignal, { backgroundColor: palette.red }]} />
          <Text style={styles.sysbarText}>{planner.activeDate}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isPhoneLayout && styles.scrollContentPhone,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View
            style={[
              styles.heroHeader,
              isPhoneLayout && styles.heroHeaderPhone,
            ]}
          >
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>FOCUS CARD</Text>
              <Text
                style={[
                  styles.heroTitle,
                  isStackedLayout && styles.heroTitleCompact,
                  isPhoneLayout && styles.heroTitlePhone,
                ]}
              >
                Track the day like a printed control sheet.
              </Text>
            </View>

            <View
              style={[
                styles.heroMetaColumn,
                isPhoneLayout && styles.heroMetaColumnPhone,
              ]}
            >
              <View style={[styles.totalPill, isPhoneLayout && styles.totalPillPhone]}>
                <Text style={styles.totalPillLabel}>TOTAL</Text>
                <Text
                  style={[
                    styles.totalPillValue,
                    isPhoneLayout && styles.totalPillValuePhone,
                  ]}
                >
                  {formatDuration(totalMinutes)}
                </Text>
              </View>

              <View style={[styles.dateCard, isPhoneLayout && styles.dateCardPhone]}>
                <Text style={styles.totalPillLabel}>DATE</Text>
                <Text style={[styles.dateValue, isPhoneLayout && styles.dateValuePhone]}>
                  {formatDisplayDate(planner.activeDate)}
                </Text>
                <View style={styles.dateControls}>
                  <Pressable
                    onPress={() => setActiveDate(shiftDateKey(planner.activeDate, -1))}
                    style={[styles.dateButton, isPhoneLayout && styles.dateButtonPhone]}
                  >
                    <Text style={styles.dateButtonText}>PREV</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setActiveDate(todayDate)}
                    style={[styles.dateButton, isPhoneLayout && styles.dateButtonPhone]}
                  >
                    <Text style={styles.dateButtonText}>TODAY</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setActiveDate(shiftDateKey(planner.activeDate, 1))}
                    style={[styles.dateButton, isPhoneLayout && styles.dateButtonPhone]}
                  >
                    <Text style={styles.dateButtonText}>NEXT</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.heroText, isPhoneLayout && styles.heroTextPhone]}>
            Write the task on the left. Track the actual time on the right.
            Circle at both ends means done today. A triangle at the end means
            it rolls into tomorrow. The black line shows the task path. The
            traffic-light palette keeps status simple: red, orange, green.
          </Text>

          <View style={styles.legendRow}>
            {(['green', 'orange', 'red'] as TaskColor[]).map((color) => (
              <View
                key={color}
                style={[
                  styles.heroLegendChip,
                  { backgroundColor: taskPalette[color].fill },
                ]}
              >
                <Text
                  style={[
                    styles.heroLegendText,
                    { color: taskPalette[color].text },
                  ]}
                >
                  {formatColorName(color)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.workspaceCard,
            isWorkspaceStacked && styles.workspaceCardStacked,
            isPhoneLayout && !isWorkspaceStacked && styles.workspaceCardPhoneInline,
          ]}
        >
          <View
            style={[
              styles.leftPane,
              isWorkspaceStacked && styles.leftPaneStacked,
              isPhoneLayout && !isWorkspaceStacked && styles.leftPanePhoneInline,
            ]}
          >
            <View style={[styles.sectionHeader, isPhoneLayout && styles.sectionHeaderPhone]}>
              <View>
                <Text style={styles.sectionEyebrow}>TODAY'S FOCUS</Text>
                <Text style={styles.sectionTitle}>Task list</Text>
              </View>
              <Pressable onPress={openNewTask} style={styles.addButton}>
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            </View>

            <View style={styles.taskList}>
              {orderedTasks.map((task, index) => {
                const colors = taskPalette[task.color];
                const isSelected = selectedTaskId === task.id;

                return (
                  <Pressable
                    key={task.id}
                    onPress={() => setSelectedTaskId(task.id)}
                    onLongPress={() => openExistingTask(task)}
                    style={[
                      styles.taskCard,
                      isSelected && styles.taskCardSelected,
                    ]}
                  >
                    <View style={[styles.taskRowTop, isPhoneLayout && styles.taskRowTopPhone]}>
                      <View
                        style={[
                          styles.numberBubble,
                          {
                            borderColor: colors.strong,
                            backgroundColor: colors.fill,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.numberBubbleText,
                            { color: colors.text },
                          ]}
                        >
                          {index + 1}
                        </Text>
                      </View>

                      <View style={styles.taskCopy}>
                        <Text style={[styles.taskTitle, isPhoneLayout && styles.taskTitlePhone]}>
                          {task.title}
                        </Text>
                        <Text style={[styles.taskMeta, isPhoneLayout && styles.taskMetaPhone]}>
                          {formatClockTime(task.start)} - {formatClockTime(task.end)} ·{' '}
                          {formatDuration(getDurationMinutes(task))}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.taskFooter}>
                      <View
                        style={[
                          styles.colorBadge,
                          { backgroundColor: colors.fill },
                        ]}
                      >
                        <Text
                          style={[styles.colorBadgeText, { color: colors.text }]}
                        >
                          {formatColorName(task.color)}
                        </Text>
                      </View>

                      <View style={[styles.statusRow, isPhoneLayout && styles.statusRowPhone]}>
                        <Text style={styles.statusText}>
                          {getEndStateLabel(task.endState)}
                        </Text>
                        <Pressable onPress={() => openExistingTask(task)}>
                          <Text style={styles.editLink}>Edit</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.helperText}>
              Tap a task to highlight it on the rail. Use Edit to choose whether
              it ends with a completion circle or a tomorrow triangle.
            </Text>
            <Text style={styles.helperTextSecondary}>Saved locally by day.</Text>
          </View>

          <View
            style={[
              styles.rightPane,
              isWorkspaceStacked && styles.rightPaneStacked,
              isPhoneLayout && !isWorkspaceStacked && styles.rightPanePhoneInline,
            ]}
          >
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>ACTUAL TIME</Text>
                <Text style={styles.sectionTitle}>Right-side rail</Text>
              </View>
            </View>

            <View style={[styles.railStage, isPhoneLayout && styles.railStagePhone]}>
              <TimeRail
                tasks={orderedTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                compact={isPhoneLayout}
                railWidth={
                  isPhoneLayout
                    ? isWorkspaceStacked
                      ? Math.min(width - 110, 264)
                      : 84
                    : undefined
                }
              />
            </View>
          </View>
        </View>

        <View
          style={[
            styles.notesBoard,
            isStackedLayout && styles.notesBoardStacked,
          ]}
        >
          <View style={[styles.notesPane, isStackedLayout && styles.notesPaneStacked]}>
            <Text style={styles.sectionEyebrow}>NOTES</Text>
            <Text style={styles.sectionTitle}>Today&apos;s notes</Text>
            <Text style={[styles.notesMeta, isPhoneLayout && styles.notesMetaPhone]}>
              {formatDisplayDate(planner.activeDate)} · {tasks.length} tasks
            </Text>
            <TextInput
              multiline
              placeholder="Log what happened today, what moved, what mattered."
              placeholderTextColor={palette.inkMute}
              style={[styles.notesInput, isPhoneLayout && styles.notesInputPhone]}
              value={notes}
              onChangeText={updateNotes}
              textAlignVertical="top"
            />
          </View>

          <View
            style={[
              styles.previousPane,
              isStackedLayout && styles.previousPaneStacked,
            ]}
          >
            <Text style={styles.sectionEyebrow}>PREVIOUS DAY</Text>
            <Text style={styles.sectionTitle}>Yesterday&apos;s log</Text>
            <Text style={[styles.notesMeta, isPhoneLayout && styles.notesMetaPhone]}>
              {formatDisplayDate(previousDate)} · {previousRecord.tasks.length} tasks
            </Text>
            <View style={styles.previousNotesCard}>
              <Text
                style={[
                  styles.previousNotesText,
                  isPhoneLayout && styles.previousNotesTextPhone,
                ]}
              >
                {previousRecord.notes.trim() !== ''
                  ? previousRecord.notes
                  : 'No note logged for the previous day yet.'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <EditTaskSheet
        draft={draftTask}
        visible={editorVisible}
        mode={editorMode}
        onCancel={closeEditor}
        onDelete={deleteTask}
        onSave={saveTask}
      />
    </SafeAreaView>
  );
}

function createEmptyTask(start = offsetFromClock(8, 0)): FocusTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    start: clampToTimeline(start),
    end: Math.min(clampToTimeline(start) + 45, TIMELINE_DURATION_MINUTES),
    color: 'green',
    endState: 'complete',
  };
}

function createSeedRecord(date: string): FocusDayRecord {
  return {
    date,
    tasks: initialTasks.map(normalizeTask),
    notes: '',
  };
}

function createEmptyRecord(date: string): FocusDayRecord {
  return {
    date,
    tasks: [],
    notes: '',
  };
}

function getRecordByDate(records: FocusDayRecord[], date: string) {
  return records.find((record) => record.date === date);
}

function normalizeRecord(record: FocusDayRecord): FocusDayRecord {
  return {
    date: record.date,
    notes: typeof record.notes === 'string' ? record.notes : '',
    tasks: Array.isArray(record.tasks) ? record.tasks.map(normalizeTask) : [],
  };
}

function normalizeTask(task: FocusTask): FocusTask {
  const start = clampToTimeline(task.start);
  const end = Math.min(
    Math.max(clampToTimelineBoundary(task.end), start + MINUTES_PER_SLOT),
    TIMELINE_DURATION_MINUTES,
  );

  return {
    ...task,
    color: normalizeTaskColor(task.color as string),
    start: Math.min(start, end - MINUTES_PER_SLOT),
    end,
  };
}

function isFocusTaskArray(value: unknown): value is FocusTask[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(
    (task) =>
      typeof task?.id === 'string' &&
      typeof task?.title === 'string' &&
      typeof task?.start === 'number' &&
      typeof task?.end === 'number' &&
      typeof task?.color === 'string' &&
      ['complete', 'carryover'].includes(task?.endState),
  );
}

function isFocusDayRecord(value: unknown): value is FocusDayRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FocusDayRecord).date === 'string' &&
    typeof (value as FocusDayRecord).notes === 'string' &&
    isFocusTaskArray((value as FocusDayRecord).tasks)
  );
}

function isFocusPlannerStore(value: unknown): value is FocusPlannerStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FocusPlannerStore).activeDate === 'string' &&
    Array.isArray((value as FocusPlannerStore).records) &&
    (value as FocusPlannerStore).records.every(isFocusDayRecord)
  );
}

function getEndStateLabel(endState: TaskEndState) {
  return endState === 'complete' ? 'Done today' : 'Move tomorrow';
}

function formatColorName(color: TaskColor) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function normalizeTaskColor(color: string): TaskColor {
  if (color === 'orange' || color === 'yellow') {
    return 'orange';
  }

  if (color === 'red' || color === 'pink' || color === 'purple') {
    return 'red';
  }

  return 'green';
}

function getTodayDateKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function shiftDateKey(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return formatDateKey(date);
}

function formatDisplayDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseDateKey(dateKey));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  sysbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: palette.ink,
  },
  sysbarPhone: {
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 12,
    paddingVertical: 12,
  },
  brandDots: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 6,
  },
  brandDot: {
    width: 10,
    height: 10,
  },
  sysbarCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sysbarSignal: {
    width: 10,
    height: 10,
  },
  sysbarText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.paper,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 20,
  },
  scrollContentPhone: {
    paddingHorizontal: 12,
    gap: 16,
  },
  heroCard: {
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: palette.ink,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  heroHeaderPhone: {
    flexDirection: 'column',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroMetaColumn: {
    width: 228,
    gap: 12,
  },
  heroMetaColumnPhone: {
    width: '100%',
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -1.2,
    color: palette.ink,
    maxWidth: 380,
  },
  heroTitleCompact: {
    maxWidth: undefined,
    fontSize: 28,
    lineHeight: 28,
  },
  heroTitlePhone: {
    maxWidth: undefined,
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -0.8,
  },
  totalPill: {
    borderWidth: 2,
    borderColor: palette.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.paper2,
    minWidth: 108,
  },
  totalPillPhone: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  totalPillLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 6,
  },
  totalPillValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 26,
    color: palette.ink,
  },
  totalPillValuePhone: {
    fontSize: 22,
    lineHeight: 22,
  },
  dateCard: {
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.paper2,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateCardPhone: {
    width: '100%',
    paddingHorizontal: 14,
  },
  dateValue: {
    fontFamily: fonts.ui,
    fontSize: 18,
    lineHeight: 24,
    color: palette.ink,
    marginBottom: 12,
  },
  dateValuePhone: {
    fontSize: 16,
    lineHeight: 22,
  },
  dateControls: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: palette.paper,
  },
  dateButtonPhone: {
    flexGrow: 1,
    alignItems: 'center',
  },
  dateButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.ink,
  },
  heroText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.ink,
    marginBottom: 16,
  },
  heroTextPhone: {
    fontSize: 14,
    lineHeight: 21,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroLegendChip: {
    borderWidth: 1,
    borderColor: palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroLegendText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  workspaceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: 16,
  },
  workspaceCardStacked: {
    flexDirection: 'column',
  },
  workspaceCardPhoneInline: {
    gap: 10,
    padding: 12,
  },
  leftPane: {
    flex: 1,
  },
  leftPaneStacked: {
    width: '100%',
  },
  leftPanePhoneInline: {
    minWidth: 0,
  },
  rightPane: {
    width: 154,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: palette.ink,
  },
  rightPanePhoneInline: {
    width: 128,
    paddingLeft: 10,
  },
  rightPaneStacked: {
    width: '100%',
    paddingLeft: 0,
    paddingTop: 14,
    borderLeftWidth: 0,
    borderTopWidth: 2,
    borderTopColor: palette.ink,
  },
  railStage: {
    alignItems: 'flex-start',
  },
  railStagePhone: {
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  sectionHeaderPhone: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fonts.ui,
    fontSize: 20,
    fontWeight: '500',
    color: palette.ink,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.ink,
  },
  addButtonText: {
    fontFamily: fonts.ui,
    color: palette.paper,
    fontWeight: '600',
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.paper,
    padding: 14,
  },
  taskCardSelected: {
    borderColor: palette.ink,
    borderWidth: 2,
  },
  taskRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskRowTopPhone: {
    alignItems: 'flex-start',
  },
  numberBubble: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBubbleText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    letterSpacing: 1.2,
    color: palette.ink,
  },
  taskCopy: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: fonts.ui,
    fontSize: 18,
    fontWeight: '500',
    color: palette.ink,
    marginBottom: 4,
  },
  taskTitlePhone: {
    fontSize: 16,
  },
  taskMeta: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.2,
    color: palette.inkMute,
  },
  taskMetaPhone: {
    fontSize: 12,
    lineHeight: 18,
  },
  taskFooter: {
    marginTop: 14,
    gap: 10,
  },
  colorBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  colorBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRowPhone: {
    flexWrap: 'wrap',
    rowGap: 8,
  },
  statusText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: palette.inkMute,
  },
  editLink: {
    fontFamily: fonts.mono,
    color: palette.ink,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  helperText: {
    marginTop: 14,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: palette.inkMute,
  },
  helperTextSecondary: {
    marginTop: 6,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.inkMute,
  },
  notesBoard: {
    flexDirection: 'row',
    gap: 14,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.paper,
    padding: 16,
  },
  notesBoardStacked: {
    flexDirection: 'column',
  },
  notesPane: {
    flex: 1,
  },
  notesPaneStacked: {
    width: '100%',
  },
  previousPane: {
    width: 280,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: palette.ink,
  },
  previousPaneStacked: {
    width: '100%',
    paddingLeft: 0,
    paddingTop: 14,
    borderLeftWidth: 0,
    borderTopWidth: 2,
    borderTopColor: palette.ink,
  },
  notesMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 10,
  },
  notesMetaPhone: {
    fontSize: 10,
    lineHeight: 16,
  },
  notesInput: {
    minHeight: 220,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.paper,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: palette.ink,
  },
  notesInputPhone: {
    minHeight: 180,
    fontSize: 15,
    lineHeight: 22,
  },
  previousNotesCard: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.paper2,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previousNotesText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: palette.ink,
  },
  previousNotesTextPhone: {
    fontSize: 15,
    lineHeight: 22,
  },
});
