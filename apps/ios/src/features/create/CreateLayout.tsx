import { Fragment, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HALF_HOUR_SLOTS } from '../../lib/london.ts';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { STEPS, type FlowKind, type Step } from './model.ts';
import { Reveal, RevealScope, useRevealScroll } from './reveal.tsx';

const HEADINGS = ['A place at your table.', 'Good company starts here.', 'Keep things clear.', 'Ready to bring people together?'] as const;
const INTROS = [
  'Choose a restaurant, then find a time for your group.',
  'Give new faces a feel for your meal.',
  'Let everyone know what they’ll spend and who’s booking.',
  'Check the details your guests will see before you publish.',
] as const;
const EDIT_HEADINGS = ['Change the place and time.', 'Update your introduction.', 'Update the costs.', 'Ready to save your changes?'] as const;
const EDIT_INTROS = [
  'You can change these until you approve your first guest.',
  'Refresh what new faces read about your meal.',
  'Adjust what guests should expect to spend.',
  'Check the details guests will see. Only what you changed is saved.',
] as const;

/**
 * Create page frame: the native header stays (form page), content starts right under it, and the
 * step action is pinned at the bottom. iOS keeps the focused field above the keyboard
 * (automaticallyAdjustKeyboardInsets) without needing the header height.
 */
export function CreateLayout({ step, onStep, footer, children, testID, kind = 'create' }: { step: Step; onStep: (s: Step) => void; footer: ReactNode; children: ReactNode; testID?: string; kind?: FlowKind }) {
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
          <PageHeader size="page" title={(kind === 'edit' ? EDIT_HEADINGS : HEADINGS)[step]} subtitle={(kind === 'edit' ? EDIT_INTROS : INTROS)[step]} />
          {children}
        </RevealScope>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>
    </View>
  );
}

/**
 * Demo `.create-progress`, compact (owner review 2026-10-28): one 18pt row that never competes with
 * the page title. Current step: filled forest dot + bold forest label; done: pale-green dot with a
 * forest tick, can be revisited; later: hairline dot, muted, disabled. Connectors turn forest once passed.
 */
export function StepIndicator({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${step + 1} of 4`}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <Fragment key={label}>
            {i > 0 ? <View style={[styles.stepLine, i <= step && styles.stepLineOn]} /> : null}
            <Pressable
              testID={`step-${i}`}
              accessibilityRole="button"
              accessibilityLabel={done ? `${label}, completed` : current ? `${label}, current step` : label}
              accessibilityState={{ disabled: i >= step, selected: current }}
              disabled={i >= step}
              onPress={() => onStep(i as Step)}
              style={styles.stepItem}
              hitSlop={8}
            >
              <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                {done ? <Icon name="Check" size={11} color={colors.forest} /> : <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, done && styles.stepLabelDone, current && styles.stepLabelCurrent]}>{label}</Text>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/** Section icon: a Radix icon, or the `£` glyph used for money rows across the app. */
export type SectionIcon = IconName | '£';

/**
 * One soft card per section (owner review 2026-10-28: the form read flat). Surface background on the
 * white page, 15pt bold ink title with a small forest icon, optional marker or link on the right.
 */
export function Section({ title, icon, children, right, testID }: { title?: string; icon?: SectionIcon; children: ReactNode; right?: ReactNode; testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      {title ? (
        <View style={styles.sectionHead}>
          <View style={styles.titleRow}>
            {icon === '£' ? <Text style={styles.glyph}>£</Text> : icon ? <Icon name={icon} size={15} color={colors.forest} /> : null}
            <Text accessibilityRole="header" style={styles.h2} numberOfLines={1}>{title}</Text>
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Small right-side marker on a section title: muted “Optional”, peach “Required”. */
export function SectionMarker({ label, tone = 'muted', accessibilityLabel }: { label: string; tone?: 'muted' | 'peach'; accessibilityLabel?: string }) {
  return (
    <View style={[styles.marker, tone === 'peach' && styles.markerPeach]} accessible accessibilityLabel={accessibilityLabel ?? label}>
      <Text style={[styles.markerText, tone === 'peach' && styles.markerTextPeach]}>{label}</Text>
    </View>
  );
}

export const Hint = ({ children }: { children: ReactNode }) => <Text style={styles.hint}>{children}</Text>;

/**
 * Type and colour roles of the Create steps (owner review 2026-10-28, second pass):
 * page title 24/700 ink (PageHeader) → card title 15/700 ink + forest icon → chosen value 15/600 ink →
 * field label 12/500 muted → placeholder / unset 14/400 muted → hint 11 muted → links 13/600 forest →
 * errors danger. Inputs and triggers are white hairline boxes so they stand out on the surface card.
 */
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
        <Icon name={icon} size={14} color={value ? colors.forest : colors.muted} />
        <Text style={value ? styles.triggerText : styles.placeholder} numberOfLines={1}>{value ?? placeholder}</Text>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={11} color={open ? colors.forest : colors.muted} />
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

/**
 * Compact people stepper (owner review 2026-10-28: the segmented 2–6 control was too big): one 44pt
 * row, label and a tiny hint on the left, − value + on the right with 32pt round buttons that disable
 * at the bounds. VoiceOver reads the row as one adjustable control (swipe up/down) with its value;
 * the buttons carry their own labels (“Increase minimum”) for Voice Control and tests.
 */
export function Stepper({ label, hint, name, value, min, max, onChange, testID }: { label: string; hint?: string; /** Short noun for the button labels, e.g. “minimum”. */ name: string; value: number; min: number; max: number; onChange: (n: number) => void; testID?: string }) {
  const canDown = value > min;
  const canUp = value < max;
  const step = (delta: number) => { const next = Math.min(max, Math.max(min, value + delta)); if (next !== value) onChange(next); };
  const valueText = `${value} ${value === 1 ? 'person' : 'people'}`;
  return (
    <View
      testID={testID}
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0)}
    >
      <View style={styles.stepperText}>
        <Text style={styles.stepperLabel} numberOfLines={1}>{label}</Text>
        {hint ? <Text style={styles.stepperHint} numberOfLines={1}>{hint}</Text> : null}
      </View>
      <View style={styles.stepperControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${name}`} accessibilityState={{ disabled: !canDown }} disabled={!canDown} onPress={() => step(-1)} hitSlop={6} style={[styles.round, !canDown && styles.roundOff]}>
          <Icon name="Minus" size={14} color={canDown ? colors.forest : colors.line} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${name}`} accessibilityState={{ disabled: !canUp }} disabled={!canUp} onPress={() => step(1)} hitSlop={6} style={[styles.round, !canUp && styles.roundOff]}>
          <Icon name="Plus" size={14} color={canUp ? colors.forest : colors.line} />
        </Pressable>
      </View>
    </View>
  );
}

/** Hairline between rows that share one card (e.g. the two people steppers). */
export const Divider = () => <View style={styles.divider} />;

/** Small forest semibold link (“Edit”, “Change”, “Cancellation terms”) with a descriptive accessibility label. */
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
  /** White hairline box: stands out on the surface card. */
  box: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, gap: 4, backgroundColor: colors.white },
  /** A chosen value or the name of a thing: the most prominent text inside a card. */
  value: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  strong: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink },
  muted: { fontSize: 12, lineHeight: 17, color: colors.muted },
  /** Unset value (“No time chosen”): muted, regular weight. */
  unset: { fontSize: 14, lineHeight: 20, color: colors.muted },
  tiny: { fontSize: 11, lineHeight: 15, color: colors.muted },
});

const styles = createStyles({
  page: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepLine: { flex: 1, height: 1.5, minWidth: 6, marginHorizontal: 6, borderRadius: 1, backgroundColor: colors.line },
  stepLineOn: { backgroundColor: colors.forest },
  stepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  stepDotDone: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  stepDotCurrent: { borderColor: colors.forest, backgroundColor: colors.forest },
  // lineHeight equals the inner height and the glyph is centred, so the number sits in the middle of the dot.
  stepNum: { fontSize: 10, lineHeight: 16, height: 16, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, fontWeight: '700', color: colors.muted },
  stepNumCurrent: { color: colors.white },
  stepLabel: { fontSize: 12, lineHeight: 15, color: colors.muted },
  stepLabelDone: { color: colors.forest, fontWeight: '500' },
  stepLabelCurrent: { color: colors.forest, fontWeight: '700' },
  card: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  glyph: { width: 15, textAlign: 'center', fontSize: 15, lineHeight: 18, fontWeight: '700', color: colors.forest },
  h2: { flexShrink: 1, fontSize: 15, lineHeight: 20, letterSpacing: -0.2, fontWeight: '700', color: colors.ink },
  marker: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  markerPeach: { backgroundColor: colors.peach, borderColor: colors.peach },
  markerText: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.muted },
  markerTextPeach: { color: colors.ink, fontWeight: '700' },
  hint: { fontSize: 11, lineHeight: 16, color: colors.muted },
  legend: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.muted },
  dropWrap: { flex: 1, minWidth: 0, gap: 5 },
  trigger: { height: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white },
  triggerOpen: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  triggerText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  placeholder: { flex: 1, fontSize: 14, color: colors.muted },
  panel: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.white },
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
  stepper: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepperText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stepperLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  stepperHint: { flexShrink: 1, fontSize: 11, color: colors.muted },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.secondaryBorder, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  roundOff: { borderColor: colors.line },
  stepperValue: { minWidth: 20, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line },
  link: { color: colors.forest, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  footer: { paddingTop: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, gap: 8 },
});
