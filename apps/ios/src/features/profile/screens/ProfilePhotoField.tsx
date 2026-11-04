import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Avatar } from '../../../ui/Avatar.tsx';
import { TextAction } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { createStyles } from '../../../ui/styles.ts';
import { colors } from '../../../ui/tokens.ts';
import { useServices, useSessionState } from '../../../services.tsx';
import { PhotoError, pickProfilePhoto, ProfilePhotoService } from '../photo.ts';

/**
 * Profile photo control (setup and Edit profile): current photo or initial, Upload/Change, Remove with
 * an inline confirmation. Saves immediately on its own (PUT/DELETE /me/avatar), independent of the
 * form's Save button; the session's Me (and so the form's If-Match version) is updated in place.
 */
export function ProfilePhotoField({ displayName }: { displayName: string }) {
  const services = useServices();
  const state = useSessionState();
  const me = state.status === 'signedIn' ? state.session.user : null;
  const photos = useMemo(() => new ProfilePhotoService(services.api, services.session, services.newId), [services]);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;
  const hasPhoto = !!me.avatarUrl;

  const upload = async () => {
    setError(null);
    setConfirming(false);
    let picked: { base64: string } | null;
    try {
      picked = await pickProfilePhoto();
    } catch (e) {
      setError(e instanceof PhotoError ? e.message : 'We couldn’t open your photos. Please try again.');
      return;
    }
    if (!picked) return;
    setBusy('upload');
    const res = await photos.upload(picked.base64, me.version);
    setBusy(null);
    if (res.kind === 'failed') setError(res.message);
  };
  const remove = async () => {
    setError(null);
    setBusy('remove');
    const res = await photos.remove(me.version);
    setBusy(null);
    setConfirming(false);
    if (res.kind === 'failed') setError(res.message);
  };

  return (
    <View style={styles.wrap} testID="profile-photo">
      <View style={styles.row}>
        <View>
          <Avatar person={{ displayName: displayName.trim() || me.displayName || '?', avatarUrl: me.avatarUrl }} size={64} />
          {busy ? <View style={styles.busy}><ActivityIndicator color={colors.white} accessibilityLabel={busy === 'upload' ? 'Uploading photo' : 'Removing photo'} /></View> : null}
        </View>
        <View style={styles.side}>
          <Text style={styles.label}>Profile photo</Text>
          {busy ? (
            <Text style={styles.hint} accessibilityLiveRegion="polite">{busy === 'upload' ? 'Uploading your photo…' : 'Removing your photo…'}</Text>
          ) : confirming ? (
            <>
              <Text style={styles.hint}>Remove your photo? Your tables will see your initial instead.</Text>
              <View style={styles.actions}>
                <TextAction label="Remove photo" destructive onPress={() => void remove()} />
                <TextAction label="Cancel" onPress={() => setConfirming(false)} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.actions}>
                <TextAction label={hasPhoto ? 'Change photo' : 'Upload photo'} onPress={() => void upload()} />
                {hasPhoto ? <TextAction label="Remove" destructive onPress={() => { setError(null); setConfirming(true); }} /> : null}
              </View>
              <Text style={styles.hint}>{hasPhoto ? 'Your tables see this photo.' : 'Optional. Without a photo, your tables see your initial.'}</Text>
            </>
          )}
        </View>
      </View>
      <FormMessage message={error} />
    </View>
  );
}

const styles = createStyles({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  side: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: '500', color: colors.muted },
  actions: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  hint: { fontSize: 11, lineHeight: 15, color: colors.muted },
  busy: { position: 'absolute', top: 0, left: 0, width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
});
