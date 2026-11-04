import { useEffect, useState } from 'react';
import type { Meal } from '../../api/types.ts';
import { Primary, TextAction } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { longDate } from '../../lib/format.ts';
import { SITE_ORIGIN, mealPath } from '../../seo/meal-seo.ts';
import { areaName } from './present.ts';

type ShareNavigator = Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };

/**
 * Share a meal (spec §5 分享面板): the system share sheet first where the browser has one; otherwise
 * this panel. “Link copied” only shows after the clipboard write succeeds; if it fails the link stays
 * on screen to select by hand. The link carries no token or private detail (M10).
 */
export function ShareSheet({ open, onOpenChange, meal }: { open: boolean; onOpenChange: (open: boolean) => void; meal: Meal }) {
  const notify = useToast();
  const [panel, setPanel] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const url = SITE_ORIGIN + mealPath(meal);
  const when = `${longDate(meal.startsAt.localDate)}, ${meal.startsAt.localTime}`;
  const text = `Fancy a bite? ${meal.title} — ${when}, ${areaName(meal.areaCode)}`;

  useEffect(() => {
    if (!open) { setPanel(false); setCopyFailed(false); return; }
    const nav = navigator as ShareNavigator;
    if (typeof nav.share !== 'function') { setPanel(true); return; }
    nav.share({ title: meal.title, text, url }).then(() => onOpenChange(false), (error: unknown) => {
      // Dismissing the system sheet is a choice, not a failure; anything else falls back to the panel.
      if (error instanceof DOMException && error.name === 'AbortError') onOpenChange(false); else setPanel(true);
    });
  }, [open]);

  const copy = async (value: string, done: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onOpenChange(false);
      notify(done);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <Sheet open={open && panel} onOpenChange={onOpenChange} title="Share this meal">
      <p className="body">Friends can see the table and ask to join. Sharing doesn’t hold a seat.</p>
      <div className="sum" style={{ marginTop: 0 }}>
        <div className="h"><span>{meal.title}</span></div>
        <div className="l">{`${when} · ${areaName(meal.areaCode)}`}</div>
        <p className="share-url">{url}</p>
      </div>
      {copyFailed && <p className="msg-line error" role="alert">We couldn’t copy automatically. Select the link above and copy it.</p>}
      <Primary onClick={() => void copy(url, 'Link copied')}>Copy link</Primary>
      <Primary secondary onClick={() => void copy(`${text} ${url}`, 'Invitation copied')}>Copy invitation text</Primary>
      <a className="btn sec" style={{ marginTop: 8 }} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}>WhatsApp<span className="vh"> (opens in a new tab)</span></a>
      <TextAction onClick={() => onOpenChange(false)}>Cancel</TextAction>
    </Sheet>
  );
}
