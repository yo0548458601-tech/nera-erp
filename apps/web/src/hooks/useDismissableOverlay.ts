'use client';

import { useEffect, useRef, type RefObject } from 'react';

type Boundary = RefObject<HTMLElement>;

type UseDismissableOverlayOptions = {
  restoreFocusRef?: Boundary;
};

/**
 * Closes an open panel (popover, menu, drawer, modal) when the user clicks
 * outside all of the given boundary elements, or presses Escape. Clicks on
 * any boundary element (the panel itself, its trigger button, etc.) are
 * ignored so the trigger's own onClick can still toggle the panel.
 */
export function useDismissableOverlay(
  isOpen: boolean,
  onDismiss: () => void,
  boundaries: Boundary[],
  options: UseDismissableOverlayOptions = {},
) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const boundariesRef = useRef(boundaries);
  boundariesRef.current = boundaries;

  const restoreFocusRef = useRef(options.restoreFocusRef);
  restoreFocusRef.current = options.restoreFocusRef;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const isInsideBoundaries = (target: Node) =>
      boundariesRef.current.some((ref) => ref.current?.contains(target));

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !isInsideBoundaries(event.target)) {
        onDismissRef.current();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismissRef.current();
        restoreFocusRef.current?.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
}
