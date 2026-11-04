import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { EditProfileScreen } from './EditProfileScreen.tsx';
import { ProfileSetupScreen } from './ProfileSetupScreen.tsx';
import { MyProfileScreen } from './MyProfileScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../../test/render.tsx';
import { resetRouter } from '../../../test/router.ts';
import { fail, networkDown, ok } from '../../../test/mock-fetch.ts';
import { incompleteMe, me, publicProfile } from '../../../test/fixtures.ts';
import { avatarSource, localPhotos } from '../../../ui/images.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../../test/router.ts').expoRouterMock);
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const mockContext = { crop: jest.fn(), resize: jest.fn(), renderAsync: jest.fn() };
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg', PNG: 'png' } }));

const pickerMock = ImagePicker.launchImageLibraryAsync as jest.Mock;
const manipulateMock = ImageManipulator.manipulate as jest.Mock;
const saveAsync = jest.fn();
const PHOTO_URL = 'http://localhost:5174/v1/avatars/0f8a3c52-6b1e-4d2a-9c77-1e2f3a4b5c6d';
const JPEG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U';

beforeEach(() => {
  resetRouter();
  jest.clearAllMocks();
  for (const fn of [mockContext.crop, mockContext.resize]) fn.mockReturnValue(mockContext);
  mockContext.renderAsync.mockResolvedValue({ saveAsync });
  manipulateMock.mockReturnValue(mockContext);
  saveAsync.mockResolvedValue({ uri: 'file:///tmp/out.jpg', width: 512, height: 512, base64: JPEG_B64 });
  pickerMock.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/pick.heic', width: 3024, height: 4032 }] });
});

describe('profile photo control', () => {
  it('picks → crops square → resizes to a 512px JPEG → uploads with If-Match, then shows the photo', async () => {
    const app = createTestApp();
    const user = me();
    await signIn(app, user);
    app.mock.on('PUT', '/v1/me/avatar', ok({ ...user, avatarUrl: PHOTO_URL, version: '4' }));
    await renderApp(app, <EditProfileScreen />);
    expect(screen.queryByRole('radio', { name: /portrait/ })).toBeNull();
    expect(screen.getByText('Optional. Without a photo, your tables see your initial.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    await waitFor(() => expect(app.mock.callsTo('PUT', '/v1/me/avatar')).toHaveLength(1));
    expect(pickerMock).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] }));
    expect(mockContext.crop).toHaveBeenCalledWith({ originX: 0, originY: 504, width: 3024, height: 3024 });
    expect(mockContext.resize).toHaveBeenCalledWith({ width: 512, height: 512 });
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8, base64: true });
    const [call] = app.mock.callsTo('PUT', '/v1/me/avatar');
    expect(call?.headers['if-match']).toBe('"3"');
    expect(call?.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.body).toEqual({ imageBase64: JPEG_B64 });

    await screen.findByRole('button', { name: 'Change photo' });
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
    const state = app.services.session.getState();
    expect(state.status === 'signedIn' && state.session.user).toMatchObject({ avatarUrl: PHOTO_URL, version: '4' });

    // The form's own save now uses the version the upload returned.
    app.mock.on('PATCH', '/v1/me', ok({ ...user, avatarUrl: PHOTO_URL, version: '5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(app.mock.callsTo('PATCH', '/v1/me')).toHaveLength(1));
    expect(app.mock.callsTo('PATCH', '/v1/me')[0]?.headers['if-match']).toBe('"4"');
    expect(app.mock.callsTo('PATCH', '/v1/me')[0]?.body).not.toHaveProperty('avatarRef');
  });

  it('does nothing when the picker is cancelled', async () => {
    const app = createTestApp();
    await signIn(app, me());
    pickerMock.mockResolvedValue({ canceled: true, assets: null });
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    await waitFor(() => expect(pickerMock).toHaveBeenCalled());
    expect(app.mock.callsTo('PUT', '/v1/me/avatar')).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes the photo only after confirming', async () => {
    const app = createTestApp();
    const user = me({ avatarUrl: PHOTO_URL });
    await signIn(app, user);
    app.mock.on('DELETE', '/v1/me/avatar', ok({ ...user, avatarUrl: null, version: '4' }));
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove your photo? Your tables will see your initial instead.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(app.mock.callsTo('DELETE', '/v1/me/avatar')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
    await screen.findByRole('button', { name: 'Upload photo' });
    const [call] = app.mock.callsTo('DELETE', '/v1/me/avatar');
    expect(call?.headers['if-match']).toBe('"3"');
    const state = app.services.session.getState();
    expect(state.status === 'signedIn' && state.session.user.avatarUrl).toBeNull();
  });

  it('shows the server’s reason for an unsupported photo, and an offline message', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('PUT', '/v1/me/avatar', fail(422, 'VALIDATION_FAILED', { message: 'HEIC photos aren’t supported yet. Please choose a JPEG or PNG photo.', fieldErrors: { 'body.imageBase64': 'Unsupported image type' } }), 1);
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    expect(await screen.findByText('HEIC photos aren’t supported yet. Please choose a JPEG or PNG photo.')).toBeTruthy();

    app.mock.on('PUT', '/v1/me/avatar', networkDown);
    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    expect(await screen.findByText('You appear to be offline. Try again when you’re connected.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeTruthy();
  });

  it('rejects a too-large photo before uploading and reports an unreadable one', async () => {
    const app = createTestApp();
    await signIn(app, me());
    saveAsync.mockResolvedValueOnce({ uri: 'file:///tmp/out.jpg', width: 512, height: 512, base64: 'A'.repeat(2_900_000) });
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    expect(await screen.findByText('This photo is too large. Please choose one under 2 MB.')).toBeTruthy();
    expect(app.mock.callsTo('PUT', '/v1/me/avatar')).toHaveLength(0);

    mockContext.renderAsync.mockRejectedValueOnce(new Error('decode failed'));
    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    expect(await screen.findByText('We couldn’t read this photo. Please choose another one.')).toBeTruthy();
  });

  it('retries once with the refreshed version after a version conflict', async () => {
    const app = createTestApp();
    const user = me();
    await signIn(app, user);
    app.mock.on('PUT', '/v1/me/avatar', fail(409, 'VERSION_CONFLICT', { currentVersion: '7' }), 1);
    app.mock.on('GET', '/v1/me', ok({ ...user, version: '7' }));
    await renderApp(app, <EditProfileScreen />);
    app.mock.on('PUT', '/v1/me/avatar', ok({ ...user, avatarUrl: PHOTO_URL, version: '8' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    await screen.findByRole('button', { name: 'Change photo' });
    expect(app.mock.callsTo('PUT', '/v1/me/avatar').map((c) => c.headers['if-match'])).toEqual(['"3"', '"7"']);
  });

  it('is offered during profile setup too', async () => {
    const app = createTestApp();
    await signIn(app, incompleteMe());
    await renderApp(app, <ProfileSetupScreen />);
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeTruthy();
  });

  it('My profile shows the photo from Me', async () => {
    const app = createTestApp();
    const user = me({ avatarUrl: PHOTO_URL });
    await signIn(app, user);
    app.mock.on('GET', new RegExp(`/v1/profiles/${user.id}`), ok({ profile: publicProfile(user.id, user.displayName ?? 'Alex'), reviews: [], nextReviewCursor: null }));
    await renderApp(app, <MyProfileScreen />);
    await screen.findByRole('button', { name: 'Edit profile' });
    expect(JSON.stringify(screen.toJSON())).toContain('"uri":"http://localhost:3000/v1/avatars/0f8a3c52-6b1e-4d2a-9c77-1e2f3a4b5c6d"');
  });
});

describe('avatarSource', () => {
  it('loads uploaded photos from the configured API, bundles seed portraits and resolves preview uploads', () => {
    expect(avatarSource('https://fancy.example/v1/avatars/0f8a3c52-6b1e-4d2a-9c77-1e2f3a4b5c6d')).toEqual({ uri: 'http://localhost:3000/v1/avatars/0f8a3c52-6b1e-4d2a-9c77-1e2f3a4b5c6d' });
    localPhotos.set('preview://uploads/p1.jpg', 'data:image/jpeg;base64,/9j/4AAQ');
    expect(avatarSource('preview://uploads/p1.jpg')).toEqual({ uri: 'data:image/jpeg;base64,/9j/4AAQ' });
    expect(avatarSource('data:image/jpeg;base64,/9j/4AAQ')).toBeNull();
    const seeded = avatarSource('preview://images/maya.png');
    expect(seeded).not.toBeNull();
    expect(seeded).not.toHaveProperty('uri', 'preview://images/maya.png');
    expect(avatarSource('http://tracker.example/x.jpg')).toBeNull();
    expect(avatarSource('javascript:alert(1)')).toBeNull();
    expect(avatarSource(null)).toBeNull();
  });
});
