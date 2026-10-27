import { useEffect, useRef } from 'react';
import { UIManager } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { IllustratedMap, AreaPin, type AreaMapProps } from './IllustratedMap.tsx';
import { MAP_STYLE } from './map-style.ts';

const CENTRAL_LONDON = { latitude: 51.5115, longitude: -0.1318, latitudeDelta: 0.03, longitudeDelta: 0.03 };

/** Google native map needs the bundle-restricted iOS key, a development build and the Google module. */
export function nativeMapAvailable(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY)
    && Constants.executionEnvironment !== 'storeClient'
    && Boolean(UIManager.getViewManagerConfig('AIRGoogleMap'));
}

/**
 * Discovery map. With Google available: a styled native map (palette of the demo artwork) with the
 * same area count pins; otherwise the demo illustration, so discovery never shows an empty map.
 */
export function DiscoverMap(props: AreaMapProps) {
  if (!nativeMapAvailable()) return <IllustratedMap {...props} />;
  return <GoogleAreaMap {...props} />;
}

function GoogleAreaMap({ groups, activeCode, onSelect }: AreaMapProps) {
  const map = useRef<MapView>(null);
  const active = groups.find((g) => g.code === activeCode);
  useEffect(() => {
    if (active?.lat != null && active.lng != null) map.current?.animateToRegion({ ...CENTRAL_LONDON, latitude: active.lat, longitude: active.lng }, 250);
  }, [active?.lat, active?.lng]);
  return (
    <MapView
      ref={map}
      testID="native-map"
      accessibilityLabel="Map of central London"
      provider={PROVIDER_GOOGLE}
      style={{ width: '100%', height: '100%' }}
      initialRegion={CENTRAL_LONDON}
      customMapStyle={MAP_STYLE}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
    >
      {groups.filter((g) => g.lat != null && g.lng != null).map((g) => (
        <Marker key={g.code} testID={`map-pin-${g.code}`} identifier={g.code} coordinate={{ latitude: g.lat!, longitude: g.lng! }} onPress={() => onSelect(g.code)} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
          <AreaPin group={g} active={g.code === activeCode} />
        </Marker>
      ))}
    </MapView>
  );
}
