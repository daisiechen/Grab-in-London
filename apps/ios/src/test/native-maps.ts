// Only the native Google Maps rendering boundary is substituted for Jest; map data/bounds/select logic is real.
jest.mock('react-native-maps',()=>{
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const React=require('react') as typeof import('react');
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const {View,Pressable}=require('react-native') as typeof import('react-native');
 return {__esModule:true,PROVIDER_GOOGLE:'google',default:(props:Record<string,unknown>)=>React.createElement(View,props),Marker:(props:Record<string,unknown>)=>React.createElement(Pressable,props)};
});
