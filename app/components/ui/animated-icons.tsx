"use client";

import { motion, type Variants } from "framer-motion";
import { Icon, IconName } from "@/components/ui/Icon";
import { forwardRef } from "react";

// Common animation variants
const tapScale = { scale: 0.9 };
const hoverScale = { scale: 1.1 };

// Common props interface for animated icons
interface AnimatedIconProps {
  size?: number;
  className?: string;
}

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

interface AnimatedBellProps extends AnimatedIconProps {
  isRinging?: boolean;
  hasNotification?: boolean;
}

export const AnimatedBell = forwardRef<HTMLDivElement, AnimatedBellProps>(
  ({ isRinging = false, hasNotification = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="relative inline-flex"
        variants={bellRingVariants}
        initial="initial"
        animate={isRinging ? "ring" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Icon name="Bell" size={size} className={className} />
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

interface AnimatedHeartProps extends AnimatedIconProps {
  isLiked?: boolean;
  onLike?: () => void;
}

export const AnimatedHeart = forwardRef<HTMLDivElement, AnimatedHeartProps>(
  ({ isLiked = false, onLike, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex cursor-pointer"
        variants={heartVariants}
        initial="initial"
        animate={isLiked ? "liked" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
        onClick={onLike}
      >
        <Icon name="Heart" size={size} className={className} />
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

interface AnimatedPlusProps extends AnimatedIconProps {
  isActive?: boolean;
}

export const AnimatedPlus = forwardRef<HTMLDivElement, AnimatedPlusProps>(
  ({ isActive = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex"
        variants={plusVariants}
        initial="initial"
        animate={isActive ? "active" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Icon name="Plus" size={size} className={className} />
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

interface AnimatedCheckProps extends AnimatedIconProps {
  isVisible?: boolean;
  bounce?: boolean;
}

export const AnimatedCheck = forwardRef<HTMLDivElement, AnimatedCheckProps>(
  ({ isVisible = true, bounce = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex"
        variants={checkVariants}
        initial="initial"
        animate={bounce ? "bounce" : isVisible ? "visible" : "initial"}
      >
        <Icon name="Check" size={size} className={className} />
      </motion.div>
    );
  }
);
AnimatedCheck.displayName = "AnimatedCheck";

// ============================================
// ANIMATED SETTINGS - rotates on hover
// ============================================
const settingsVariants: Variants = {
  initial: { rotate: 0 },
  hover: {
    rotate: 90,
    transition: { duration: 0.3, ease: "easeInOut" },
  },
};

interface AnimatedSettingsProps extends AnimatedIconProps {
  isActive?: boolean;
}

export const AnimatedSettings = forwardRef<HTMLDivElement, AnimatedSettingsProps>(
  ({ isActive = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex"
        variants={settingsVariants}
        initial="initial"
        whileHover="hover"
        whileTap={tapScale}
      >
        <Icon name="Settings" size={size} className={className} />
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

interface AnimatedHomeProps extends AnimatedIconProps {
  isActive?: boolean;
}

export const AnimatedHome = forwardRef<HTMLDivElement, AnimatedHomeProps>(
  ({ isActive = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex"
        variants={homeVariants}
        initial="initial"
        animate={isActive ? "active" : "initial"}
        whileHover="hover"
        whileTap="tap"
      >
        <Icon name="Home" size={size} className={className} />
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

interface AnimatedThumbsProps extends AnimatedIconProps {
  isVoted?: boolean;
  direction: "up" | "down";
}

export const AnimatedThumbs = forwardRef<HTMLDivElement, AnimatedThumbsProps>(
  ({ isVoted = false, direction, className, size = 24 }, ref) => {
    const iconName: IconName = direction === "up" ? "ThumbsUp" : "ThumbsDown";
    return (
      <motion.div
        ref={ref}
        className="inline-flex cursor-pointer"
        variants={thumbsVariants}
        initial="initial"
        animate={isVoted ? "voted" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Icon name={iconName} size={size} className={className} />
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

interface AnimatedStarProps extends AnimatedIconProps {
  isStarred?: boolean;
}

export const AnimatedStar = forwardRef<HTMLDivElement, AnimatedStarProps>(
  ({ isStarred = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex cursor-pointer"
        variants={starVariants}
        initial="initial"
        animate={isStarred ? "starred" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Icon name="Star" size={size} className={className} />
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

interface AnimatedBookmarkProps extends AnimatedIconProps {
  isSaved?: boolean;
}

export const AnimatedBookmark = forwardRef<HTMLDivElement, AnimatedBookmarkProps>(
  ({ isSaved = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex cursor-pointer"
        variants={bookmarkVariants}
        initial="initial"
        animate={isSaved ? "saved" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Icon name="Bookmark" size={size} className={className} />
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

interface AnimatedSendProps extends AnimatedIconProps {
  isSending?: boolean;
}

export const AnimatedSend = forwardRef<HTMLDivElement, AnimatedSendProps>(
  ({ isSending = false, className, size = 24 }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="inline-flex"
        variants={sendVariants}
        initial="initial"
        animate={isSending ? "sending" : "initial"}
        whileHover="hover"
        whileTap={tapScale}
      >
        <Icon name="Send" size={size} className={className} />
      </motion.div>
    );
  }
);
AnimatedSend.displayName = "AnimatedSend";

// ============================================
// GENERIC ANIMATED ICON WRAPPER
// ============================================
interface AnimatedIconWrapperProps {
  children: React.ReactNode;
  animate?: "bounce" | "pulse" | "shake" | "none";
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
