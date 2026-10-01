import React, { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme, useThemedStyles } from '../contexts/PreferencesContext';
import { fonts, healthBand } from '../theme';
import type { ThemeColors } from '../theme';

export interface TrendPoint {
  date: string;
  healthScore: number;
}

const HEIGHT = 120;
const PAD_Y = 8;
// leaves room for the band numbers on the right
const PAD_RIGHT = 22;
const BAND_LINES = [90, 70, 50, 25];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  // null = not touching, show the latest point
  const [active, setActive] = useState<number | null>(null);

  const n = points.length;
  const plotWidth = Math.max(0, width - PAD_RIGHT);

  // fit the real scores, a 0-100 scale makes 96 vs 98 look flat
  const scores = points.map((p) => p.healthScore);
  const hi = Math.min(100, Math.max(...scores) + 2);
  const lo = Math.max(0, Math.min(Math.max(...scores) - 6, Math.min(...scores) - 4));

  const x = (i: number) => (n === 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);
  const y = (score: number) => PAD_Y + ((hi - score) / (hi - lo)) * (HEIGHT - PAD_Y * 2);

  const pan = useMemo(() => {
    const pick = (touchX: number) => {
      if (plotWidth === 0) return;
      const i = n === 1 ? 0 : Math.round((touchX / plotWidth) * (n - 1));
      setActive(Math.min(n - 1, Math.max(0, i)));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // don't let the page scroll steal the drag
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => setActive(null),
      onPanResponderTerminate: () => setActive(null),
    });
  }, [n, plotWidth]);

  const shown = active ?? n - 1;
  const point = points[shown];
  const band = healthBand(point.healthScore, colors);
  const change = shown > 0 ? oneDecimal(point.healthScore - points[shown - 1].healthScore) : null;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.healthScore)}`).join(' ');
  const area = n > 1 ? `${line} L${x(n - 1)},${HEIGHT} L${x(0)},${HEIGHT} Z` : '';

  // background strip per band, clipped to the visible range
  const bands = [
    { from: 90, to: 100, color: colors.success },
    { from: 70, to: 90, color: colors.info },
    { from: 50, to: 70, color: colors.warning },
    { from: 0, to: 50, color: colors.danger },
  ].filter((b) => b.to > lo && b.from < hi);

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.readoutDate}>{active === null ? 'Latest' : formatDate(point.date)}</Text>
        <Text style={[styles.readoutScore, { color: band.color }]}>{oneDecimal(point.healthScore)}</Text>
        <Text style={[styles.readoutBand, { color: band.color }]}>{band.label}</Text>
        {change !== null ? (
          <Text
            style={[
              styles.readoutChange,
              { color: change > 0 ? colors.success : change < 0 ? colors.danger : colors.textMuted },
            ]}
          >
            {change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${Math.abs(change)}` : '—'} vs day before
          </Text>
        ) : null}
      </View>

      <View
        style={styles.plot}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityLabel={`Health score went from ${oneDecimal(points[0].healthScore)} to ${oneDecimal(point.healthScore)} over the last 30 days`}
        {...pan.panHandlers}
      >
        {width > 0 ? (
          // touches go to the wrapper so locationX is always relative to the chart
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            {bands.map((b) => (
              <Rect
                key={b.from}
                x={0}
                y={y(Math.min(b.to, hi))}
                width={plotWidth}
                height={y(Math.max(b.from, lo)) - y(Math.min(b.to, hi))}
                fill={b.color}
                opacity={0.07}
              />
            ))}
            {BAND_LINES.filter((v) => v > lo && v < hi).map((v) => (
              <React.Fragment key={v}>
                <Line
                  x1={0}
                  x2={plotWidth}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={colors.border}
                  strokeDasharray="3 4"
                />
                <SvgText
                  x={width}
                  y={y(v) + 3}
                  fontSize={9}
                  fontFamily={fonts.mono}
                  fill={colors.textMuted}
                  textAnchor="end"
                >
                  {v}
                </SvgText>
              </React.Fragment>
            ))}

            {area ? <Path d={area} fill={colors.primary} opacity={0.08} /> : null}
            {n > 1 ? (
              <Path d={line} stroke={colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" />
            ) : null}
            {points.map((p, i) => (
              <Circle
                key={p.date}
                cx={x(i)}
                cy={y(p.healthScore)}
                r={2.5}
                fill={colors.card}
                stroke={colors.primary}
                strokeWidth={1.5}
              />
            ))}

            {active !== null ? (
              <Line x1={x(shown)} x2={x(shown)} y1={0} y2={HEIGHT} stroke={colors.textMuted} strokeWidth={1} />
            ) : null}
            <Circle
              cx={x(shown)}
              cy={y(point.healthScore)}
              r={5}
              fill={band.color}
              stroke={colors.card}
              strokeWidth={2}
            />
          </Svg>
        ) : null}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisText}>{formatDate(points[0].date)}</Text>
        <Text style={styles.axisText}>{n > 1 ? 'Drag to see each day' : '1 scan'}</Text>
        <Text style={styles.axisText}>{formatDate(points[n - 1].date)}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    readout: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    readoutDate: {
      fontSize: 12,
      color: c.textMuted,
      minWidth: 44,
    },
    readoutScore: {
      fontFamily: fonts.mono,
      fontSize: 20,
      fontWeight: '700',
    },
    readoutBand: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    readoutChange: {
      fontSize: 11,
    },
    plot: {
      height: HEIGHT,
    },
    axis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
      marginRight: PAD_RIGHT,
    },
    axisText: {
      fontSize: 10,
      color: c.textMuted,
    },
  });
