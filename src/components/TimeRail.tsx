import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  buildSegments,
  formatClockTime,
  formatHourLabel,
  formatDuration,
  getDurationMinutes,
  TIMELINE_HOUR_COUNT,
} from '../lib/time';
import { fonts, palette, taskPalette } from '../lib/theme';
import type { FocusTask } from '../lib/types';

type TimeRailProps = {
  tasks: FocusTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  compact?: boolean;
  railWidth?: number;
};

export function TimeRail({
  tasks,
  selectedTaskId,
  onSelectTask,
  compact = false,
  railWidth: railWidthOverride,
}: TimeRailProps) {
  const labelWidth = compact ? 30 : 26;
  const railWidth = railWidthOverride ?? (compact ? 248 : 120);
  const rowHeight = compact ? 34 : 42;
  const headerHeight = compact ? 40 : 44;
  const barHeight = compact ? 14 : 16;
  const lineHeight = 4;
  const markerSize = compact ? 26 : 28;
  const triangleWidth = compact ? 22 : 24;
  const triangleHeight = compact ? 28 : 30;

  return (
    <View style={[styles.wrap, { width: labelWidth + railWidth }]}>
      <View style={[styles.header, { height: headerHeight, paddingLeft: labelWidth }]}>
        <Text style={styles.headerLabel}>MM</Text>
        <View style={styles.minuteHeader}>
          {['00', '15', '30', '45', '60'].map((minute) => (
            <Text
              key={minute}
              style={[
                styles.minuteLabel,
                {
                  width: railWidth / 4,
                  marginLeft: compact ? -2 : -6,
                  fontSize: compact ? 10 : 11,
                },
              ]}
            >
              {minute}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.gridWrap}>
        <View style={[styles.rows, { width: labelWidth + railWidth }]}>
          {Array.from({ length: TIMELINE_HOUR_COUNT }, (_, index) => (
            <View key={index} style={[styles.row, { height: rowHeight }]}>
              <Text
                style={[
                  styles.hourLabel,
                  {
                    width: labelWidth,
                    fontSize: compact ? 12 : 14,
                    paddingTop: compact ? 9 : 12,
                  },
                ]}
              >
                {formatHourLabel(index)}
              </Text>
              <View style={[styles.railRow, { width: railWidth }]}>
                {Array.from({ length: 4 }, (_, column) => (
                  <View
                    key={`${index}-${column}`}
                    style={[
                      styles.quarterCell,
                      {
                        width: railWidth / 4,
                        height: rowHeight,
                      },
                      column === 3 && styles.lastQuarterCell,
                    ]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.overlay,
            {
              width: labelWidth + railWidth,
              height: rowHeight * TIMELINE_HOUR_COUNT,
            },
          ]}
          pointerEvents="box-none"
        >
          {tasks.map((task, index) => {
            const colors = taskPalette[task.color];
            const segments = buildSegments(task);
            const isSelected = task.id === selectedTaskId;
            const startRow = Math.floor(task.start / 60);
            const endRow = Math.floor((task.end - 1) / 60);
            const endMinute = task.end % 60;
            const startX = labelWidth + (task.start % 60 / 60) * railWidth;
            const endX =
              labelWidth +
              (endMinute === 0 ? railWidth : (endMinute / 60) * railWidth);
            const startY = startRow * rowHeight + rowHeight / 2;
            const endY = endRow * rowHeight + rowHeight / 2;

            return (
              <View key={task.id} pointerEvents="box-none">
                {segments.map((segment, segmentIndex) => (
                  <View key={`${task.id}-${segment.hourIndex}-${segmentIndex}`}>
                    <Pressable
                      onPress={() => onSelectTask(task.id)}
                      style={[
                        styles.segment,
                        {
                          top:
                            segment.hourIndex * rowHeight +
                            (rowHeight - barHeight) / 2,
                          left:
                            labelWidth +
                            (segment.startMinute / 60) * railWidth,
                          width:
                            ((segment.endMinute - segment.startMinute) / 60) *
                            railWidth,
                          backgroundColor: colors.fill,
                          borderColor: colors.strong,
                          height: barHeight,
                        },
                      ]}
                    />
                    <Pressable
                      onPress={() => onSelectTask(task.id)}
                      style={[
                        styles.connectorLine,
                        {
                          top:
                            segment.hourIndex * rowHeight +
                            (rowHeight - lineHeight) / 2,
                          left:
                            labelWidth +
                            (segment.startMinute / 60) * railWidth,
                          width:
                            ((segment.endMinute - segment.startMinute) / 60) *
                            railWidth,
                          height: lineHeight,
                        },
                      ]}
                    />
                  </View>
                ))}

                <Pressable
                  onPress={() => onSelectTask(task.id)}
                  style={[
                    styles.startMarker,
                    {
                      top: startY - markerSize / 2,
                      left: startX - markerSize / 2 + 2,
                      borderColor: colors.strong,
                      backgroundColor: palette.paper,
                      width: markerSize,
                      height: markerSize,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.markerText,
                      { color: isSelected ? colors.text : colors.strong },
                      { color: colors.strong },
                      compact && styles.markerTextCompact,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </Pressable>

                {task.endState === 'complete' ? (
                  <Pressable
                    onPress={() => onSelectTask(task.id)}
                    style={[
                      styles.endCircle,
                      {
                        top: endY - markerSize / 2,
                        left: endX - markerSize / 2,
                        borderColor: colors.strong,
                        backgroundColor: palette.paper,
                        width: markerSize,
                        height: markerSize,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.markerText,
                        { color: colors.strong },
                        compact && styles.markerTextCompact,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => onSelectTask(task.id)}
                    style={[
                      styles.endTriangleWrap,
                      {
                        top: endY - triangleHeight / 2,
                        left: endX - triangleWidth / 3,
                        width: triangleWidth,
                        height: triangleHeight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.endTriangleGlyph,
                        { color: palette.ink },
                        compact && styles.endTriangleGlyphCompact,
                      ]}
                    >
                      ▶
                    </Text>
                    <Text
                      style={[
                        styles.endTriangleText,
                        compact && styles.endTriangleTextCompact,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.legend,
          {
            paddingLeft: compact ? 0 : labelWidth,
            justifyContent: compact ? 'space-between' : 'flex-start',
          },
        ]}
      >
        <View style={styles.legendRow}>
          <View style={styles.legendCircle} />
          <Text style={styles.legendText}>Start</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendCircleSmall} />
          <Text style={styles.legendText}>Done today</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendTriangle} />
          <Text style={styles.legendText}>Move tomorrow</Text>
        </View>
      </View>

      {selectedTaskId ? (
        <View
          style={[
            styles.selectionCard,
            {
              marginLeft: compact ? 0 : labelWidth,
              width: compact ? labelWidth + railWidth : railWidth,
            },
          ]}
        >
          {tasks
            .filter((task) => task.id === selectedTaskId)
            .map((task, index) => (
              <View key={task.id}>
                <Text style={styles.selectionTitle}>{task.title}</Text>
                <Text style={[styles.selectionMeta, compact && styles.selectionMetaCompact]}>
                  {formatClockTime(task.start)} - {formatClockTime(task.end)} ·{' '}
                  {formatDuration(getDurationMinutes(task))}
                </Text>
                <Text style={styles.selectionState}>
                  {task.endState === 'complete'
                    ? 'Ends with a matching circle'
                    : 'Ends with a triangle and moves to tomorrow'}
                </Text>
              </View>
            ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  header: {},
  headerLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.inkMute,
    marginBottom: 6,
  },
  minuteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  minuteLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: palette.inkMute,
  },
  gridWrap: {
    position: 'relative',
  },
  rows: {},
  row: { flexDirection: 'row' },
  hourLabel: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: palette.inkMute,
  },
  railRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: palette.ink,
  },
  quarterCell: {
    borderRightWidth: 1,
    borderColor: palette.hairline,
  },
  lastQuarterCell: {
    borderRightWidth: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  segment: {
    position: 'absolute',
    borderWidth: 1,
  },
  connectorLine: {
    position: 'absolute',
    backgroundColor: palette.ink,
  },
  startMarker: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endTriangleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endTriangleGlyph: {
    fontSize: 28,
    lineHeight: 28,
  },
  endTriangleGlyphCompact: {
    fontSize: 24,
    lineHeight: 24,
  },
  endTriangleText: {
    position: 'absolute',
    left: 6,
    top: 9,
    color: palette.paper,
    fontSize: 9,
    fontWeight: '800',
  },
  endTriangleTextCompact: {
    left: 6,
    top: 7,
    fontSize: 8,
  },
  markerText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  markerTextCompact: {
    fontSize: 10,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendCircle: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  legendCircleSmall: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.paper,
  },
  legendTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: palette.ink,
  },
  legendText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.inkMute,
  },
  selectionCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.paper2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectionTitle: {
    fontFamily: fonts.ui,
    fontSize: 14,
    fontWeight: '500',
    color: palette.ink,
    marginBottom: 4,
  },
  selectionMeta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: palette.inkMute,
  },
  selectionMetaCompact: {
    fontSize: 11,
    lineHeight: 18,
  },
  selectionState: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.ink,
  },
});
