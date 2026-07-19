import type { Transition, Variants } from 'framer-motion'

/** Soft Apple spring — emerges, settles, no bounce chaos */
export const emergeSpring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.85
}

export const settleSpring: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 36,
  mass: 0.7
}

export const tuckSpring: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 40,
  mass: 0.75
}

/** Whole island stack — born from the notch (top center). No filter/blur — those clip overflow. */
export const islandFromNotch: Variants = {
  hidden: {
    opacity: 0,
    y: -18,
    scaleX: 0.42,
    scaleY: 0.28,
    transformOrigin: '50% 0%'
  },
  show: {
    opacity: 1,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    transformOrigin: '50% 0%',
    transition: {
      ...emergeSpring,
      opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      delayChildren: 0.06,
      staggerChildren: 0.045
    }
  },
  exit: {
    opacity: 0,
    y: -14,
    scaleX: 0.48,
    scaleY: 0.22,
    transformOrigin: '50% 0%',
    transition: {
      ...tuckSpring,
      opacity: { duration: 0.18, ease: [0.4, 0, 1, 1] }
    }
  }
}

export const islandFromNotchReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } }
}

/** Dock pill shell — slight overshoot width feel */
export const dockPill: Variants = {
  hidden: { opacity: 0, scale: 0.86, y: -6 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...settleSpring,
      delayChildren: 0.05,
      staggerChildren: 0.055
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -8,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] }
  }
}

/** Individual agent icons fan out from the notch / pill center */
export const dockIcon: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.35 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: settleSpring
  }
}

/** Stem + permission card unfurl from under the dock */
export const panelFromDock: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
    scaleY: 0.65,
    scaleX: 0.92,
    transformOrigin: '50% 0%'
  },
  show: {
    opacity: 1,
    y: 0,
    scaleY: 1,
    scaleX: 1,
    transformOrigin: '50% 0%',
    transition: {
      ...emergeSpring,
      delay: 0.04,
      opacity: { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
    }
  },
  exit: {
    opacity: 0,
    y: -16,
    scaleY: 0.7,
    scaleX: 0.94,
    transformOrigin: '50% 0%',
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1]
    }
  }
}

export const stemGrow: Variants = {
  hidden: { scaleY: 0, opacity: 0 },
  show: {
    scaleY: 1,
    opacity: 1,
    transition: { ...settleSpring, delay: 0.02 }
  },
  exit: {
    scaleY: 0,
    opacity: 0,
    transition: { duration: 0.12 }
  }
}

export const tipPop: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.88, x: '-50%' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    x: '-50%',
    transition: settleSpring
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.94,
    x: '-50%',
    transition: { duration: 0.12, ease: [0.4, 0, 1, 1] }
  }
}
