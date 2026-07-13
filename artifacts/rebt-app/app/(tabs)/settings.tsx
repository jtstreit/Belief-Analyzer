import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useModality, MODALITY_LABELS, type Modality } from '@/contexts/ModalityContext';
import { useRouter } from 'expo-router';

function SectionHeader({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

function OptionCard({
  modality, active, activeColor, colors, onPress,
}: {
  modality: Modality; active: boolean; activeColor: string; colors: any; onPress: () => void;
}) {
  const isREBT = modality === 'rebt';
  const descriptions = {
    rebt: [
      'ABC(DE) model — Activating event → Belief → Consequence → Disputing → Effective philosophy',
      'Targets: demandingness, awfulizing, low frustration tolerance, global rating',
      'Goal: unconditional self/other/life acceptance',
      'Techniques: disputation (empirical, logical, pragmatic), shame-attacking, rational-emotive imagery',
    ],
    cbt: [
      'Situation → Automatic Thoughts → Emotion/Behaviour, with core beliefs beneath',
      'Targets: cognitive distortions (Burns\' 10), automatic thoughts, intermediate & core beliefs',
      'Goal: balanced, flexible thinking through collaborative empiricism',
      'Techniques: thought records, downward arrow, behavioral experiments, Socratic questioning',
    ],
  };

  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        { backgroundColor: colors.card, borderColor: active ? activeColor : colors.border },
        active && { borderWidth: 2 },
      ]}
      onPress={onPress}
    >
      <View style={styles.optionTop}>
        <View style={[styles.optionIcon, { backgroundColor: activeColor + '22' }]}>
          <Feather name={isREBT ? 'zap' : 'layers'} size={20} color={activeColor} />
        </View>
        <View style={styles.optionTitle}>
          <Text style={[styles.optionName, { color: colors.foreground }]}>
            {MODALITY_LABELS[modality].name}
          </Text>
          <Text style={[styles.optionFounder, { color: colors.mutedForeground }]}>
            {isREBT ? 'Albert Ellis, 1950s' : 'Aaron Beck, 1960s'}
          </Text>
        </View>
        {active && (
          <View style={[styles.checkCircle, { backgroundColor: activeColor }]}>
            <Feather name="check" size={14} color="#000" />
          </View>
        )}
      </View>
      <View style={styles.bulletList}>
        {descriptions[modality].map((line, i) => (
          <View key={i} style={styles.bullet}>
            <View style={[styles.dot, { backgroundColor: active ? activeColor : colors.mutedForeground }]} />
            <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>{line}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { modality, setModality } = useModality();
  const router = useRouter();

  const activeColor = modality === 'rebt' ? colors.accent : colors.cbt;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>More</Text>

      <Animated.View entering={FadeInDown.springify()}>
        <SectionHeader label="TOOLS" colors={colors} />
        <View style={styles.toolRow}>
          {[
            { label: 'Mind Map', icon: 'layers', route: '/(tabs)/mindmap' },
            { label: 'Feed', icon: 'activity', route: '/(tabs)/feed' },
            { label: 'Progress', icon: 'trending-up', route: '/(tabs)/progress' },
          ].map((tool) => (
            <TouchableOpacity
              key={tool.label}
              style={[styles.toolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(tool.route as any)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tool.label}`}
            >
              <Feather name={tool.icon as any} size={21} color={activeColor} />
              <Text style={[styles.toolLabel, { color: colors.foreground }]}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Modality selector */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <SectionHeader label="THERAPY MODALITY" colors={colors} />
        <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
          Chooses your coach's framework, language, and which exercises are highlighted.
          You can switch at any time — your history is always kept.
        </Text>
        <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
          Belief Analyzer is the dual-modality successor to CBT Sentinel. Coach language,
          exercises, and recommendations follow the framework you select.
        </Text>

        <OptionCard
          modality="rebt"
          active={modality === 'rebt'}
          activeColor={colors.accent}
          colors={colors}
          onPress={() => setModality('rebt')}
        />

        <View style={{ height: 12 }} />

        <OptionCard
          modality="cbt"
          active={modality === 'cbt'}
          activeColor={colors.cbt}
          colors={colors}
          onPress={() => setModality('cbt')}
        />
      </Animated.View>

      {/* Psychoeducation: REBT vs CBT */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={{ marginTop: 28 }}>
        <SectionHeader label="REBT vs CBT — KEY DIFFERENCES" colors={colors} />
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow
            label="Root cause"
            rebt="Irrational beliefs (the Bs), especially rigid musts"
            cbt="Automatic thoughts and distortions sitting on core beliefs"
            colors={colors}
          />
          <InfoRow
            label="What changes"
            rebt="Philosophical stance — from demanding to preferential thinking"
            cbt="Specific thoughts tested against evidence; beliefs updated gradually"
            colors={colors}
          />
          <InfoRow
            label="Disputation"
            rebt="Active, forceful, three-pronged (empirical, logical, pragmatic)"
            cbt="Gentle Socratic guided discovery; collaborative"
            colors={colors}
          />
          <InfoRow
            label="Acceptance"
            rebt="Unconditional self/other/life acceptance is the explicit goal"
            cbt="Balanced, nuanced thinking; acceptance via evidence-review"
            colors={colors}
          />
          <InfoRow
            label="Depth"
            rebt="Goes straight for the core irrational philosophy"
            cbt="Works from surface ATs down to intermediate and core beliefs"
            colors={colors}
          />
        </View>
      </Animated.View>

      {/* Disclaimer */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={{ marginTop: 28 }}>
        <SectionHeader label="IMPORTANT DISCLAIMER" colors={colors} />
        <View style={[styles.disclaimerCard, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '40' }]}>
          <Feather name="alert-triangle" size={16} color={colors.destructive} style={{ marginTop: 2 }} />
          <Text style={[styles.disclaimerText, { color: colors.foreground }]}>
            This app is a <Text style={{ fontFamily: 'Inter_700Bold' }}>self-help tool</Text>, not
            therapy, crisis care, or a medical device. It cannot diagnose or treat mental health conditions.
            Coach replies and analyses are AI-generated and can be wrong. Relevant text is sent to this
            app's Render backend and Claude (Anthropic). If you are in crisis or need professional support,
            contact emergency services, a qualified therapist, or a crisis service.
          </Text>
        </View>
      </Animated.View>

      {/* Crisis resources */}
      <Animated.View entering={FadeInDown.delay(350).springify()} style={{ marginTop: 16 }}>
        <SectionHeader label="CRISIS RESOURCES" colors={colors} />
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
          {[
            { name: 'International Association for Suicide Prevention', url: 'https://www.iasp.info/resources/Crisis_Centres/' },
            { name: 'Crisis Text Line (US/UK/IE/CA)', url: 'https://www.crisistextline.org' },
            { name: 'Samaritans (UK & Ireland): 116 123', url: 'tel:116123' },
            { name: '988 Suicide & Crisis Lifeline (US/Canada): 988', url: 'tel:988' },
          ].map((r) => (
            <TouchableOpacity key={r.name} onPress={() => Linking.openURL(r.url)} style={styles.crisisLink}>
              <Feather name="external-link" size={14} color={colors.accent} />
              <Text style={[styles.crisisText, { color: colors.accent }]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function InfoRow({ label, rebt, cbt, colors }: { label: string; rebt: string; cbt: string; colors: any }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.infoColumns}>
        <View style={styles.infoCol}>
          <Text style={[styles.infoColLabel, { color: colors.accent }]}>REBT</Text>
          <Text style={[styles.infoColText, { color: colors.mutedForeground }]}>{rebt}</Text>
        </View>
        <View style={[styles.infoColDivider, { backgroundColor: colors.border }]} />
        <View style={styles.infoCol}>
          <Text style={[styles.infoColLabel, { color: (colors as any).cbt }]}>CBT</Text>
          <Text style={[styles.infoColText, { color: colors.mutedForeground }]}>{cbt}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 24 },
  toolRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  toolCard: { flex: 1, minHeight: 76, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  toolLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  sectionHeader: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, marginBottom: 8 },
  sectionDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, marginBottom: 16 },
  optionCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { flex: 1 },
  optionName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  optionFounder: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bulletList: { gap: 6, paddingLeft: 4 },
  bullet: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  bulletText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18, flex: 1 },
  infoCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  infoRow: { padding: 16, borderBottomWidth: 1, gap: 8 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  infoColumns: { flexDirection: 'row', gap: 8 },
  infoCol: { flex: 1, gap: 4 },
  infoColDivider: { width: 1 },
  infoColLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  infoColText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  disclaimerCard: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 12 },
  disclaimerText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, flex: 1 },
  crisisLink: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crisisText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
