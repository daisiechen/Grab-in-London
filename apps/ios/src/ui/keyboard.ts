import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type View } from 'react-native';
import type { ComponentRef } from 'react';

/**
 * keyboardVerticalOffset for a KeyboardAvoidingView, measured (on the page view that holds it at its top) instead of guessed. Under the iOS 27
 * translucent navigation bar the view starts at the top of the window, so a fixed header height
 * over-shrinks the padding and the pinned footer lands on top of the focused field.
 */
export function useKeyboardOffset() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [offset, setOffset] = useState(0);
  const onLayout = () => ref.current?.measureInWindow((_x, y) => { if (Number.isFinite(y)) setOffset(Math.max(0, y)); });
  return { ref, onLayout, offset };
}

/** True while the software keyboard is up (iOS: from the will-show event so the layout moves with it). */
export function useKeyboardShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return shown;
}
