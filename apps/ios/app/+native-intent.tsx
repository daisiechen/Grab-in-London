import {incomingMealPath} from '../src/features/share/incoming.ts';
/** Expo invokes this for cold and warm native links; it never sends an application. */
export function redirectSystemPath({path}:{path:string;initial:boolean}){
 return incomingMealPath(path,process.env.EXPO_PUBLIC_MEAL_ORIGIN??'');
}
