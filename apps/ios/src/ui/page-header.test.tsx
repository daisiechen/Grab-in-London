import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PageHeader } from './PageHeader.tsx';

describe('PageHeader', () => {
  it('big title as the header, short muted line under it, optional control on the title row', async () => {
    await render(<PageHeader size="tab" title="A little hello." subtitle="Before and after the table." right={<Text>Bell</Text>} />);
    expect(screen.getByRole('header', { name: 'A little hello.' })).toBeOnTheScreen();
    expect(screen.getByText('Before and after the table.')).toBeOnTheScreen();
    expect(screen.getByText('Bell')).toBeOnTheScreen();
  });
});
