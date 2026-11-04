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

  it('disables dates after `latest`', async () => {
    await render(<DateChoices label="Deadline date" selected={[]} onToggle={() => {}} today="2026-10-20" latest="2026-10-22" />);
    expect(screen.getByRole('radio', { name: /^\w+ 22 / })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /^\w+ 23 / })).toBeDisabled();
  });
});
