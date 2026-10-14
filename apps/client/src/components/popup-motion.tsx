import { motion, type HTMLMotionProps } from "motion/react";
import { useCallback, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { EASE_STANDARD } from "@/lib/motion";

/** What Base UI's `actionsRef` hands back: the popup stays mounted until `unmount` is called. */
export interface PopupActions {
  unmount: () => void;
  close: () => void;
}

const transition = { duration: 0.15, ease: EASE_STANDARD };

/** A backdrop: fades in and out. */
export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition,
};

/** A dialog or menu: fades and settles from 98% (the old `data-starting-style:scale-[0.98]`). */
export const popupMotion = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition,
};

/**
 * Lets Motion play a Base UI popup's exit. Base UI unmounts a closed popup at once; with
 * `actionsRef` on the Root it waits until `unmount()` is called, which `onExitComplete` (put on
 * the popup's motion element as `onAnimationComplete`) does once the exit has played.
 *
 * Wire it up as the Base UI handbook describes: make the Root controlled with `open`, put
 * `<AnimatePresence>` around `{open && <X.Portal keepMounted>…}`, and give the Backdrop and Popup
 * `render={<motion.div {...backdropMotion | popupMotion} />}`.
 */
export function usePopupExit(open: boolean) {
  const actionsRef = useRef<PopupActions | null>(null);
  // The exiting popup keeps the props it last rendered with, so read `open` through a ref.
  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);
  const onExitComplete = useCallback(() => {
    if (!openRef.current) actionsRef.current?.unmount();
  }, []);
  return { actionsRef, onExitComplete };
}

/**
 * The `render` of a Dialog.Popup: a motion div that plays `popupMotion`, dims to 60% while a
 * dialog opened on top of it (a confirmation over a form) is showing, and tells Base UI when its
 * exit has played.
 */
export function dialogPopup(onExitComplete: () => void) {
  return (props: HTMLAttributes<HTMLDivElement>, state: { nestedDialogOpen: boolean }) => (
    <motion.div
      {...(props as HTMLMotionProps<"div">)}
      {...popupMotion}
      animate={{ opacity: state.nestedDialogOpen ? 0.6 : 1, scale: 1 }}
      onAnimationComplete={onExitComplete}
    />
  );
}
