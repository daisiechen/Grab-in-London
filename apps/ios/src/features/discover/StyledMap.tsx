import type { ReactNode, Ref } from 'react';
import { UIManager } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MAP_STYLE } from './map-style.ts';
import { CENTRAL_LONDON, type MapRegion } from './map-region.ts';

/** Google native map needs the bundle-restricted iOS key, a development build and the Google module. */
export function nativeMapAvailable(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY)
    && Constants.executionEnvironment !== 'storeClient'
    && Boolean(UIManager.getViewManagerConfig('AIRGoogleMap'));
}

export type StyledMapHandle = MapView;

/**
 * The app's Google map: demo palette (map-style.ts), no POIs, no location button. Callers check
 * `nativeMapAvailable()` first and show their illustrated fallback otherwise.
 */
export function StyledMap({ ref, children, initialRegion = CENTRAL_LONDON, onRegionChangeComplete, accessibilityLabel = 'Map of central London', testID = 'native-map' }: {
  ref?: Ref<MapView>;
  children?: ReactNode;
  initialRegion?: MapRegion;
  onRegionChangeComplete?: (region: MapRegion) => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <MapView
      ref={ref}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      provider={PROVIDER_GOOGLE}
      style={{ width: '100%', height: '100%' }}
      initialRegion={initialRegion}
      customMapStyle={MAP_STYLE}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      {...(onRegionChangeComplete ? { onRegionChangeComplete: (r: MapRegion) => onRegionChangeComplete(r) } : {})}
    >
      {children}
    </MapView>
  );
}

export { Marker as MapMarker };
