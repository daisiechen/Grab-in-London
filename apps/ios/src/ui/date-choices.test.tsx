import { render, screen } from '@testing-library/react-native';
import { DateChoices } from './DateChoices.tsx';

describe('DateChoices', () => {
  it('shows a Monday-first weekday row above the days, hidden from screen readers', async () => {
    await render(<DateChoices label="Date" selected={['2026-10-20']} onToggle={() => {}} today="2026-10-20" />);
    const letters = screen.getAllByText(/^[MTWFS]$/, { includeHiddenElements: true }).map((n) => n.props.children);
    expect(letters).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(screen.queryByText('M')).toBeNull();
    expect(screen.getByRole('radio', { name: /^\w+ 20 / })).toBeSelected();
  });
});
