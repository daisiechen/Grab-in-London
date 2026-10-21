import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from './tokens.ts';

/**
 * Native modal sheet replacing the prototype runtime BottomSheet. The OS owns presentation; the
 * backdrop dismisses for touch users and an in-sheet Close keeps dismissal reachable for VoiceOver
 * (siblings of an accessibilityViewIsModal view are not focusable).
 */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable importantForAccessibility="no" accessibilityElementsHidden style={styles.backdrop} onPress={onClose} testID="sheet-backdrop" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,36,31,0.35)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.page, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: type.section, fontWeight: '700', color: colors.ink, flex: 1 },
  close: { fontSize: type.control, color: colors.forest, fontWeight: '600' },
});
