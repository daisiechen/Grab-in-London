import { fireEvent, render, screen } from '@testing-library/react-native';
import { LinkRow } from './LinkRow.tsx';

describe('LinkRow', () => {
  it('is one button with the label (icon and chevron are decoration) and navigates on press', async () => {
    const onPress = jest.fn();
    await render(<LinkRow icon="FileText" label="Cancellation terms" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancellation terms' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
