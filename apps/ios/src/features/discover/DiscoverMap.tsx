import { useEffect, useRef } from 'react';
import { IllustratedMap, AreaPin, type AreaMapProps } from './IllustratedMap.tsx';
import { CENTRAL_LONDON } from './map-region.ts';
import { MapMarker, StyledMap, nativeMapAvailable, type StyledMapHandle } from './StyledMap';

export { nativeMapAvailable };

/**
 * Discovery map. With Google available: a styled native map (palette of the demo artwork) with the
 * same area count pins; otherwise the demo illustration, so discovery never shows an empty map.
 */
export function DiscoverMap(props: AreaMapProps) {
  if (!nativeMapAvailable()) return <IllustratedMap {...props} />;
  return <GoogleAreaMap {...props} />;
}

function GoogleAreaMap({ groups, activeCode, onSelect }: AreaMapProps) {
  const map = useRef<StyledMapHandle>(null);
  const active = groups.find((g) => g.code === activeCode);
  useEffect(() => {
    if (active?.lat != null && active.lng != null) map.current?.animateToRegion({ ...CENTRAL_LONDON, latitude: active.lat, longitude: active.lng }, 250);
  }, [active?.lat, active?.lng]);
  return (
    <StyledMap ref={map}>
      {groups.filter((g) => g.lat != null && g.lng != null).map((g) => (
        <MapMarker key={g.code} testID={`map-pin-${g.code}`} identifier={g.code} coordinate={{ latitude: g.lat!, longitude: g.lng! }} onPress={() => onSelect(g.code)} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
          <AreaPin group={g} active={g.code === activeCode} />
        </MapMarker>
      ))}
    </StyledMap>
  );
}
