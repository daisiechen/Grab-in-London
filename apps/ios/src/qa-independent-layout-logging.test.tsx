/** Exercise the actual root-level log callback with a synthetic failure carrying private text. */
import {render} from '@testing-library/react-native';
import RootLayout from '../app/_layout.tsx';
import {createServices} from './services.tsx';
jest.mock('./platform/install.ts',()=>({}));
jest.mock('./platform/install-marker.ts',()=>({sandboxInstallMarker:()=>({})}));
jest.mock('./features/auth/credential-store.ts',()=>({secureCredentialStore:()=>({})}));
jest.mock('./config.ts',()=>({apiBaseUrl:()=> 'http://localhost:3000'}));
jest.mock('./services.tsx',()=>({createServices:jest.fn(()=>({}))}));
jest.mock('./AppRoot.tsx',()=>({AppRoot:()=>null}));
jest.mock('expo-router',()=>({Stack:Object.assign(()=>null,{Screen:()=>null})}));
jest.mock('expo-status-bar',()=>({StatusBar:()=>null}));
jest.mock('expo-web-browser',()=>({openAuthSessionAsync:jest.fn()}));
it('QA-CODE-006 root sign-out cleanup log never receives raw credential/storage error content',async()=>{
 const warn=jest.spyOn(console,'warn').mockImplementation(()=>{});
 try{await render(<RootLayout/>);const options=jest.mocked(createServices).mock.calls[0]![0];const secret='SYNTHETIC_PRIVATE_TOKEN_EMAIL_CHAT_7b84';options.onClearError?.(new Error(secret));const logged=warn.mock.calls.flat().map(v=>v instanceof Error?v.message:String(v)).join('\n');expect(logged).not.toContain(secret);}finally{warn.mockRestore();}
});
