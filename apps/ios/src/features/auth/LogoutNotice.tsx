import {useSyncExternalStore} from 'react';
import {StyleSheet,View} from 'react-native';
import type {SessionManager} from './session.ts';
import {Body} from '../../ui/Text.tsx';
import {TextAction} from '../../ui/Button.tsx';
/** Session-owned notice survives the settings route being unmounted by local sign-out. */
export function LogoutNotice({session}:{session:SessionManager}){
 const visible=useSyncExternalStore(session.subscribeLogoutNotice,session.getLogoutNotice,session.getLogoutNotice);
 if(!visible)return null;
 return <View style={styles.notice} accessibilityRole="alert">
  <Body>Signed out on this iPhone. Fancy hasn’t confirmed that the remote session ended. It may remain active until it expires.</Body>
  <TextAction label="Dismiss sign-out notice" onPress={session.dismissLogoutNotice}/>
 </View>;
}
const styles=StyleSheet.create({notice:{padding:12,gap:8}});
