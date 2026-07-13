import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useGetProgress,
  useListExerciseSessions,
  getListExerciseSessionsQueryKey,
} from '@workspace/api-client-react';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import Svg, { Line, Circle, Polyline, Rect, Text as SvgText, G } from 'react-native-svg';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';

// ── Mini line chart for mood trend ──────────────────────────────────────────
type MoodPoint = { date: string; avgBefore: number; avgAfter: number };

function MoodLineChart({
  data, width, height, accentColor, successColor, gridColor, labelColor,
}: {
  data: MoodPoint[]; width: number; height: number;
  accentColor: string; successColor: string; gridColor: string; labelColor: string;
}) {
  if (data.length === 0) return null;
  const pad = { top: 12, bottom: 28, left: 28, right: 12 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const minV = 1; const maxV = 10; const range = maxV - minV;

  const xFor = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yFor = (v: number) => pad.top + chartH - ((v - minV) / range) * chartH;

  const beforePoints = data.map((d, i) => `${xFor(i)},${yFor(d.avgBefore)}`).join(' ');
  const afterPoints  = data.map((d, i) => `${xFor(i)},${yFor(d.avgAfter)}`).join(' ');
  const yLabels = [1, 4, 7, 10];
  const firstDate = data[0]?.date.slice(5) ?? '';
  const lastDate  = data[data.length - 1]?.date.slice(5) ?? '';

  return (
    <Svg width={width} height={height}>
      {yLabels.map((v) => (
        <G key={v}>
          <Line x1={pad.left} y1={yFor(v)} x2={pad.left + chartW} y2={yFor(v)}
            stroke={gridColor} strokeWidth={1} />
          <SvgText x={pad.left - 4} y={yFor(v) + 4} fontSize={9} fill={labelColor} textAnchor="end">
            {v}
          </SvgText>
        </G>
      ))}
      <Polyline points={beforePoints} fill="none" stroke={accentColor} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      <Polyline points={afterPoints}  fill="none" stroke={successColor} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <G key={i}>
          <Circle cx={xFor(i)} cy={yFor(d.avgBefore)} r={3} fill={accentColor} />
          <Circle cx={xFor(i)} cy={yFor(d.avgAfter)}  r={3} fill={successColor} />
        </G>
      ))}
      <SvgText x={pad.left} y={height - 4} fontSize={9} fill={labelColor} textAnchor="start">
        {firstDate}
      </SvgText>
      {data.length > 1 && (
        <SvgText x={pad.left + chartW} y={height - 4} fontSize={9} fill={labelColor} textAnchor="end">
          {lastDate}
        </SvgText>
      )}
    </Svg>
  );
}

// ── Horizontal bar chart ─────────────────────────────────────────────────────
type BarDatum = { label: string; value: number; color: string };

function HorizontalBars({
  data, maxVal, trackColor, labelColor, countColor,
}: {
  data: BarDatum[]; maxVal: number;
  trackColor: string; labelColor: string; countColor: string;
}) {
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ width: 100, fontSize: 12, fontFamily: 'Inter_500Medium', color: labelColor, textTransform: 'capitalize' }}
            numberOfLines={1}>
            {d.label}
          </Text>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: trackColor, overflow: 'hidden' }}>
            <View style={{ height: '100%', borderRadius: 4, backgroundColor: d.color,
              width: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%` as any }} />
          </View>
          <Text style={{ width: 24, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: countColor, textAlign: 'right' }}>
            {d.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Belief funnel ─────────────────────────────────────────────────────────────
function BeliefFunnelChart({
  active, challenged, resolved, labelColor, pctColor,
}: {
  active: number; challenged: number; resolved: number;
  labelColor: string; pctColor: string;
}) {
  const total = active + challenged + resolved;
  const data = [
    { label: 'Active',     value: active,     color: '#C45E5E' },
    { label: 'Challenged', value: challenged,  color: '#D4823A' },
    { label: 'Resolved',   value: resolved,    color: '#4A9E6F' },
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 }}>
      {data.map((d) => (
        <View key={d.label} style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: d.color,
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: d.color }}>{d.value}</Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: labelColor }}>{d.label}</Text>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: pctColor }}>
            {total > 0 ? Math.round((d.value / total) * 100) : 0}%
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Card({
  title, children, delay = 0, cardBg, borderColor, titleColor,
}: {
  title: string; children: React.ReactNode; delay?: number;
  cardBg: string; borderColor: string; titleColor: string;
}) {
  return (
    <Animated.View entering={SlideInDown.delay(delay).duration(500).springify()}
      style={{ backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor, padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: titleColor }}>{title}</Text>
      {children}
    </Animated.View>
  );
}

// ── Legend dot ────────────────────────────────────────────────────────────────
function LegendDot({ color, label, labelColor }: { color: string; label: string; labelColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: labelColor }}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { data, isLoading, refetch } = useGetProgress();
  const { data: pastSessions } = useListExerciseSessions(
    { completed: true },
    { query: { queryKey: getListExerciseSessionsQueryKey({ completed: true }) } },
  );
  const { exercises: catalog } = useExerciseCatalog();
  const exerciseTitle = (exerciseId: string) =>
    catalog.find((e) => e.id === exerciseId)?.title ?? exerciseId.replace(/-/g, ' ');

  const accentColor  = colors.accent;
  const cbtColor     = colors.cbt;
  const successColor = colors.success;

  const MODALITY_COLORS: Record<string, string> = {
    rebt: accentColor,
    cbt:  cbtColor,
  };

  const modalityBars: BarDatum[] = (data?.exercisesByModality ?? []).map((m) => ({
    label: m.modality.toUpperCase(),
    value: m.count,
    color: MODALITY_COLORS[m.modality] ?? colors.mutedForeground,
  }));

  const typeColors = [successColor, cbtColor, '#C45E5E', '#4A8A9E', accentColor, '#7B6EAD'];
  const typeBars: BarDatum[] = (data?.exercisesByType ?? []).slice(0, 6).map((t, i) => ({
    label: t.exerciseId.replace(/-/g, ' '),
    value: t.count,
    color: typeColors[i % typeColors.length]!,
  }));

  const maxModality = Math.max(...(data?.exercisesByModality ?? []).map((m) => m.count), 1);
  const maxType     = Math.max(...(data?.exercisesByType ?? []).map((t) => t.count), 1);
  const chartWidth  = Math.max(240, windowWidth - 72);

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const hasAnyData =
    (data?.moodTrend?.length ?? 0) > 0 ||
    (data?.exercisesByModality?.length ?? 0) > 0 ||
    (data?.totalCompleted ?? 0) > 0;

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text entering={SlideInDown.duration(700).delay(80).springify().damping(16)}
          style={[s.heading, { color: colors.foreground }]}>
          Progress
        </Animated.Text>

        {/* Streak + totals row */}
        <Animated.View entering={FadeIn.delay(150)} style={s.statRow}>
          {[
            { label: 'Day streak', value: data?.currentStreak ?? 0,  color: accentColor },
            { label: 'Best streak', value: data?.longestStreak ?? 0, color: cbtColor },
            { label: 'Completed',   value: data?.totalCompleted ?? 0, color: successColor },
          ].map((stat) => (
            <View key={stat.label}
              style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

        {!hasAnyData ? (
          <Animated.View entering={FadeIn.delay(300)}
            style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>Nothing here yet</Text>
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
              Complete exercises and check-ins to see your mood trend, streaks, and growth over time.
            </Text>
          </Animated.View>
        ) : (
          <>
            {(data?.moodTrend?.length ?? 0) > 0 && (
              <Card title="Mood Trend — last 30 days" delay={100}
                cardBg={colors.card} borderColor={colors.border} titleColor={colors.foreground}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <LegendDot color={accentColor}  label="Before exercise" labelColor={colors.mutedForeground} />
                  <LegendDot color={successColor} label="After exercise"  labelColor={colors.mutedForeground} />
                </View>
                <MoodLineChart
                  data={data!.moodTrend} width={chartWidth} height={150}
                  accentColor={accentColor} successColor={successColor}
                  gridColor={colors.border} labelColor={colors.mutedForeground}
                />
              </Card>
            )}

            <Card title="Belief Journey" delay={180}
              cardBg={colors.card} borderColor={colors.border} titleColor={colors.foreground}>
              <BeliefFunnelChart
                active={data?.beliefFunnel?.active ?? 0}
                challenged={data?.beliefFunnel?.challenged ?? 0}
                resolved={data?.beliefFunnel?.resolved ?? 0}
                labelColor={colors.mutedForeground}
                pctColor={colors.mutedForeground}
              />
            </Card>

            {modalityBars.length > 0 && (
              <Card title="Sessions by Modality" delay={260}
                cardBg={colors.card} borderColor={colors.border} titleColor={colors.foreground}>
                <HorizontalBars data={modalityBars} maxVal={maxModality}
                  trackColor={colors.muted} labelColor={colors.mutedForeground} countColor={colors.foreground} />
              </Card>
            )}

            {typeBars.length > 0 && (
              <Card title="Top Exercises" delay={340}
                cardBg={colors.card} borderColor={colors.border} titleColor={colors.foreground}>
                <HorizontalBars data={typeBars} maxVal={maxType}
                  trackColor={colors.muted} labelColor={colors.mutedForeground} countColor={colors.foreground} />
              </Card>
            )}

            {(pastSessions?.length ?? 0) > 0 && (
              <Card title="Past Exercises" delay={420}
                cardBg={colors.card} borderColor={colors.border} titleColor={colors.foreground}>
                {pastSessions!.slice(0, 10).map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={[s.historyRow, { borderColor: colors.border }]}
                    onPress={() => router.push(`/exercise-history/${session.id}` as never)}
                  >
                    <View style={s.historyText}>
                      <Text style={[s.historyTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {exerciseTitle(session.exerciseId)}
                      </Text>
                      <Text style={[s.historyMeta, { color: colors.mutedForeground }]}>
                        {new Date(session.createdAt).toLocaleDateString()}
                        {session.moodBefore != null && session.moodAfter != null
                          ? ` · mood ${session.moodBefore}→${session.moodAfter}`
                          : ''}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 20, gap: 20 },
  heading:   { fontSize: 28, fontFamily: 'Inter_700Bold', marginTop: 20 },
  statRow:   { flexDirection: 'row', gap: 10 },
  statCard:  { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  emptyBox:  { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10, marginTop: 40 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyText: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  historyMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyTitle:{ fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});
