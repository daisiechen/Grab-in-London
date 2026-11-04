import { Text, ScrollView, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Reveal, RevealScope, revealOffset, useRevealScroll } from './reveal.tsx';
import { layout, mockContentGeometry } from './reveal-test-utils.ts';

afterEach(() => jest.restoreAllMocks());

describe('revealOffset', () => {
  const viewport = { scrollY: 0, height: 600, insetTop: 0, insetBottom: 0 };

  it('leaves a block that is already fully visible alone', () => {
    expect(revealOffset({ y: 100, height: 200 }, viewport)).toBeNull();
  });

  it('scrolls a block hidden below the visible area (behind the pinned footer) up until its bottom shows, plus a margin', () => {
    expect(revealOffset({ y: 500, height: 300 }, viewport)).toBe(500 + 300 + 12 - 600);
  });

  it('counts the keyboard (bottom inset) and the current scroll position', () => {
    expect(revealOffset({ y: 900, height: 100 }, { scrollY: 400, height: 600, insetTop: 0, insetBottom: 300 })).toBe(900 + 100 + 12 - 600 + 300);
  });

  it('aligns a block taller than the visible area to its top, below the translucent header', () => {
    expect(revealOffset({ y: 700, height: 900 }, { scrollY: -100, height: 800, insetTop: 100, insetBottom: 0 })).toBe(700 - 12 - 100);
  });

  it('aligns a block above the visible area to its top', () => {
    expect(revealOffset({ y: 50, height: 100 }, { ...viewport, scrollY: 400 })).toBe(38);
  });
});

function Harness({ open }: { open: boolean }) {
  const { scrollProps, reveal } = useRevealScroll();
  return (
    <ScrollView {...scrollProps} testID="scroll">
      <RevealScope value={reveal}>
        <Text>Above</Text>
        {open ? <Reveal testID="panel"><View /></Reveal> : null}
      </RevealScope>
    </ScrollView>
  );
}

describe('Reveal', () => {
  it('scrolls the expanded block into view once it is laid out, and again only when its height changes', async () => {
    const { scrollTo } = mockContentGeometry({ y: 700, height: 320 });
    await render(<Harness open />);
    await fireEvent(screen.getByTestId('scroll'), 'layout', layout(600));
    await fireEvent(screen.getByTestId('panel'), 'layout', layout(320));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 700 + 320 + 12 - 600, animated: true });
    await fireEvent(screen.getByTestId('panel'), 'layout', layout(320));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('uses the latest scroll position and the header inset seen at rest', async () => {
    const { scrollTo } = mockContentGeometry({ y: 700, height: 320 });
    await render(<Harness open />);
    await fireEvent.scroll(screen.getByTestId('scroll'), { nativeEvent: { contentOffset: { x: 0, y: -100 }, contentInset: { top: 0, bottom: 0, left: 0, right: 0 }, layoutMeasurement: { width: 390, height: 700 } } });
    await fireEvent(screen.getByTestId('panel'), 'layout', layout(320));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 700 + 320 + 12 - 700, animated: true });
  });

  it('does nothing when the block is already visible', async () => {
    const { scrollTo } = mockContentGeometry({ y: 100, height: 120 });
    await render(<Harness open />);
    await fireEvent(screen.getByTestId('scroll'), 'layout', layout(600));
    await fireEvent(screen.getByTestId('panel'), 'layout', layout(120));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
