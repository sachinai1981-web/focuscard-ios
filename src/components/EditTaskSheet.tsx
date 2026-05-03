import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type ScrollView as ScrollViewType,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  endTimeOptions,
  formatClockTime,
  formatDuration,
  startTimeOptions,
} from '../lib/time';
import { fonts, palette, taskPalette } from '../lib/theme';
import {
  taskColorOptions,
  type FocusTask,
  type TaskColor,
  type TaskEndState,
} from '../lib/types';

type EditTaskSheetProps = {
  draft: FocusTask;
  visible: boolean;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onDelete: () => void;
  onSave: (task: FocusTask) => void;
};

type ActiveTimeField = 'start' | 'end' | null;

const endStateOptions: Array<{
  value: TaskEndState;
  title: string;
  caption: string;
}> = [
  {
    value: 'complete',
    title: 'Finished today',
    caption: 'End with a matching circle and black line',
  },
  {
    value: 'carryover',
    title: 'Move to tomorrow',
    caption: 'End with a numbered triangle',
  },
];

export function EditTaskSheet({
  draft,
  visible,
  mode,
  onCancel,
  onDelete,
  onSave,
}: EditTaskSheetProps) {
  const [task, setTask] = useState(draft);
  const [activeField, setActiveField] = useState<ActiveTimeField>(null);
  const pickerScrollRef = useRef<ScrollViewType>(null);

  const pickerOptions = useMemo(
    () => (activeField === 'start' ? startTimeOptions : endTimeOptions),
    [activeField],
  );

  useEffect(() => {
    setTask(draft);
    setActiveField(null);
  }, [draft]);

  useEffect(() => {
    if (!activeField) {
      return;
    }

    const timeout = setTimeout(() => {
      pickerScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);

    return () => clearTimeout(timeout);
  }, [activeField, pickerOptions]);

  const durationLabel = formatDuration(Math.max(task.end - task.start, 15));

  const updateTask = (nextTask: FocusTask) => {
    if (nextTask.end <= nextTask.start) {
      return;
    }

    setTask(nextTask);
  };

  const handleTimePick = (value: number) => {
    if (activeField === 'start') {
      updateTask({
        ...task,
        start: value,
        end: Math.max(task.end, value + 15),
      });
    }

    if (activeField === 'end') {
      updateTask({
        ...task,
        end: Math.max(value, task.start + 15),
      });
    }

    setActiveField(null);
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.scrim}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <ScrollView
              style={styles.sheetScroller}
              contentContainerStyle={styles.sheetScrollerContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetEyebrow}>
                    {mode === 'create' ? 'NEW TASK' : 'EDIT TASK'}
                  </Text>
                  <Text style={styles.sheetTitle}>
                    {mode === 'create' ? 'Add a focus block' : 'Update your focus block'}
                  </Text>
                </View>
                <Pressable onPress={onCancel} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Task</Text>
                <TextInput
                  placeholder="Blog post, call, workout..."
                  placeholderTextColor={palette.inkMute}
                  style={styles.input}
                  value={task.title}
                  onChangeText={(title) => setTask({ ...task, title })}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Time block color</Text>
                <View style={styles.colorRow}>
                  {taskColorOptions.map((color) => {
                    const isSelected = task.color === color;

                    return (
                      <Pressable
                        key={color}
                        onPress={() => setTask({ ...task, color })}
                        style={[
                          styles.colorChip,
                          { backgroundColor: taskPalette[color].fill },
                          isSelected && styles.colorChipSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: taskPalette[color].strong },
                          ]}
                        />
                        <Text
                          style={[
                            styles.colorChipText,
                            { color: taskPalette[color].text },
                          ]}
                        >
                          {color.toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.timeRow}>
                <TimeButton
                  label="Start"
                  value={formatClockTime(task.start)}
                  onPress={() => setActiveField('start')}
                />
                <TimeButton
                  label="End"
                  value={formatClockTime(task.end)}
                  onPress={() => setActiveField('end')}
                />
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Tracked time</Text>
                <Text style={styles.summaryValue}>{durationLabel}</Text>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>How does this block end?</Text>
                <View style={styles.endStateColumn}>
                  {endStateOptions.map((option) => {
                    const isSelected = task.endState === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setTask({ ...task, endState: option.value })}
                        style={[
                          styles.endStateCard,
                          isSelected && styles.endStateCardSelected,
                        ]}
                      >
                        <Text style={styles.endStateTitle}>{option.title}</Text>
                        <Text style={styles.endStateCaption}>{option.caption}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.footer}>
                {mode === 'edit' ? (
                  <Pressable onPress={onDelete} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                ) : (
                  <View />
                )}

                <Pressable
                  onPress={() => onSave(task)}
                  style={[
                    styles.saveButton,
                    task.title.trim() === '' && styles.saveButtonDisabled,
                  ]}
                  disabled={task.title.trim() === ''}
                >
                  <Text style={styles.saveButtonText}>
                    {mode === 'create' ? 'Add task' : 'Save task'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {activeField ? (
          <View style={styles.timePickerScrim}>
            <View style={styles.timePickerCard}>
              <View style={styles.timePickerHeader}>
                <View>
                  <Text style={styles.sheetEyebrow}>
                    {activeField === 'start' ? 'START TIME' : 'END TIME'}
                  </Text>
                  <Text style={styles.timePickerTitle}>
                    Pick {activeField === 'start' ? 'start' : 'end'} time
                  </Text>
                </View>
                <Pressable
                  onPress={() => setActiveField(null)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>

              <Text style={styles.pickerCaption}>
                This planner runs from 05:00 to 23:00. Anything later should be
                moved to tomorrow.
              </Text>

              <View style={styles.currentSelectionCard}>
                <Text style={styles.currentSelectionLabel}>Current selection</Text>
                <Text style={styles.currentSelectionValue}>
                  {formatClockTime(task[activeField])}
                </Text>
              </View>

              <ScrollView
                ref={pickerScrollRef}
                style={styles.overlayTimeGridScroll}
                contentContainerStyle={styles.timeGrid}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {pickerOptions.map((option) => {
                  const disabled =
                    activeField === 'start'
                      ? option >= task.end
                      : option <= task.start;

                  return (
                    <Pressable
                      key={`${activeField}-${option}`}
                      disabled={disabled}
                      onPress={() => handleTimePick(option)}
                      style={[
                        styles.timeChip,
                        option === task[activeField] && styles.timeChipSelected,
                        disabled && styles.timeChipDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeChipText,
                          option === task[activeField] && styles.timeChipTextSelected,
                          disabled && styles.timeChipTextDisabled,
                        ]}
                      >
                        {formatClockTime(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

type TimeButtonProps = {
  label: string;
  value: string;
  onPress: () => void;
};

function TimeButton({ label, value, onPress }: TimeButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.timeButton}>
      <Text style={styles.timeButtonLabel}>{label}</Text>
      <Text style={styles.timeButtonValue}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(24, 20, 14, 0.28)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: palette.paper,
    maxHeight: '88%',
    overflow: 'hidden',
    borderTopWidth: 2,
    borderTopColor: palette.ink,
  },
  sheetScroller: {
    flex: 1,
  },
  sheetScrollerContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 6,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.paper,
  },
  closeButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.ink,
  },
  fieldBlock: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 10,
  },
  input: {
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.paper,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.ui,
    fontSize: 18,
    color: palette.ink,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  colorChipSelected: {
    borderColor: palette.ink,
  },
  colorChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  timeButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.paper,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  timeButtonLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 8,
  },
  timeButtonValue: {
    fontFamily: fonts.ui,
    fontSize: 20,
    fontWeight: '500',
    color: palette.ink,
  },
  summaryCard: {
    backgroundColor: palette.paper2,
    borderWidth: 1,
    borderColor: palette.hairline,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 18,
  },
  summaryLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 6,
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  pickerBlock: {
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
    paddingTop: 18,
    marginBottom: 18,
  },
  pickerCaption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: palette.inkMute,
    marginBottom: 12,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timePickerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 20, 14, 0.28)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  timePickerCard: {
    maxHeight: '78%',
    backgroundColor: palette.paper,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  timePickerTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  currentSelectionCard: {
    backgroundColor: palette.paper2,
    borderWidth: 1,
    borderColor: palette.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  currentSelectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 6,
  },
  currentSelectionValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  overlayTimeGridScroll: {
    maxHeight: 420,
  },
  timeChip: {
    minWidth: '22%',
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.paper,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeChipSelected: {
    borderColor: palette.ink,
    borderWidth: 2,
    backgroundColor: palette.paper2,
  },
  timeChipDisabled: {
    opacity: 0.35,
  },
  timeChipText: {
    fontFamily: fonts.mono,
    color: palette.ink,
    letterSpacing: 1.2,
  },
  timeChipTextSelected: {
    color: palette.ink,
  },
  timeChipTextDisabled: {
    color: palette.inkMute,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  endStateColumn: {
    gap: 10,
  },
  endStateCard: {
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.paper,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  endStateCardSelected: {
    borderColor: palette.ink,
    borderWidth: 2,
    backgroundColor: palette.paper2,
  },
  endStateTitle: {
    fontFamily: fonts.ui,
    fontSize: 16,
    fontWeight: '500',
    color: palette.ink,
    marginBottom: 4,
  },
  endStateCaption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: palette.inkMute,
  },
  deleteButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deleteButtonText: {
    fontFamily: fonts.mono,
    color: palette.red,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  saveButton: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.ink,
  },
  saveButtonDisabled: {
    backgroundColor: palette.inkMute,
  },
  saveButtonText: {
    fontFamily: fonts.ui,
    color: palette.paper,
    fontWeight: '600',
    fontSize: 16,
  },
});
