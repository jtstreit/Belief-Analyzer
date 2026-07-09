import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useGetProgress } from '@workspace/api-client-react';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import Svg, { Line, Circle, Polyline, Rect, Text as SvgText, G } from 'react-native-svg';

// ── Mini line chart for mood trend ──────────────────────────────────────────
type MoodPoint = { date: string; avgBefore: number; avgAfter: number };

function MoodLineChart({ data, width, height }: { data: MoodPoint[]; width: number; height: number }) {
  if (data.length === 0) return null;
  const pad = { top: 12, bottom: 28, left: 28, right: 12 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const minV = 1;
  const maxV = 10;
  const range = maxV - minV;

  const xFor = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yFor = (v: number) => pad.top + chartH - ((v - minV) / range) * chartH;

  const beforePoints = data.map((d, i) => `${xFor(i)},${yFor(d.avgBefore)}`).join(' ');
  const afterPoints = data.map((d, i) => `${xFor(i)},${yFor(d.avgAfter)}`).join(' ');

  // Y-axis labels
  const yLabels = [1, 4, 7, 10];

  // X-axis: show first and last dates only
  const firstDate = data[0]?.date.slice(5) ?? '';
  const lastDate = data[data.length - 1]?.date.slice(5) ?? '';

  return (
    <Svg width={width} height={height}>
      {/* Grid lines */}
      {yLabels.map((v) => (
        <G key={v}>
          <Line
            x1={pad.left} y1={yFor(v)}
            x2={pad.left + chartW} y2={yFor(v)}
            stroke="#252B42" strokeWidth={1}
          />
          <SvgText x={pad.left - 4} y={yFor(v) + 4} fontSize={9} fill="#6B7194" textAnchor="end">
            {v}
          </SvgText>
        </G>
      ))}
      {/* Before line */}
      <Polyline points={beforePoints} fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* After line */}
      <Polyline points={afterPoints} fill="none" stroke="#10B981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {data.map((d, i) => (
        <G key={i}>
          <Circle cx={xFor(i)} cy={yFor(d.avgBefore)} r={3} fill="#F59E0B" />
          <Circle cx={xFor(i)} cy={yFor(d.avgAfter)} r={3} fill="#10B981" />
        </G>
      ))}
      {/* X-axis date labels */}
      <SvgText x={pad.left} y={height - 4} fontSize={9} fill="#6B7194" textAnchor="start">{firstDate}</SvgText>
      {data.length > 1 && (
        <SvgText x={pad.left + chartW} y={height - 4} fontSize={9} fill="#6B7194" textAnchor="end">{lastDate}</SvgText>
      )}
    </Svg>
  );
}

// ── Horizontal bar chart ─────────────────────────────────────────────────────
type BarDatum = { label: string; value: number; color: string };

function HorizontalBars({ data, maxVal }: { data: BarDatum[]; maxVal: number }) {
  return (
    <View style={hb.container}>
      {data.map((d) => (
        <View key={d.label} style={hb.row}>
          <Text style={hb.label} numberOfLines={1}>{d.label}</Text>
          <View style={hb.track}>
            <View
              style={[
                hb.fill,
                { width: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%`, backgroundColor: d.color },
              ]}
            />
          </View>
          <Text style={hb.count}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

const hb = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 100, fontSize: 12, fontFamily: 'Inter_500Medium', color: '#9CA3AF', textTransform: 'capitalize' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#1E2540', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  count: { width: 24, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#F0F2F8', textAlign: 'right' },
});

// ── Belief funnel ─────────────────────────────────────────────────────────────
function BeliefFunnelChart({ active, challenged, resolved }: { active: number; challenged: number; resolved: number }) {
  const total = active + challenged + resolved;
  const data = [
    { label: 'Active', value: active, color: '#F43F5E' },
    { label: 'Challenged', value: challenged, color: '#F59E0B' },
    { label: 'Resolved', value: resolved, color: '#10B981' },
  ];
  return (
    <View style={bf.container}>
      {data.map((d) => (
        <View key={d.label} style={bf.item}>
          <View style={[bf.circle, { borderColor: d.color }]}>
            <Text style={[bf.number, { color: d.color }]}>{d.value}</Text>
          </View>
          <Text style={bf.itemLabel}>{d.label}</Text>
          <Text style={bf.pct}>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</Text>
        </View>
      ))}
    </View>
  );
}

const bf = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  item: { alignItems: 'center', gap: 6 },
  circle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  itemLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },
  pct: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#6B7194' },
});

// ── Section card wrapper ──────────────────────────────────────────────────────
function Card({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View entering={SlideInDown.delay(delay).duration(500).springify()} style={card.wrapper}>
      <Text style={card.title}>{title}</Text>
      {children}
    </Animated.View>
  );
}

const card = StyleSheet.create({
  wrapper: {
    backgroundColor: '#141928',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252B42',
    padding: 16,
    gap: 14,
  },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#F0F2F8' },
});

// ── Legend dot ────────────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' }}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useGetProgress();

  const MODALITY_COLORS: Record<string, string> = {
    rebt: '#F59E0B',
    cbt: '#6366F1',
  };

  const modalityBars: BarDatum[] = (data?.exercisesByModality ?? []).map((m) => ({
    label: m.modality.toUpperCase(),
    value: m.count,
    color: MODALITY_COLORS[m.modality] ?? '#6B7194',
  }));

  const typeBars: BarDatum[] = (data?.exercisesByType ?? []).slice(0, 6).map((t, i) => ({
    label: t.exerciseId.replace(/-/g, ' '),
    value: t.count,
    color: ['#10B981', '#6366F1', '#F43F5E', '#14B8A6', '#F59E0B', '#8B5CF6'][i % 6]!,
  }));

  const maxModality = Math.max(...(data?.exercisesByModality ?? []).map((m) => m.count), 1);
  const maxType = Math.max(...(data?.exercisesByType ?? []).map((t) => t.count), 1);

  const chartWidth = 340;

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
        <Animated.Text entering={SlideInDown.duration(700).delay(80).springify().damping(16)} style={[s.heading, { color: colors.foreground }]}>
          Progress
        </Animated.Text>

        {/* Streak + totals row */}
        <Animated.View entering={FadeIn.delay(150)} style={s.statRow}>
          {[
            { label: 'Day streak', value: data?.currentStreak ?? 0, color: '#F59E0B' },
            { label: 'Best streak', value: data?.longestStreak ?? 0, color: '#6366F1' },
            { label: 'Completed', value: data?.totalCompleted ?? 0, color: '#10B981' },
          ].map((stat) => (
            <View key={stat.label} style={s.statCard}>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

        {!hasAnyData ? (
          <Animated.View entering={FadeIn.delay(300)} style={s.emptyBox}>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptyText}>
              Complete exercises and check-ins to see your mood trend, streaks, and growth over time.
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Mood trend */}
            {(data?.moodTrend?.length ?? 0) > 0 && (
              <Card title="Mood Trend — last 30 days" delay={100}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <LegendDot color="#F59E0B" label="Before exercise" />
                  <LegendDot color="#10B981" label="After exercise" />
                </View>
                <MoodLineChart data={data!.moodTrend} width={chartWidth} height={150} />
              </Card>
            )}

            {/* Belief funnel */}
            <Card title="Belief Journey" delay={180}>
              <BeliefFunnelChart
                active={data?.beliefFunnel?.active ?? 0}
                challenged={data?.beliefFunnel?.challenged ?? 0}
                resolved={data?.beliefFunnel?.resolved ?? 0}
              />
            </Card>

            {/* Exercises by modality */}
            {modalityBars.length > 0 && (
              <Card title="Sessions by Modality" delay={260}>
                <HorizontalBars data={modalityBars} maxVal={maxModality} />
              </Card>
            )}

            {/* Exercises by type */}
            {typeBars.length > 0 && (
              <Card title="Top Exercises" delay={340}>
                <HorizontalBars data={typeBars} maxVal={maxType} />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 20 },
  heading: { fontSize: 28, fontFamily: 'Inter_700Bold', marginTop: 20 },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#141928',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252B42',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#6B7194', textAlign: 'center' },
  emptyBox: {
    backgroundColor: '#141928',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252B42',
    padding: 28,
    alignItems: 'center',
    gap: 10,
    marginTop: 40,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#F0F2F8' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#6B7194', textAlign: 'center', lineHeight: 22 },
});
