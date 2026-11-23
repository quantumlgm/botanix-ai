import { useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

interface DragState {
  pointerId: number | null;
  startY: number;
  startTime: number;
  dragging: boolean;
}

const DRAG_START_THRESHOLD_PX = 8;
const CLOSE_DISTANCE_RATIO = 0.3;
const CLOSE_VELOCITY_PX_PER_MS = 0.7;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EMPTY_DRAG_STATE: DragState = {
  pointerId: null,
  startY: 0,
  startTime: 0,
  dragging: false,
};

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>({ ...EMPTY_DRAG_STATE });
  const suppressClickRef = useRef(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Reset any in-flight drag when visibility changes so the sheet animates
  // from a clean position without an extra effect pass.
  if (wasOpen !== open) {
    setWasOpen(open);
    setIsDragging(false);
    setDragOffset(0);
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  const resetDrag = () => {
    dragRef.current = { ...EMPTY_DRAG_STATE };
    setIsDragging(false);
    setDragOffset(0);
  };

  const requestClose = () => {
    onCloseRef.current();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!event.isPrimary) return;

    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: performance.now(),
      dragging: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const delta = event.clientY - drag.startY;
    if (!drag.dragging) {
      if (delta <= DRAG_START_THRESHOLD_PX) return;

      drag.dragging = true;
      setIsDragging(true);
      // Capture only after the drag starts so plain taps still reach buttons.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
      }
    }

    event.preventDefault();
    setDragOffset(Math.max(0, delta));
  };

  const finishDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false
  ) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const delta = Math.max(0, event.clientY - drag.startY);
    const elapsed = Math.max(1, performance.now() - drag.startTime);
    const velocity = delta / elapsed;
    const panelHeight =
      panelRef.current?.offsetHeight ?? window.innerHeight * 0.5;
    const shouldClose =
      !cancelled &&
      drag.dragging &&
      (delta >= panelHeight * CLOSE_DISTANCE_RATIO ||
        velocity >= CLOSE_VELOCITY_PX_PER_MS);

    if (drag.dragging) {
      suppressClickRef.current = true;
    }

    if (shouldClose) {
      resetDrag();
      requestClose();
      return;
    }

    resetDrag();
  };

  const handleLostPointerCapture = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    resetDrag();
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const transform = !open
    ? "translateY(100%)"
    : isDragging
      ? `translateY(${dragOffset}px)`
      : "translateY(0)";

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}
      role="presentation"
      inert={!open}
    >
      <div
        aria-hidden="true"
        onClick={requestClose}
        className={`sheet-backdrop absolute inset-0 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishDrag(event)}
        onPointerCancel={(event) => finishDrag(event, true)}
        onLostPointerCapture={handleLostPointerCapture}
        onClickCapture={handleClickCapture}
        style={{
          transform,
          transition: isDragging ? "none" : undefined,
        }}
        className="sheet-safe-bottom absolute inset-x-0 bottom-0 mx-auto flex max-h-[50dvh] w-full max-w-md touch-none flex-col overflow-hidden rounded-t-[28px] border-t border-line bg-surface text-ink shadow-[0_-18px_48px_-24px_rgba(0,0,0,0.45)] outline-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] select-none"
      >
        <div className="flex shrink-0 flex-col items-center pt-3">
          <span
            aria-hidden="true"
            className="h-1.5 w-10 cursor-grab rounded-full bg-line-strong active:cursor-grabbing"
          />
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}
