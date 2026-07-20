import type { Transition, Variants } from 'framer-motion'

/** Soft Apple spring — emerges, settles, no bounce chaos */
export const emergeSpring: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
  mass: 0.9
}

export const settleSpring: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 34,
  mass: 0.72
}

export const tuckSpring: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 38,
  mass: 0.78
}

export const softSnap: Transition = {
  type: 'spring',
  stiffness: 560,
  damping: 40,
  mass: 0.65
}

/** Whole island stack — born from the notch (top center). */
export const islandFromNotch: Variants = {
  hidden: {
    opacity: 0,
    y: -22,
    scaleX: 0.38,
    scaleY: 0.22,
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
      opacity: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
      delayChildren: 0.08,
      staggerChildren: 0.05
    }
  },
  exit: {
    opacity: 0,
    y: -16,
    scaleX: 0.44,
    scaleY: 0.18,
    transformOrigin: '50% 0%',
    transition: {
      ...tuckSpring,
      opacity: { duration: 0.2, ease: [0.4, 0, 1, 1] }
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
  hidden: { opacity: 0, scale: 0.82, y: -10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...settleSpring,
      delayChildren: 0.06,
      staggerChildren: 0.06
    }
  },
  exit: {
    opacity: 0,
    scale: 0.88,
    y: -10,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] }
  }
}

/** Individual agent icons fan out from the notch / pill center */
export const dockIcon: Variants = {
  hidden: { opacity: 0, y: -14, scale: 0.28 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: settleSpring
  }
}

/** Activity sheet fades under the dock — no scaleY (blur + scale = glitch on Electron) */
export const activityFromDock: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
    transformOrigin: '50% 0%'
  },
  show: {
    opacity: 1,
    y: 0,
    transformOrigin: '50% 0%',
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1],
      delay: 0.04
    }
  },
  exit: {
    opacity: 0,
    y: -6,
    transformOrigin: '50% 0%',
    transition: {
      duration: 0.14,
      ease: [0.4, 0, 0.2, 1]
    }
  }
}

/** Feed rows cascade in */
export const feedRow: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: softSnap
  }
}

/** Role badge micro-pop */
export const badgePop: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 640, damping: 28 }
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
