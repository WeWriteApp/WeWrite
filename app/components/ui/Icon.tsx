"use client";

import { forwardRef, ComponentType } from "react";
import { PulseLoader, GridLoader } from "react-spinners";
import {
  Home,
  Menu,
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  SkipForward,
  Plus,
  Minus,
  Check,
  CheckCircle,
  Pencil,
  Trash,
  Copy,
  Share,
  User,
  Users,
  UserCircle,
  UserPlus,
  UserMinus,
  UserCheck,
  UserX,
  Bell,
  Eye,
  Funnel,
  Image,
  File,
  FileText,
  Folder,
  FolderOpen,
  Calendar,
  Clock,
  MapPin,
  Map,
  Globe,
  Crosshair,
  CreditCard,
  Wallet,
  Calculator,
  Percent,
  Heart,
  Star,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Medal,
  Crown,
  Link,
  Lock,
  LockOpen,
  Key,
  Fingerprint,
  Shield,
  Lightbulb,
  Target,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Sun,
  Moon,
  Palette,
  ChartBar,
  Database,
  Code,
  Circle,
  Square,
  Play,
  Pause,
  FastForward,
  SkipForward as SkipForwardIcon,
  Phone,
  Mail,
  Search,
  Settings,
  Info,
  AlertTriangle,
  CheckCircle as CheckCircleIcon,
  RefreshCw,
  RotateCcw,
  DollarSign,
  Banknote,
  Save,
  Download,
  Upload,
  Send,
  Reply,
  LogOut,
  MessageCircle,
  MessageSquare,
  AtSign,
  HelpCircle,
  Inbox,
  Grid3X3,
  List,
  Bookmark,
  Pin,
  Shuffle,
  Zap,
  Type,
  Network,
  WifiOff,
  TestTube,
  FlaskConical,
  Film,
  Newspaper,
  GraduationCap,
  ZoomIn,
  ZoomOut,
  Tags,
  Flame,
  Ban,
  Settings2,
  Link2,
  Building2,
  History,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MoreHorizontal,
  MoreVertical,
  EllipsisVertical,
  GripVertical,
  Flag,
  Megaphone,
  Sparkles,
  Quote,
  Rocket,
  Wifi,
  UtensilsCrossed,
  BookOpen,
  Wrench,
  FileStack,
  TabletSmartphone,
  Youtube,
  Twitter,
  Instagram,
  BookText,
  FolderPlus,
} from "lucide-react";

// Icon weight types (kept for backwards compatibility, not used with Lucide)
export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

// For backwards compatibility
export type IconTrigger = "hover" | "click" | "loop" | "morph" | "boomerang" | "none";

// Color configuration (for future animation support)
export interface IconColors {
  primary?: string;
  secondary?: string;
}

// Available icon names - mapped from Lucide naming to Phosphor
export type IconName =
  // Navigation & Arrows
  | "Home" | "Menu" | "Close" | "X"
  | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"
  | "ArrowUpCircle" | "ArrowDownCircle"
  | "ChevronLeft" | "ChevronRight" | "ChevronDown" | "ChevronUp"
  | "ExternalLink" | "SkipForward"
  // Media Controls
  | "Play" | "Pause" | "Stop" | "Square" | "FastForward"
  // Actions
  | "Plus" | "Minus" | "Check" | "CheckCheck" | "CheckCircle" | "CheckCircle2"
  | "Edit" | "Edit2" | "Edit3" | "Pencil" | "PenLine"
  | "Save" | "Trash" | "Trash2" | "Copy" | "Download" | "Upload"
  | "Share" | "Share2" | "Send" | "Reply" | "Refresh" | "RefreshCw" | "RotateCcw"
  // Status & Feedback
  | "Info" | "Warning" | "Error" | "Success"
  | "AlertCircle" | "AlertTriangle" | "HelpCircle"
  | "XCircle" | "Loader" | "LoaderGrid" | "Loading"
  // User & Profile
  | "User" | "Users" | "UserCircle" | "UserPlus" | "UserMinus" | "UserCheck" | "UserX"
  | "LogOut"
  // Communication
  | "Bell" | "Mail" | "MailCheck" | "MessageCircle" | "MessageSquare" | "Megaphone"
  | "Phone" | "AtSign"
  // Media & Files
  | "Eye" | "EyeOff" | "Search" | "Filter"
  | "Image" | "File" | "FileText" | "Folder" | "FolderOpen" | "Inbox"
  | "Grid" | "Grid3X3" | "List"
  // Time & Calendar
  | "Calendar" | "Clock" | "History"
  // Location & Map
  | "MapPin" | "Map" | "Globe" | "Crosshair"
  // Finance & Payment
  | "DollarSign" | "CreditCard" | "Wallet" | "Banknote" | "Calculator" | "Percent"
  // Social & Engagement
  | "Heart" | "Star" | "Bookmark" | "ThumbsUp" | "ThumbsDown"
  | "Trophy" | "Award" | "Crown" | "Medal"
  // Settings & Tools
  | "Settings" | "Settings2" | "Link" | "Link2" | "Lock" | "Unlock" | "Key" | "Fingerprint"
  | "Shield" | "Zap" | "Lightbulb" | "Sparkles" | "Target"
  // Layout & Display
  | "Monitor" | "Smartphone" | "Tablet" | "Laptop"
  | "Sun" | "Moon" | "Palette" | "Type"
  // Data & Charts
  | "BarChart3" | "TrendingUp" | "TrendingDown" | "Activity" | "Network"
  | "Database" | "Code"
  // Misc
  | "MoreHorizontal" | "MoreVertical" | "EllipsisVertical" | "GripVertical"
  | "Quote" | "Pin" | "Shuffle" | "Rocket" | "Building2"
  | "Wifi" | "WifiOff" | "TestTube" | "FlaskConical"
  | "Film" | "Newspaper" | "GraduationCap" | "UtensilsCrossed" | "BookOpen"
  | "ZoomIn" | "ZoomOut" | "Tags"
  | "Flame" | "Tablet" | "Sort"
  | "Flag" | "Ban" | "Wrench"
  | "Circle" | "LayoutPanelLeft" | "ArrowUpDown" | "FileStack"
  | "TabletSmartphone" | "Youtube" | "Twitter" | "Instagram" | "BookText" | "FolderPlus";

// Icon props interface
export interface IconProps {
  name: IconName;
  size?: number | string;
  className?: string;
  weight?: IconWeight;
  trigger?: IconTrigger; // Kept for API compatibility, not used with Phosphor
  colors?: IconColors; // Kept for API compatibility
  color?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  style?: React.CSSProperties;
}

// Icon animation control handle (for future animation support)
export interface IconHandle {
  play: () => void;
  pause: () => void;
  stop: () => void;
}

// Map icon names to Lucide components
const iconMap: Partial<Record<IconName, ComponentType<any>>> = {
  // Navigation & Arrows
  Home: Home,
  Menu: Menu,
  Close: X,
  X: X,
  ArrowLeft: ArrowLeft,
  ArrowRight: ArrowRight,
  ArrowUp: ArrowUp,
  ArrowDown: ArrowDown,
  ArrowUpCircle: ArrowUpCircle,
  ArrowDownCircle: ArrowDownCircle,
  ChevronLeft: ChevronLeft,
  ChevronRight: ChevronRight,
  ChevronDown: ChevronDown,
  ChevronUp: ChevronUp,
  ExternalLink: ExternalLink,
  SkipForward: SkipForward,

  // Media Controls
  Play: Play,
  Pause: Pause,
  Stop: Square,
  Square: Square,
  FastForward: FastForward,

  // Actions
  Plus: Plus,
  Minus: Minus,
  Check: Check,
  CheckCheck: Check,
  CheckCircle: CheckCircle,
  CheckCircle2: CheckCircleIcon,
  Edit: Pencil,
  Edit2: Pencil,
  Edit3: Pencil,
  Pencil: Pencil,
  PenLine: Pencil,
  Save: Save,
  Trash: Trash,
  Trash2: Trash,
  Copy: Copy,
  Download: Download,
  Upload: Upload,
  Share: Share,
  Share2: Share,
  Send: Send,
  Reply: Reply,
  Refresh: RefreshCw,
  RefreshCw: RefreshCw,
  RotateCcw: RotateCcw,

  // Status & Feedback
  Info: Info,
  Warning: AlertTriangle,
  Error: AlertTriangle,
  Success: CheckCircle,
  AlertCircle: AlertTriangle,
  AlertTriangle: AlertTriangle,
  HelpCircle: HelpCircle,
  XCircle: X,
  Loading: RefreshCw,

  // User & Profile
  User: User,
  Users: Users,
  UserCircle: UserCircle,
  UserPlus: UserPlus,
  UserMinus: UserMinus,
  UserCheck: UserCheck,
  UserX: UserX,
  LogOut: LogOut,

  // Communication
  Bell: Bell,
  Mail: Mail,
  MailCheck: Mail,
  MessageCircle: MessageCircle,
  MessageSquare: MessageSquare,
  Megaphone: Megaphone,
  Phone: Phone,
  AtSign: AtSign,

  // Media & Files
  Eye: Eye,
  EyeOff: Eye,
  Search: Search,
  Filter: Funnel,
  Image: Image,
  File: File,
  FileText: FileText,
  Folder: Folder,
  FolderOpen: FolderOpen,
  Inbox: Inbox,
  Grid: Grid3X3,
  Grid3X3: Grid3X3,
  List: List,

  // Time & Calendar
  Calendar: Calendar,
  Clock: Clock,
  History: History,

  // Location & Map
  MapPin: MapPin,
  Map: Map,
  Globe: Globe,
  Crosshair: Crosshair,

  // Finance & Payment
  DollarSign: DollarSign,
  CreditCard: CreditCard,
  Wallet: Wallet,
  Banknote: Banknote,
  Calculator: Calculator,
  Percent: Percent,

  // Social & Engagement
  Heart: Heart,
  Star: Star,
  Bookmark: Bookmark,
  ThumbsUp: ThumbsUp,
  ThumbsDown: ThumbsDown,
  Trophy: Trophy,
  Award: Medal,
  Crown: Crown,
  Medal: Medal,

  // Settings & Tools
  Settings: Settings,
  Settings2: Settings2,
  Link: Link,
  Link2: Link2,
  Lock: Lock,
  Unlock: LockOpen,
  Key: Key,
  Fingerprint: Fingerprint,
  Shield: Shield,
  Zap: Zap,
  Lightbulb: Lightbulb,
  Sparkles: Sparkles,
  Target: Target,

  // Layout & Display
  Monitor: Monitor,
  Smartphone: Smartphone,
  Tablet: Tablet,
  Laptop: Laptop,
  Sun: Sun,
  Moon: Moon,
  Palette: Palette,
  Type: Type,

  // Data & Charts
  BarChart3: ChartBar,
  TrendingUp: TrendingUp,
  TrendingDown: TrendingDown,
  Activity: Activity,
  Network: Network,
  Database: Database,
  Code: Code,

  // Misc
  MoreHorizontal: MoreHorizontal,
  MoreVertical: MoreVertical,
  EllipsisVertical: EllipsisVertical,
  GripVertical: GripVertical,
  Quote: Quote,
  Pin: Pin,
  Shuffle: Shuffle,
  Rocket: Rocket,
  Building2: Building2,
  Wifi: Wifi,
  WifiOff: WifiOff,
  TestTube: TestTube,
  FlaskConical: FlaskConical,
  Film: Film,
  Newspaper: Newspaper,
  GraduationCap: GraduationCap,
  UtensilsCrossed: UtensilsCrossed,
  BookOpen: BookOpen,
  ZoomIn: ZoomIn,
  ZoomOut: ZoomOut,
  Tags: Tags,
  Flame: Flame,
  Sort: ArrowUp,
  Flag: Flag,
  Ban: Ban,
  Wrench: Wrench,
  Circle: Circle,
  LayoutPanelLeft: Menu,
  ArrowUpDown: ArrowUp,
  FileStack: FileStack,
  TabletSmartphone: TabletSmartphone,
  Youtube: Youtube,
  Twitter: Twitter,
  Instagram: Instagram,
  BookText: BookText,
  FolderPlus: FolderPlus,
};

// Unified Icon Component
export const Icon = forwardRef<HTMLSpanElement, IconProps>(
  (
    {
      name,
      size = 24,
      className = "",
      weight, // Ignored for Lucide compatibility
      color,
      onClick,
      onMouseEnter,
      onMouseLeave,
      style,
    },
    ref
  ) => {
    // Special handling for loaders (PulseLoader default, GridLoader alternative)
    if (name === "Loader") {
      // Default to subtle neutral-alpha-30 color if no color or className with text color is specified
      const hasTextColorClass = className?.includes('text-');
      const loaderColor = color || (hasTextColorClass ? "currentColor" : "var(--neutral-alpha-30)");

      // PulseLoader size prop controls each dot size (3 dots in a row)
      const numericSize = typeof size === "number" ? size : 24;
      const dotSize = Math.max(2, numericSize / 3);

      return (
        <span
          ref={ref}
          className={`inline-flex items-center justify-center ${className}`}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          style={style}
        >
          <PulseLoader
            size={dotSize}
            color={loaderColor}
            loading={true}
            speedMultiplier={0.8}
          />
        </span>
      );
    }

    // GridLoader as alternative variant
    if (name === "LoaderGrid") {
      const hasTextColorClass = className?.includes('text-');
      const loaderColor = color || (hasTextColorClass ? "currentColor" : "var(--neutral-alpha-30)");

      const numericSize = typeof size === "number" ? size : 24;
      const dotSize = Math.max(2, numericSize / 3);

      return (
        <span
          ref={ref}
          className={`inline-flex items-center justify-center ${className}`}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          style={style}
        >
          <GridLoader
            size={dotSize}
            color={loaderColor}
            loading={true}
            speedMultiplier={1}
          />
        </span>
      );
    }

    const LucideIcon = iconMap[name];

    if (!LucideIcon) {
      console.warn(`Icon "${name}" not found in icon map`);
      return (
        <span
          ref={ref}
          className={`inline-flex items-center justify-center ${className}`}
          style={{
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
            ...style,
          }}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <span className="text-xs text-gray-400">?</span>
        </span>
      );
    }

    // Support weight="fill" for solid icons (adds fill to make icons solid)
    const isFilled = weight === "fill";

    const numericSize = typeof size === "number" ? size : 24;

    return (
      <span
        ref={ref}
        className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          width: numericSize,
          height: numericSize,
          ...style,
        }}
      >
        <LucideIcon
          size={numericSize}
          color={color}
          className={color ? undefined : "text-current"}
          fill={isFilled ? "currentColor" : "none"}
        />
      </span>
    );
  }
);

Icon.displayName = "Icon";

// Export types for external use
export type { IconProps as UnifiedIconProps };
