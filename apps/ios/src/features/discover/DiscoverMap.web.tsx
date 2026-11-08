import { IllustratedMap, type AreaMapProps } from './IllustratedMap.tsx';

/** react-native-maps has no web renderer; the web preview always shows the demo illustration. */
export const nativeMapAvailable = () => false;
export function DiscoverMap(props: AreaMapProps) {
  return <IllustratedMap {...props} />;
}
