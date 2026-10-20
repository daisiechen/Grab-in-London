import { useRef, useState } from "react";
import { KeyboardInput, useKeyboard } from "./mobile";
import { createVenues, restaurantChoice, restaurantMapsUrl, validateRestaurant, type RestaurantChoice } from "./domain";
type MapSpot = { id: string; label: string; x: number; y: number; text: string };
function DemoMap({ spots, selected, onSelect, onSearch, label }: {
  spots: MapSpot[]; selected: string; onSelect: (id: string) => void;
  onSearch?: (ids: string[]) => void; label: string;
}) {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [dirty, setDirty] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; distance: number; view: typeof view; moved: boolean } | null>(null);
  const suppress = useRef(false);
  const clamp = (v: typeof view) => {
    const zoom = Math.max(1, Math.min(2.4, v.zoom));
    const limit = (74 * zoom - 50) / 1.48;
    return { zoom, x: Math.max(-limit, Math.min(limit, v.x)), y: Math.max(-limit, Math.min(limit, v.y)) };
  };
  const zoom = (delta: number) => { setView(v => clamp({ ...v, zoom: v.zoom + delta })); setDirty(true); };
  return <div className="demo-map" ref={root} role="region" aria-label={label} tabIndex={0}
    data-scroll-drag="ignore" data-zoom={view.zoom.toFixed(1)}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === '+' || event.key === '-') { event.preventDefault(); zoom(event.key === '+' ? 0.3 : -0.3); }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault(); setDirty(true);
        setView(v => clamp({...v,x:v.x+(event.key==='ArrowLeft'?5:event.key==='ArrowRight'?-5:0),y:v.y+(event.key==='ArrowUp'?5:event.key==='ArrowDown'?-5:0)}));
      }
    }}
    onPointerDown={event => {
      suppress.current = false;
      if (event.button !== 0 || (event.target as Element).closest('button')) return;
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const p = [...points.current.values()];
      drag.current = { x: event.clientX, y: event.clientY, distance: p.length > 1 ? Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y) : 0, view, moved: false };
    }}
    onPointerMove={event => {
      if (!drag.current || !points.current.has(event.pointerId)) return;
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const d = drag.current, p = [...points.current.values()];
      const dx = event.clientX-d.x, dy = event.clientY-d.y;
      if (Math.hypot(dx,dy) < 6 && p.length < 2) return;
      d.moved = true; suppress.current = true; setDirty(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = root.current!.getBoundingClientRect();
      if (p.length > 1 && d.distance > 0) setView(clamp({ ...d.view, zoom: d.view.zoom * Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/d.distance }));
      else setView(clamp({ ...d.view, x: d.view.x+dx/rect.width*100/1.48, y: d.view.y+dy/rect.height*100/1.48 }));
    }}
    onPointerUp={event => { points.current.delete(event.pointerId); if (!points.current.size) drag.current = null; }}
    onPointerCancel={() => { points.current.clear(); drag.current = null; }}
    onClickCapture={event => { if (suppress.current) { event.preventDefault(); event.stopPropagation(); suppress.current = false; } }}
  >
    <div className="demo-map-world" style={{ transform: `translate(${view.x}%, ${view.y}%) scale(${view.zoom})` }}>
      <img className="map-image" src="/images/london-map.png" alt="Map of central London" draggable={false} />
    </div>
    {spots.map(spot => <button key={spot.id} className={`map-pin ${selected === spot.id ? 'active' : ''}`}
      style={{ left: `${50+(spot.x-50)*view.zoom+1.48*view.x}%`, top: `${50+(spot.y-50)*view.zoom+1.48*view.y}%` }} aria-label={spot.label} aria-pressed={selected === spot.id}
      onClick={() => onSelect(spot.id)}>{spot.text}</button>)}
    {onSearch && dirty && <button className="map-search-area" onClick={() => {
      const ids = spots.filter(p => Math.abs((p.x-50)*view.zoom+1.48*view.x)<48 && Math.abs((p.y-50)*view.zoom+1.48*view.y)<48).map(p => p.id);
      onSearch(ids); setDirty(false);
    }}>Search this area</button>}
    <div className="demo-map-controls">
      <button aria-label="Zoom in" disabled={view.zoom >= 2.4} onClick={() => zoom(0.3)}>+</button>
      <button aria-label="Zoom out" disabled={view.zoom <= 1} onClick={() => zoom(-0.3)}>−</button>
      <button aria-label="Show central London" onClick={() => { setView({x:0,y:0,zoom:1}); setDirty(false); onSearch?.(spots.map(p=>p.id)); }}>⌖</button>
    </div>
  </div>;
}

export function RestaurantPicker({ value, onConfirm }: { value: RestaurantChoice; onConfirm: (restaurant: RestaurantChoice) => void }) {
  const keyboard = useKeyboard();
  const [search, setSearch] = useState("");
  const [candidate, setCandidate] = useState<RestaurantChoice | null>(null);
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState({ name: "", address: "", area: "" });
  const [error, setError] = useState("");
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const matches = createVenues.filter((v) => `${v.name} ${v.area} ${v.cuisine}`.toLowerCase().includes(search.trim().toLowerCase()));
  const visible = matches.filter((v) => !visibleIds || visibleIds.includes(v.name));
  const coords = [{ x: 48, y: 42 }, { x: 76, y: 38 }, { x: 30, y: 70 }];
  const choose = (name: string) => { keyboard.hide(); setEditing(false); setError(""); setCandidate(restaurantChoice(name)); };
  const sample = candidate?.source === "demo" ? createVenues.find((v) => v.name === candidate.name) : undefined;
  return <section className="venue-map-picker" aria-label="Choose a restaurant">
    <label className="field-label">Search restaurants or areas
      <KeyboardInput aria-label="Search restaurants or areas" value={search} placeholder="Restaurant, neighbourhood or cuisine…" onBlur={() => keyboard.hide()} onChange={(e) => { setSearch(e.target.value); setVisibleIds(null); setCandidate(null); setError(""); }} />
    </label>
    <a className="maps-link" href={`https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${search.trim() || "restaurants"}, London` })}`} target="_blank" rel="noopener noreferrer">Search Google Maps ↗</a>
    <p className="muted venue-demo-label">Demo map · sample locations. Add any restaurant using its details below.</p>
    <DemoMap label="Restaurant map" selected={candidate?.source === "demo" ? candidate.name : ""} spots={matches.map((v) => ({ id: v.name, label: `Show ${v.name}`, text: String(createVenues.indexOf(v) + 1), ...coords[createVenues.indexOf(v)] }))} onSelect={choose} onSearch={(ids) => { keyboard.hide(); setVisibleIds(ids); setCandidate(null); }} />
    {(search.trim() || visibleIds) && <div className="venue-map-results" aria-live="polite">
      {!visible.length && <p>No sample restaurants match. Add your restaurant below.</p>}
      {visible.map((v) => <button key={v.name} aria-pressed={candidate?.name === v.name} onClick={() => choose(v.name)}><strong>{v.name}</strong><span>{v.area} · {v.cuisine}</span></button>)}
    </div>}
    {!editing && <button className="text-action add-restaurant" onClick={() => { keyboard.hide(); setManual({ name: search.trim(), address: "", area: "" }); setError(""); setCandidate(null); setEditing(true); }}>Add a restaurant</button>}
    {editing && <div className="manual-restaurant">
      <h3>Add your restaurant</h3><p className="muted">Find it in Google Maps, then enter its name and full address here. Returning from Maps won’t select it automatically.</p>
      {([["name", "Restaurant name", 150], ["address", "Full address", 250], ["area", "Neighbourhood or area", 80]] as const).map(([key, label, max]) => <label className="field" key={key}><span>{label}</span><KeyboardInput aria-label={label} value={manual[key]} maxLength={max} onBlur={() => keyboard.hide()} onChange={(e) => { setManual({ ...manual, [key]: e.target.value }); setError(""); }} /></label>)}
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="primary secondary" onPointerDown={(e) => e.preventDefault()} onClick={() => { keyboard.hide(); const next: RestaurantChoice = { name: manual.name.trim(), address: manual.address.trim(), area: manual.area.trim(), source: "manual" }; const issue = validateRestaurant(next); if (issue) { setError(issue); return; } setCandidate(next); setEditing(false); }}>Preview restaurant</button>
      <button className="text-action" onClick={() => { keyboard.hide(); setEditing(false); setError(""); }}>Cancel adding restaurant</button>
    </div>}
    {candidate && <div className="venue-map-card" aria-label="Restaurant preview"><h3>{candidate.name}</h3><p>{candidate.source === "demo" ? `${candidate.area} · ${sample?.cuisine}` : candidate.address}</p><p>{candidate.source === "demo" ? sample?.note : candidate.area}</p>{sample && <p>£{sample.min}–{sample.max} per person · sample estimate</p>}{candidate.source === "manual" && <><p>Details supplied by you. Set your meal budget in Costs; confirm opening hours and book with the restaurant.</p><a className="maps-link" href={restaurantMapsUrl(candidate)} target="_blank" rel="noopener noreferrer">Check this restaurant in Google Maps ↗</a></>}
      <button className="primary" onPointerDown={(e) => e.preventDefault()} onClick={() => { keyboard.hide(); onConfirm(candidate); setCandidate(null); }}>Use this restaurant</button>
      <button className="text-action" onClick={() => setCandidate(null)}>Cancel selection</button>
    </div>}
    <div className="venue-selection-status" role="status"><strong>Selected: {value.name}</strong><p>{value.source === "manual" ? value.address : `${value.area} · sample restaurant`}</p><small>Choosing a place does not reserve a table.</small></div>
  </section>;
}
