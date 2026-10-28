import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HALF_HOUR_SLOTS } from '../../lib/london.ts';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { STEPS, type Step } from './model.ts';
import { Reveal, RevealScope, useRevealScroll } from './reveal.tsx';

const HEADINGS = ['A place at your table.', 'Good company starts here.', 'Keep things clear.', 'Ready to bring people together?'] as const;
const INTROS = [
  'Choose a restaurant, then find a time for your group.',
  'Give new faces a feel for your meal.',
  'Let everyone know what they’ll spend and who’s booking.',
  'Check the details your guests will see before you publish.',
] as const;

/**
 * Create page frame: the native header stays (form page), content starts right under it, and the
 * step action is pinned at the bottom. iOS keeps the focused field above the keyboard
 * (automaticallyAdjustKeyboardInsets) without needing the header height.
 */
export function CreateLayout({ step, onStep, footer, children, testID }: { step: Step; onStep: (s: Step) => void; footer: ReactNode; children: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  // In-place pickers and the venue confirm button scroll themselves above the pinned footer.
  const { scrollProps, reveal } = useRevealScroll();
  return (
    <View style={styles.page} testID={testID}>
      <ScrollView
        {...scrollProps}
        testID="create-scroll"
        // iOS 27 headers are translucent: let UIKit inset content below the header.
        contentInsetAdjustmentBehavior="automatic"
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <RevealScope value={reveal}>
          <StepIndicator step={step} onStep={onStep} />
          <Text accessibilityRole="header" style={styles.h1}>{HEADINGS[step]}</Text>
          <Text style={styles.intro}>{INTROS[step]}</Text>
          {children}
        </RevealScope>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>
    </View>
  );
}

/** Demo `.create-progress`: done steps show a tick and can be revisited; later steps are disabled. */
function StepIndicator({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${step + 1} of 4`}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={done ? `${label}, completed` : label}
            accessibilityState={{ disabled: i > step, selected: current }}
            disabled={i >= step}
            onPress={() => onStep(i as Step)}
            style={styles.stepItem}
            hitSlop={4}
          >
            <View style={[styles.stepDot, (done || current) && styles.stepDotOn, current && styles.stepDotCurrent]}>
              {done ? <Icon name="Check" size={12} color={colors.forest} /> : <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.h2}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export const Hint = ({ children }: { children: ReactNode }) => <Text style={styles.hint}>{children}</Text>;

/** Inline dropdown trigger (Discover control style); its panel opens right below the row. */
export function DropTrigger({ label, value, placeholder, icon, open, onPress }: { label: string; value: string | null; placeholder: string; icon: IconName; open: boolean; onPress: () => void }) {
  return (
    <View style={styles.dropWrap}>
      <Text style={styles.legend}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={[styles.trigger, open && styles.triggerOpen]}
      >
        <Icon name={icon} size={14} color={colors.forest} />
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>{value ?? placeholder}</Text>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={11} color={colors.ink} />
      </Pressable>
    </View>
  );
}

/** In-place picker panel; scrolls itself fully into view above the pinned footer when it opens. */
export const DropPanel = ({ children, testID }: { children: ReactNode; testID?: string }) => <Reveal style={styles.panel} testID={testID}>{children}</Reveal>;

const ROW = 40;
/** All 48 half-hour London times in a compact grid that opens scrolled to the current choice. */
export function TimeGrid({ label, value, onChange, isDisabled }: { label: string; value: string | null; onChange: (time: string) => void; /** Slots that would fail validation (e.g. a deadline after T−30) are shown but not selectable. */ isDisabled?: (time: string) => boolean }) {
  const anchor = Math.max(0, HALF_HOUR_SLOTS.indexOf(value ?? '18:00'));
  const [offset] = useState(() => Math.max(0, Math.floor(anchor / 6) - 1) * ROW);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  return (
    <ScrollView ref={scroller} contentInsetAdjustmentBehavior="never" style={styles.timeScroll} contentOffset={{ x: 0, y: offset }} onContentSizeChange={() => scroller.current?.scrollTo({ y: offset, animated: false })} nestedScrollEnabled accessibilityRole="radiogroup" accessibilityLabel={label}>
      <View style={styles.timeGrid}>
        {HALF_HOUR_SLOTS.map((t) => {
          const on = t === value;
          const off = !on && !!isDisabled?.(t);
          return (
            <View key={t} style={styles.timeCell}>
              <Pressable accessibilityRole="radio" accessibilityLabel={t} accessibilityState={{ selected: on, disabled: off }} disabled={off} onPress={() => onChange(t)} style={[styles.timeChip, on && styles.timeChipOn, off && styles.timeChipOff]}>
                <Text style={[styles.timeText, on && styles.timeTextOn, off && styles.timeTextOff]}>{t}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** One-row segmented number choice (2–6 people) so both people rows fit the first screen. */
export function NumberChoice({ label, options, value, onChange }: { label: string; options: readonly number[]; value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.dropWrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.legend}>{label}</Text>
      <View style={styles.segment}>
        {options.map((n, i) => {
          const on = n === value;
          return (
            <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} people`} accessibilityState={{ selected: on }} onPress={() => onChange(n)} style={[styles.segCell, i === 0 && styles.segFirst, on && styles.segOn]}>
              <Text style={[styles.segText, on && styles.segTextOn]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Small underlined in-row link (“Edit”, “Change”) with a descriptive accessibility label. */
export function InlineLink({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={10}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export const shared = createStyles({
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  box: { borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 12, gap: 4, backgroundColor: colors.white },
  soft: { borderRadius: 11, padding: 12, gap: 4, backgroundColor: '#f2f5ee' },
  strong: { fontSize: 14, fontWeight: '700', color: colors.ink },
  body: { fontSize: 13, lineHeight: 19, color: colors.ink },
  muted: { fontSize: 12, lineHeight: 17, color: colors.muted },
  tiny: { fontSize: 10, lineHeight: 14, color: colors.muted },
});

const styles = createStyles({
  page: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  stepDotOn: { borderColor: colors.forest },
  stepDotCurrent: { backgroundColor: colors.forest },
  stepNum: { fontSize: 11, fontWeight: '700', color: colors.muted },
  stepNumCurrent: { color: colors.white },
  stepLabel: { fontSize: 10.5, color: colors.muted },
  stepLabelCurrent: { color: colors.forest, fontWeight: '700' },
  h1: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontWeight: '700', color: colors.ink },
  intro: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 4, marginBottom: 4 },
  section: { marginTop: 16, gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  h2: { fontSize: 16, letterSpacing: -0.3, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 11, lineHeight: 15, color: colors.muted },
  legend: { fontSize: 12, fontWeight: '700', color: colors.ink },
  dropWrap: { flex: 1, minWidth: 0, gap: 6 },
  trigger: { height: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  triggerOpen: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  triggerText: { flex: 1, fontSize: 13, color: colors.ink },
  placeholder: { color: colors.muted },
  panel: { borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 10, backgroundColor: colors.white },
  // Exactly four whole rows, so no sliver of a neighbouring row shows at either edge.
  timeScroll: { maxHeight: ROW * 4 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  timeCell: { width: `${100 / 6}%`, height: ROW, padding: 3 },
  timeChipOff: { backgroundColor: '#f4f5f1', borderColor: '#eceee8' },
  timeTextOff: { color: '#b9bfb6' },
  timeChip: { flex: 1, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  timeChipOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  timeText: { fontSize: 12, color: colors.ink },
  timeTextOn: { color: colors.white, fontWeight: '700' },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 9, overflow: 'hidden' },
  segCell: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.line },
  segFirst: { borderLeftWidth: 0 },
  segOn: { backgroundColor: colors.forest },
  segText: { fontSize: 13, color: colors.ink },
  segTextOn: { color: colors.white, fontWeight: '700' },
  link: { color: colors.forest, fontSize: 12, textDecorationLine: 'underline' },
  footer: { paddingTop: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, gap: 8 },
});
