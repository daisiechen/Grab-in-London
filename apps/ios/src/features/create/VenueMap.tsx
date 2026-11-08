import { useState } from 'react';
import { Image, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { images } from '../../ui/images.ts';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { ILLUSTRATED_ASPECT, ILLUSTRATED_BOUNDS, illustratedPoint, regionBounds, type MapBounds, type MapRegion } from '../discover/map-region.ts';
import { MapMarker, StyledMap, nativeMapAvailable } from '../discover/StyledMap';

export interface VenuePoint { id: string; n: number; name: string; lat: number; lng: number }

/** Wide enough for the picker's short, full-width frame to show most of central London. */
export const PICKER_REGION: MapRegion = { latitude: 51.5125, longitude: -0.13, latitudeDelta: 0.022, longitudeDelta: 0.05 };

/** What the picker searches before the map reports anything: the native view, or the whole artwork. */
export const initialPickerBounds = (): MapBounds => (nativeMapAvailable() ? regionBounds(PICKER_REGION) : ILLUSTRATED_BOUNDS);

type Props = { points: VenuePoint[]; activeId: string | null; onSelect: (id: string) => void; onBoundsChange: (bounds: MapBounds) => void };

/**
 * Restaurant map for the Create picker. Google native (pannable, reloads for the new bounds) when
 * configured; otherwise the demo illustration with the same numbered pins, which can't be panned.
 */
export function VenueMap(props: Props) {
  return nativeMapAvailable() ? <NativeVenueMap {...props} /> : <IllustratedVenueMap {...props} />;
}

function NativeVenueMap({ points, activeId, onSelect, onBoundsChange }: Props) {
  return (
    <StyledMap initialRegion={PICKER_REGION} accessibilityLabel="Map of restaurants in central London" onRegionChangeComplete={(r) => onBoundsChange(regionBounds(r))}>
      {points.map((p) => (
        // tracksViewChanges={false} only redraws a marker when it remounts: key it by number and selection.
        <MapMarker key={`${p.id}:${p.n}:${p.id === activeId}`} testID={`venue-pin-${p.id}`} identifier={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => onSelect(p.id)} tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
          <VenuePin point={p} active={p.id === activeId} />
        </MapMarker>
      ))}
    </StyledMap>
  );
}

/**
 * The artwork at full frame width, shifted so the pins sit in view. Pins are placed with the
 * affine fit in map-region.ts; ones outside the visible slice stay in the list only.
 */
function IllustratedVenueMap({ points, activeId, onSelect }: Props) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  const artHeight = frame.width * ILLUSTRATED_ASPECT;
  const placed = points.map((p) => ({ p, at: illustratedPoint(p.lat, p.lng) })).filter(({ at }) => at.x >= 0 && at.x <= 100 && at.y >= 0 && at.y <= 100);
  const ys = placed.map(({ at }) => (at.y / 100) * artHeight);
  const centre = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : artHeight * 0.5;
  const top = Math.min(0, Math.max(frame.height - artHeight, frame.height / 2 - centre));
  return (
    <View style={styles.fill} onLayout={onLayout} testID="venue-map-illustrated">
      {frame.width > 0 ? <Image source={images.londonMap} style={{ position: 'absolute', left: 0, top, width: frame.width, height: artHeight }} accessibilityLabel="Map of central London" /> : null}
      {frame.width > 0 ? placed.map(({ p, at }) => {
        const x = (at.x / 100) * frame.width;
        const y = (at.y / 100) * artHeight + top;
        // The pin's tip marks the place; keep the whole pin inside the frame.
        if (y < PIN.h * 0.5 || y > frame.height + 4 || x < 6 || x > frame.width - 6) return null;
        return <VenuePin key={p.id} point={p} active={p.id === activeId} onPress={() => onSelect(p.id)} style={{ position: 'absolute', left: x - PIN.w / 2, top: Math.max(0, y - PIN.h) }} />;
      }) : null}
    </View>
  );
}

const PIN = { w: 26, h: 30 };

/** Numbered forest pin matching the list row's number; peach and larger while previewed. */
export function VenuePin({ point, active, onPress, style }: { point: VenuePoint; active: boolean; onPress?: () => void; style?: object }) {
  const body = <Text style={[styles.pinText, active && styles.pinTextActive]}>{point.n}</Text>;
  const label = `${point.n}. ${point.name} on the map`;
  if (!onPress) return <View accessibilityLabel={label} style={[styles.pin, active && styles.pinActive, style]}>{body}</View>;
  return (
    <Pressable testID={`venue-pin-${point.id}`} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} hitSlop={6} style={[styles.pin, active && styles.pinActive, style]}>
      {body}
    </Pressable>
  );
}

const styles = createStyles({
  fill: { width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#eeeee5' },
  pin: { width: PIN.w, height: PIN.h, borderTopLeftRadius: 13, borderTopRightRadius: 13, borderBottomRightRadius: 13, borderBottomLeftRadius: 4, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.white, shadowColor: colors.forest, shadowOpacity: 0.16, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, zIndex: 1 },
  pinActive: { backgroundColor: colors.peach, transform: [{ scale: 1.15 }], zIndex: 2 },
  pinText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  pinTextActive: { color: colors.ink },
});
