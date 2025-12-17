"use client";

import { motion, type Variants } from "framer-motion";
import {
  Bell,
  Heart,
  Plus,
  Check,
  Settings,
  Home,
  ThumbsUp,
  ThumbsDown,
  Star,
  Bookmark,
  Send,
  RefreshCw,
  type LucideProps,
} from "lucide-react";
import { forwardRef } from "react";

// Common animation variants
const tapScale = { scale: 0.9 };
const hoverScale = { scale: 1.1 };

// ============================================
// ANIMATED BELL - rings on hover/notification
// ============================================
const bellRingVariants: Variants = {
  initial: { rotate: 0 },
  ring: {
    rotate: [0, 15, -15, 10, -10, 5, -5, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
  hover: {
    rotate: [0, 10, -10, 5, -5, 0],
    transition: {
      duration: 0.4,
      ease: "easeInOut",
    },
  },
};

interface AnimatedBellProps extends LucideProps {
  isRinging?: boolean;
  hasNotification?: boolean;
}

export const AnimatedBell = forwardRef<SVGSVGElement, AnimatedBellProps>(
  ({ isRinging = false, hasNotification = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="relative inline-flex"
        variants={bellRingVariants}
        initial="initial"
        animate={isRinging ? "ring" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Bell ref={ref} className={className} {...props} />
        {hasNotification && (
          <motion.span
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          />
        )}
      </motion.div>
    );
  }
);
AnimatedBell.displayName = "AnimatedBell";

// ============================================
// ANIMATED HEART - pulses on like
// ============================================
const heartVariants: Variants = {
  initial: { scale: 1 },
  liked: {
    scale: [1, 1.3, 1],
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  hover: {
    scale: 1.15,
    transition: { duration: 0.2 },
  },
};

interface AnimatedHeartProps extends LucideProps {
  isLiked?: boolean;
  onLike?: () => void;
}

export const AnimatedHeart = forwardRef<SVGSVGElement, AnimatedHeartProps>(
  ({ isLiked = false, onLike, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex cursor-pointer"
        variants={heartVariants}
        initial="initial"
        animate={isLiked ? "liked" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
        onClick={onLike}
      >
        <Heart
          ref={ref}
          className={className}
          fill={isLiked ? "currentColor" : "none"}
          {...props}
        />
      </motion.div>
    );
  }
);
AnimatedHeart.displayName = "AnimatedHeart";

// ============================================
// ANIMATED PLUS - rotates to X on active
// ============================================
const plusVariants: Variants = {
  initial: { rotate: 0 },
  active: { rotate: 45 },
  hover: {
    scale: 1.1,
    rotate: 90,
    transition: { duration: 0.2 }
  },
};

interface AnimatedPlusProps extends LucideProps {
  isActive?: boolean;
}

export const AnimatedPlus = forwardRef<SVGSVGElement, AnimatedPlusProps>(
  ({ isActive = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex"
        variants={plusVariants}
        initial="initial"
        animate={isActive ? "active" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Plus ref={ref} className={className} {...props} />
      </motion.div>
    );
  }
);
AnimatedPlus.displayName = "AnimatedPlus";

// ============================================
// ANIMATED CHECK - draws in with success
// ============================================
const checkVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15,
    },
  },
  bounce: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.3 },
  },
};

interface AnimatedCheckProps extends LucideProps {
  isVisible?: boolean;
  bounce?: boolean;
}

export const AnimatedCheck = forwardRef<SVGSVGElement, AnimatedCheckProps>(
  ({ isVisible = true, bounce = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex"
        variants={checkVariants}
        initial="initial"
        animate={bounce ? "bounce" : isVisible ? "visible" : "initial"}
      >
        <Check ref={ref} className={className} {...props} />
      </motion.div>
    );
  }
);
AnimatedCheck.displayName = "AnimatedCheck";

// ============================================
// ANIMATED SETTINGS - spins on hover
// ============================================
const settingsVariants: Variants = {
  initial: { rotate: 0 },
  hover: {
    rotate: 90,
    transition: { duration: 0.3, ease: "easeInOut" },
  },
  spinning: {
    rotate: 360,
    transition: {
      duration: 1,
      ease: "linear",
      repeat: Infinity,
    },
  },
};

interface AnimatedSettingsProps extends LucideProps {
  isSpinning?: boolean;
}

export const AnimatedSettings = forwardRef<SVGSVGElement, AnimatedSettingsProps>(
  ({ isSpinning = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex"
        variants={settingsVariants}
        initial="initial"
        animate={isSpinning ? "spinning" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Settings ref={ref} className={className} {...props} />
      </motion.div>
    );
  }
);
AnimatedSettings.displayName = "AnimatedSettings";

// ============================================
// ANIMATED HOME - bounces on tap
// ============================================
const homeVariants: Variants = {
  initial: { y: 0 },
  hover: { y: -2, transition: { duration: 0.2 } },
  tap: { y: 2, scale: 0.95 },
  active: {
    y: [0, -3, 0],
    transition: { duration: 0.3 },
  },
};

interface AnimatedHomeProps extends LucideProps {
  isActive?: boolean;
}

export const AnimatedHome = forwardRef<SVGSVGElement, AnimatedHomeProps>(
  ({ isActive = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex"
        variants={homeVariants}
        initial="initial"
        animate={isActive ? "active" : "initial"}
        whileHover="hover"
        whileTap="tap"
      >
        <Home ref={ref} className={className} {...props} />
      </motion.div>
    );
  }
);
AnimatedHome.displayName = "AnimatedHome";

// ============================================
// ANIMATED THUMBS UP/DOWN - bounces on vote
// ============================================
const thumbsVariants: Variants = {
  initial: { scale: 1, y: 0 },
  voted: {
    scale: [1, 1.3, 1],
    y: [0, -5, 0],
    transition: { duration: 0.3 },
  },
  hover: { scale: 1.15 },
};

interface AnimatedThumbsProps extends LucideProps {
  isVoted?: boolean;
  direction: "up" | "down";
}

export const AnimatedThumbs = forwardRef<SVGSVGElement, AnimatedThumbsProps>(
  ({ isVoted = false, direction, className, ...props }, ref) => {
    const Icon = direction === "up" ? ThumbsUp : ThumbsDown;
    return (
      <motion.div
        className="inline-flex cursor-pointer"
        variants={thumbsVariants}
        initial="initial"
        animate={isVoted ? "voted" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Icon
          ref={ref}
          className={className}
          fill={isVoted ? "currentColor" : "none"}
          {...props}
        />
      </motion.div>
    );
  }
);
AnimatedThumbs.displayName = "AnimatedThumbs";

// ============================================
// ANIMATED STAR - sparkles on favorite
// ============================================
const starVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  starred: {
    scale: [1, 1.4, 1],
    rotate: [0, 20, -20, 0],
    transition: { duration: 0.4 },
  },
  hover: { scale: 1.2, rotate: 15 },
};

interface AnimatedStarProps extends LucideProps {
  isStarred?: boolean;
}

export const AnimatedStar = forwardRef<SVGSVGElement, AnimatedStarProps>(
  ({ isStarred = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex cursor-pointer"
        variants={starVariants}
        initial="initial"
        animate={isStarred ? "starred" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Star
          ref={ref}
          className={className}
          fill={isStarred ? "currentColor" : "none"}
          {...props}
        />
      </motion.div>
    );
  }
);
AnimatedStar.displayName = "AnimatedStar";

// ============================================
// ANIMATED BOOKMARK - slides down on save
// ============================================
const bookmarkVariants: Variants = {
  initial: { y: 0 },
  saved: {
    y: [0, -5, 2, 0],
    transition: { duration: 0.4 },
  },
  hover: { y: -3 },
};

interface AnimatedBookmarkProps extends LucideProps {
  isSaved?: boolean;
}

export const AnimatedBookmark = forwardRef<SVGSVGElement, AnimatedBookmarkProps>(
  ({ isSaved = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex cursor-pointer"
        variants={bookmarkVariants}
        initial="initial"
        animate={isSaved ? "saved" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Bookmark
          ref={ref}
          className={className}
          fill={isSaved ? "currentColor" : "none"}
          {...props}
        />
      </motion.div>
    );
  }
);
AnimatedBookmark.displayName = "AnimatedBookmark";

// ============================================
// ANIMATED SEND - flies away on send
// ============================================
const sendVariants: Variants = {
  initial: { x: 0, y: 0, opacity: 1 },
  sending: {
    x: [0, 10, 20],
    y: [0, -5, -10],
    opacity: [1, 0.8, 0],
    transition: { duration: 0.3 },
  },
  hover: { x: 3, y: -2 },
};

interface AnimatedSendProps extends LucideProps {
  isSending?: boolean;
}

export const AnimatedSend = forwardRef<SVGSVGElement, AnimatedSendProps>(
  ({ isSending = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex"
        variants={sendVariants}
        initial="initial"
        animate={isSending ? "sending" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Send ref={ref} className={className} {...props} />
      </motion.div>
    );
  }
);
AnimatedSend.displayName = "AnimatedSend";

// ============================================
// ANIMATED REFRESH - spins while loading
// ============================================
const refreshVariants: Variants = {
  initial: { rotate: 0 },
  spinning: {
    rotate: 360,
    transition: {
      duration: 0.8,
      ease: "linear",
      repeat: Infinity,
    },
  },
  hover: { rotate: 180, transition: { duration: 0.3 } },
};

interface AnimatedRefreshProps extends LucideProps {
  isRefreshing?: boolean;
}

export const AnimatedRefresh = forwardRef<SVGSVGElement, AnimatedRefreshProps>(
  ({ isRefreshing = false, className, ...props }, ref) => {
    return (
      <motion.div
        className="inline-flex"
        variants={refreshVariants}
        initial="initial"
        animate={isRefreshing ? "spinning" : "initial"}
        whileHover={isRefreshing ? undefined : "hover"}
        whileTap={tapScale}
      >
        <RefreshCw ref={ref} className={className} {...props} />
      </motion.div>
    );
  }
);
AnimatedRefresh.displayName = "AnimatedRefresh";

// ============================================
// GENERIC ANIMATED ICON WRAPPER
// ============================================
interface AnimatedIconWrapperProps {
  children: React.ReactNode;
  animate?: "bounce" | "pulse" | "shake" | "spin" | "none";
  onHover?: "scale" | "rotate" | "bounce" | "none";
  onTap?: "scale" | "none";
  className?: string;
}

const wrapperAnimations: Record<string, Variants> = {
  bounce: {
    initial: { y: 0 },
    animate: {
      y: [0, -5, 0],
      transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2 },
    },
  },
  pulse: {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.1, 1],
      transition: { duration: 1, repeat: Infinity },
    },
  },
  shake: {
    initial: { x: 0 },
    animate: {
      x: [0, -3, 3, -3, 3, 0],
      transition: { duration: 0.5, repeat: Infinity, repeatDelay: 3 },
    },
  },
  spin: {
    initial: { rotate: 0 },
    animate: {
      rotate: 360,
      transition: { duration: 2, ease: "linear", repeat: Infinity },
    },
  },
  none: {
    initial: {},
    animate: {},
  },
};

const hoverAnimations: Record<string, object> = {
  scale: { scale: 1.15 },
  rotate: { rotate: 15 },
  bounce: { y: -3 },
  none: {},
};

export function AnimatedIconWrapper({
  children,
  animate = "none",
  onHover = "scale",
  onTap = "scale",
  className,
}: AnimatedIconWrapperProps) {
  return (
    <motion.div
      className={`inline-flex ${className || ""}`}
      variants={wrapperAnimations[animate]}
      initial="initial"
      animate="animate"
      whileHover={hoverAnimations[onHover]}
      whileTap={onTap === "scale" ? tapScale : undefined}
    >
      {children}
    </motion.div>
  );
}
