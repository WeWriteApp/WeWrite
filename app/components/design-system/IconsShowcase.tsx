"use client";

import React, { useState } from 'react';
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
  Search,
  User,
  Mail,
  Lock,
  Eye,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Trash2,
  Edit,
  Copy,
  Share,
  Download,
  Upload,
  Filter,
  SortAsc,
  Clock,
  Calendar,
  MapPin,
  Phone,
  Globe,
  Link,
  Image,
  File,
  Folder,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Shuffle,
  TrendingUp,
  Trophy,
  Users,
  UserPlus,
  Shield,
  DollarSign,
  CreditCard,
  Sparkles,
  Lightbulb,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  AnimatedBell,
  AnimatedHeart,
  AnimatedPlus,
  AnimatedCheck,
  AnimatedSettings,
  AnimatedHome,
  AnimatedThumbs,
  AnimatedStar,
  AnimatedBookmark,
  AnimatedSend,
  AnimatedRefresh,
  AnimatedIconWrapper,
} from '../ui/animated-icons';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface IconGridItemProps {
  name: string;
  icon: LucideIcon;
  animatedVersion?: React.ReactNode;
}

function IconGridItem({ name, icon: Icon, animatedVersion }: IconGridItemProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Static version */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-10 flex items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-[10px] text-muted-foreground">Static</span>
        </div>

        {/* Animated version */}
        {animatedVersion && (
          <div className="flex flex-col items-center gap-1">
            <div className="h-10 w-10 flex items-center justify-center rounded-md bg-primary/10">
              {animatedVersion}
            </div>
            <span className="text-[10px] text-primary">Animated</span>
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-center">{name}</span>
    </div>
  );
}

export default function IconsShowcase() {
  const [bellRinging, setBellRinging] = useState(false);
  const [heartLiked, setHeartLiked] = useState(false);
  const [plusActive, setPlusActive] = useState(false);
  const [checkVisible, setCheckVisible] = useState(true);
  const [settingsSpinning, setSettingsSpinning] = useState(false);
  const [homeActive, setHomeActive] = useState(false);
  const [thumbsUpVoted, setThumbsUpVoted] = useState(false);
  const [thumbsDownVoted, setThumbsDownVoted] = useState(false);
  const [starred, setStarred] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Icons with animated variants
  const animatedIcons: IconGridItemProps[] = [
    {
      name: 'Bell',
      icon: Bell,
      animatedVersion: (
        <AnimatedBell
          className="h-5 w-5"
          isRinging={bellRinging}
          hasNotification={true}
        />
      ),
    },
    {
      name: 'Heart',
      icon: Heart,
      animatedVersion: (
        <AnimatedHeart
          className="h-5 w-5 text-red-500"
          isLiked={heartLiked}
          onLike={() => setHeartLiked(!heartLiked)}
        />
      ),
    },
    {
      name: 'Plus',
      icon: Plus,
      animatedVersion: <AnimatedPlus className="h-5 w-5" isActive={plusActive} />,
    },
    {
      name: 'Check',
      icon: Check,
      animatedVersion: <AnimatedCheck className="h-5 w-5 text-green-500" isVisible={checkVisible} bounce />,
    },
    {
      name: 'Settings',
      icon: Settings,
      animatedVersion: <AnimatedSettings className="h-5 w-5" isSpinning={settingsSpinning} />,
    },
    {
      name: 'Home',
      icon: Home,
      animatedVersion: <AnimatedHome className="h-5 w-5" isActive={homeActive} />,
    },
    {
      name: 'ThumbsUp',
      icon: ThumbsUp,
      animatedVersion: (
        <AnimatedThumbs
          className="h-5 w-5 text-green-500"
          direction="up"
          isVoted={thumbsUpVoted}
        />
      ),
    },
    {
      name: 'ThumbsDown',
      icon: ThumbsDown,
      animatedVersion: (
        <AnimatedThumbs
          className="h-5 w-5 text-red-500"
          direction="down"
          isVoted={thumbsDownVoted}
        />
      ),
    },
    {
      name: 'Star',
      icon: Star,
      animatedVersion: (
        <AnimatedStar
          className="h-5 w-5 text-yellow-500"
          isStarred={starred}
        />
      ),
    },
    {
      name: 'Bookmark',
      icon: Bookmark,
      animatedVersion: (
        <AnimatedBookmark
          className="h-5 w-5 text-blue-500"
          isSaved={bookmarked}
        />
      ),
    },
    {
      name: 'Send',
      icon: Send,
      animatedVersion: <AnimatedSend className="h-5 w-5" isSending={sending} />,
    },
    {
      name: 'RefreshCw',
      icon: RefreshCw,
      animatedVersion: <AnimatedRefresh className="h-5 w-5" isRefreshing={refreshing} />,
    },
  ];

  // All other icons (static only)
  const staticIcons: { name: string; icon: LucideIcon }[] = [
    { name: 'Search', icon: Search },
    { name: 'User', icon: User },
    { name: 'Mail', icon: Mail },
    { name: 'Lock', icon: Lock },
    { name: 'Eye', icon: Eye },
    { name: 'Menu', icon: Menu },
    { name: 'X', icon: X },
    { name: 'ChevronLeft', icon: ChevronLeft },
    { name: 'ChevronRight', icon: ChevronRight },
    { name: 'ChevronDown', icon: ChevronDown },
    { name: 'ChevronUp', icon: ChevronUp },
    { name: 'ArrowLeft', icon: ArrowLeft },
    { name: 'ArrowRight', icon: ArrowRight },
    { name: 'ExternalLink', icon: ExternalLink },
    { name: 'Trash2', icon: Trash2 },
    { name: 'Edit', icon: Edit },
    { name: 'Copy', icon: Copy },
    { name: 'Share', icon: Share },
    { name: 'Download', icon: Download },
    { name: 'Upload', icon: Upload },
    { name: 'Filter', icon: Filter },
    { name: 'SortAsc', icon: SortAsc },
    { name: 'Clock', icon: Clock },
    { name: 'Calendar', icon: Calendar },
    { name: 'MapPin', icon: MapPin },
    { name: 'Phone', icon: Phone },
    { name: 'Globe', icon: Globe },
    { name: 'Link', icon: Link },
    { name: 'Image', icon: Image },
    { name: 'File', icon: File },
    { name: 'Folder', icon: Folder },
    { name: 'AlertCircle', icon: AlertCircle },
    { name: 'AlertTriangle', icon: AlertTriangle },
    { name: 'Info', icon: Info },
    { name: 'CheckCircle', icon: CheckCircle },
    { name: 'XCircle', icon: XCircle },
    { name: 'HelpCircle', icon: HelpCircle },
    { name: 'Loader2', icon: Loader2 },
    { name: 'MoreHorizontal', icon: MoreHorizontal },
    { name: 'MoreVertical', icon: MoreVertical },
    { name: 'Shuffle', icon: Shuffle },
    { name: 'TrendingUp', icon: TrendingUp },
    { name: 'Trophy', icon: Trophy },
    { name: 'Users', icon: Users },
    { name: 'UserPlus', icon: UserPlus },
    { name: 'Shield', icon: Shield },
    { name: 'DollarSign', icon: DollarSign },
    { name: 'CreditCard', icon: CreditCard },
    { name: 'Sparkles', icon: Sparkles },
    { name: 'Lightbulb', icon: Lightbulb },
    { name: 'Zap', icon: Zap },
  ];

  return (
    <div className="space-y-8">
      {/* Animated Icons Section */}
      <div>
        <h4 className="text-base font-semibold mb-2">Animated Icons</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Icons with framer-motion animations. Hover over them to see animations, or use the controls below to trigger states.
        </p>

        {/* Animation Controls */}
        <div className="flex flex-wrap gap-2 mb-4 p-4 rounded-lg bg-muted/50">
          <Button
            size="sm"
            variant={bellRinging ? "default" : "outline"}
            onClick={() => { setBellRinging(true); setTimeout(() => setBellRinging(false), 600); }}
          >
            Ring Bell
          </Button>
          <Button
            size="sm"
            variant={heartLiked ? "default" : "outline"}
            onClick={() => setHeartLiked(!heartLiked)}
          >
            {heartLiked ? 'Unlike' : 'Like'}
          </Button>
          <Button
            size="sm"
            variant={starred ? "default" : "outline"}
            onClick={() => setStarred(!starred)}
          >
            {starred ? 'Unstar' : 'Star'}
          </Button>
          <Button
            size="sm"
            variant={bookmarked ? "default" : "outline"}
            onClick={() => setBookmarked(!bookmarked)}
          >
            {bookmarked ? 'Unsave' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant={thumbsUpVoted ? "default" : "outline"}
            onClick={() => { setThumbsUpVoted(!thumbsUpVoted); setThumbsDownVoted(false); }}
          >
            Vote Up
          </Button>
          <Button
            size="sm"
            variant={thumbsDownVoted ? "default" : "outline"}
            onClick={() => { setThumbsDownVoted(!thumbsDownVoted); setThumbsUpVoted(false); }}
          >
            Vote Down
          </Button>
          <Button
            size="sm"
            variant={settingsSpinning ? "default" : "outline"}
            onClick={() => setSettingsSpinning(!settingsSpinning)}
          >
            {settingsSpinning ? 'Stop Spin' : 'Spin Settings'}
          </Button>
          <Button
            size="sm"
            variant={refreshing ? "default" : "outline"}
            onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 2000); }}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setSending(true); setTimeout(() => setSending(false), 300); }}
          >
            Send
          </Button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {animatedIcons.map((item) => (
            <IconGridItem key={item.name} {...item} />
          ))}
        </div>
      </div>

      {/* Wrapper Animation Demo */}
      <div>
        <h4 className="text-base font-semibold mb-2">Animation Wrapper</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Use AnimatedIconWrapper to add animations to any icon without creating a custom component.
        </p>
        <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="bounce" onHover="scale">
              <Sparkles className="h-6 w-6 text-yellow-500" />
            </AnimatedIconWrapper>
            <span className="text-xs">Bounce</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="pulse" onHover="scale">
              <Heart className="h-6 w-6 text-red-500" />
            </AnimatedIconWrapper>
            <span className="text-xs">Pulse</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="shake" onHover="rotate">
              <Bell className="h-6 w-6 text-blue-500" />
            </AnimatedIconWrapper>
            <span className="text-xs">Shake</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="spin" onHover="none">
              <Loader2 className="h-6 w-6 text-primary" />
            </AnimatedIconWrapper>
            <span className="text-xs">Spin</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper onHover="bounce">
              <Zap className="h-6 w-6 text-orange-500" />
            </AnimatedIconWrapper>
            <span className="text-xs">Hover: Bounce</span>
          </div>
        </div>
      </div>

      {/* Static Icons Library */}
      <div>
        <h4 className="text-base font-semibold mb-2">Icon Library (lucide-react)</h4>
        <p className="text-sm text-muted-foreground mb-4">
          All icons come from lucide-react. These are commonly used throughout the app.
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {staticIcons.map(({ name, icon: Icon }) => (
            <div
              key={name}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-muted transition-colors cursor-pointer group"
              title={name}
            >
              <Icon className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Code */}
      <div>
        <h4 className="text-base font-semibold mb-2">Usage</h4>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
            <pre>{`// Import animated icon
import { AnimatedHeart } from '@/components/ui/animated-icons';

// Use with state
const [liked, setLiked] = useState(false);
<AnimatedHeart
  className="h-5 w-5 text-red-500"
  isLiked={liked}
  onLike={() => setLiked(!liked)}
/>`}</pre>
          </div>
          <div className="p-4 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
            <pre>{`// Wrap any icon with animations
import { AnimatedIconWrapper } from '@/components/ui/animated-icons';
import { Star } from 'lucide-react';

<AnimatedIconWrapper animate="pulse" onHover="scale">
  <Star className="h-5 w-5" />
</AnimatedIconWrapper>`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
