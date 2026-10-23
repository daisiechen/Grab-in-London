import {useRouter} from 'expo-router';
import {Screen} from '../src/ui/Screen.tsx';
import {Body,Heading} from '../src/ui/Text.tsx';
import {Primary} from '../src/ui/Button.tsx';
export default function MealLinkUnavailable(){
 const router=useRouter();
 return <Screen><Heading>This meal link isn’t available.</Heading><Body>Discover a meal and check its latest details.</Body><Primary label="Explore meals" onPress={()=>router.replace('/')}/></Screen>;
}
