import { useEffect, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { useKeyboard, useScreenPortal } from "./mobile";

/** A compact, phone-contained single-choice menu; all half-hour values remain available. */
export function TimePicker({ value, options, onChange }: { value: string; options: string[]; onChange: (time: string) => void }) {
  const [open, setOpen] = useState(false);
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  const menuRef = useRef<HTMLDivElement>(null);
  const activeTime = useRef(value);
  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const menu = menuRef.current;
      const item = selectedRef.current || menu?.querySelector<HTMLDivElement>("[data-time]");
      if (!menu || !item) return;
      menu.scrollTop = Math.max(0, item.offsetTop - (menu.clientHeight - item.offsetHeight) / 2);
      activeTime.current = value || options[0];
      item.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return <DropdownMenu.Root modal={false} open={open} onOpenChange={(next) => { keyboard.hide(); setOpen(next); }}>
    <DropdownMenu.Trigger asChild><button type="button" className="time-picker-trigger" aria-label="Time"><span>{value || "Choose a time"}</span><ChevronDownIcon aria-hidden="true" /></button></DropdownMenu.Trigger>
    <DropdownMenu.Portal container={screenRef.current}>
      <DropdownMenu.Content ref={menuRef} className="time-picker-menu" aria-label="Choose a time" side="bottom" align="start" sideOffset={6} collisionBoundary={screenRef.current} collisionPadding={12} onKeyDownCapture={(event) => {
        // Keep keyboard movement and the focused option visible in the phone menu.
        const index = Math.max(0, options.indexOf(activeTime.current));
        const next = event.key === "ArrowDown" ? (index + 1) % options.length : event.key === "ArrowUp" ? (index - 1 + options.length) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
        if (next >= 0) {
          event.preventDefault(); event.stopPropagation(); activeTime.current = options[next];
          const item = menuRef.current?.querySelector<HTMLElement>(`[data-time="${options[next]}"]`);
          item?.focus({ preventScroll: true });
          const menu = menuRef.current;
          if (menu && item) {
            if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop;
            else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight;
          }
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); event.stopPropagation(); onChange(activeTime.current); setOpen(false);
        }
      }}>
        <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
          {options.map((time) => <DropdownMenu.RadioItem key={time} ref={time === value ? selectedRef : undefined} className="time-picker-option" data-time={time} onFocus={() => { activeTime.current = time; }} value={time}>{time}<DropdownMenu.ItemIndicator><CheckIcon aria-hidden="true" /></DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
