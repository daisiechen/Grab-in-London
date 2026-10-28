import { fireEvent, screen } from '@testing-library/react-native';
import { MealCard } from './MealCard.tsx';
import { createTestApp, renderApp } from '../test/render.tsx';
import { meal } from '../test/fixtures.ts';

it('opens the meal from its title and text, and the avatar opens the person instead', async () => {
  const app = createTestApp(), open = jest.fn(), person = jest.fn();
  await renderApp(app, <MealCard meal={meal()} onPress={open} onPerson={person} />);
  // Text is a descendant of the card action, so a tap on the title reaches it on device.
  await fireEvent.press(screen.getByText('Sunday dinner'));
  expect(open).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: /View .*’s profile/ }));
  expect(person).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
});
