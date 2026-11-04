import { renderHook } from '@testing-library/react-native';
import { useLeaveAuth } from './useAuthGate.ts';

const mockRouter = { dismiss: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
let mockRoutes: Array<{ name: string }> = [];
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useNavigation: () => ({ getState: () => ({ routes: mockRoutes }) }) }));

beforeEach(() => { jest.clearAllMocks(); });

it('closes the modal sign-in flow before opening the remembered target over the original page', async () => {
  mockRoutes = [{ name: '(tabs)' }, { name: 'meals/[mealId]/index' }, { name: 'sign-in' }, { name: 'email' }];
  const { result } = await renderHook(() => useLeaveAuth());
  result.current('/meals/m1/apply');
  expect(mockRouter.dismiss).toHaveBeenCalledWith(2);
  expect(mockRouter.navigate).toHaveBeenCalledWith('/meals/m1/apply');
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('replaces in place when there is no sign-in screen to close (profile gate reached directly)', async () => {
  mockRoutes = [{ name: '(tabs)' }, { name: 'profile-setup' }];
  const { result } = await renderHook(() => useLeaveAuth());
  result.current('/create');
  expect(mockRouter.replace).toHaveBeenCalledWith('/create');
  expect(mockRouter.dismiss).not.toHaveBeenCalled();
});
