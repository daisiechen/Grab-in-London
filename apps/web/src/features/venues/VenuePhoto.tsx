import { useEffect, useState, type ReactNode } from 'react';
import type { ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';

type Photo = ResponseOf<'getVenuePhoto'>['data']['photo'];
interface Props {
  venueRef: string; placeId: string; label: string | null; className?: string | undefined;
  /** Lay the image and its mandatory attribution out separately (cards put the credit under the card). */
  children?: (parts: { image: ReactNode; attribution: ReactNode }) => ReactNode;
}

/**
 * The meal's own restaurant photo with its Google attribution (iOS RestaurantPhoto). Request-local
 * provider data: never written to drafts, storage, the query cache or telemetry. An expired image
 * URL is refreshed once; then the neutral placeholder stays.
 */
export function VenuePhoto(props: Props) {
  return <PhotoForVenue key={`${props.venueRef}:${props.placeId}`} {...props} />;
}

function PhotoForVenue({ venueRef, placeId, label, className = 'photo', children }: Props) {
  const { api } = useApi();
  const [photo, setPhoto] = useState<Photo>(null);
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setPhoto(null); setLoaded(false); setFailed(false);
    if (!venueRef || !placeId || placeId === 'unavailable') return;
    void api.client.call('getVenuePhoto', { params: { venueRef } })
      .then((result) => { if (active && result.data.placeId === placeId && result.data.photo?.uri.startsWith('https://')) setPhoto(result.data.photo); })
      .catch(() => { if (active) setPhoto(null); });
    return () => { active = false; };
  }, [api, venueRef, placeId, refresh]);

  const showing = photo && !failed;
  const image = (
    <span className={className}>
      {showing ? (
        <img
          src={photo.uri} alt={`Restaurant ${label ?? ''}`.trim()} referrerPolicy="no-referrer" loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(false); setFailed(true); if (refresh === 0) setRefresh(1); }}
        />
      ) : <span className="ph-empty" aria-label="Restaurant photo unavailable">Restaurant photo unavailable</span>}
    </span>
  );
  const attribution = showing && loaded ? (
    <span className="attrib">
      <span>{photo.source}</span>
      {photo.authorAttributions.map((a, i) => (
        <span key={i}> · {a.uri && a.uri.startsWith('https://') ? <a href={a.uri} target="_blank" rel="noopener noreferrer">{a.displayName}</a> : a.displayName}</span>
      ))}
    </span>
  ) : null;
  if (children) return <>{children({ image, attribution })}</>;
  return <>{image}{attribution}</>;
}
