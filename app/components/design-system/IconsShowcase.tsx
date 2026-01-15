"use client";

import React, { useState } from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { motion } from 'framer-motion';
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
  AnimatedIconWrapper,
} from '../ui/animated-icons';
import { Button } from '../ui/button';
import {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTrigger,
} from '../ui/segmented-control';
import { cn } from '../../lib/utils';

// Icon usage counts across the codebase (generated from search)
// Note: Loader uses PulseLoader from react-spinners
const ICON_USAGE_COUNTS: Record<string, number> = {
  Loader: 150, // Combined from former Loader + Loader2
  Check: 70,
  X: 66,
  AlertTriangle: 50,
  RefreshCw: 48,
  DollarSign: 47,
  AlertCircle: 45,
  CheckCircle: 42,
  CreditCard: 41,
  Plus: 39,
  TrendingUp: 33,
  Users: 32,
  Trash2: 30,
  Mail: 28,
  ChevronLeft: 28,
  Eye: 27,
  ArrowLeft: 26,
  ChevronDown: 25,
  ExternalLink: 24,
  Copy: 24,
  Clock: 24,
  Calendar: 22,
  Bell: 22,
  Smartphone: 21,
  Settings: 21,
  Heart: 21,
  FileText: 21,
  ChevronRight: 20,
  Search: 19,
  Minus: 18,
  XCircle: 17,
  User: 16,
  Star: 14,
  TrendingDown: 13,
  Shield: 13,
  Save: 13,
  MapPin: 13,
  Link: 13,
  ChevronUp: 13,
  ArrowRight: 13,
  Share2: 12,
  Globe: 12,
  CheckCircle2: 12,
  Activity: 12,
  RotateCcw: 11,
  Lock: 10,
  Info: 10,
  EyeOff: 10,
  Edit3: 10,
  Wallet: 9,
  Sparkles: 9,
  Image: 9,
  BarChart3: 8,
  Home: 8,
  Download: 8,
  UserPlus: 7,
  Share: 7,
  Filter: 7,
  Database: 7,
  Close: 7,
  Building2: 7,
  History: 6,
  Warning: 5,
  Reply: 5,
  Palette: 5,
  MoreHorizontal: 5,
  Monitor: 5,
  LogOut: 5,
  Lightbulb: 5,
  Banknote: 5,
  UserX: 4,
  Upload: 4,
  Type: 4,
  ThumbsUp: 4,
  ThumbsDown: 4,
  Sun: 4,
  PenLine: 4,
  Network: 4,
  MoreVertical: 4,
  Moon: 4,
  ArrowUp: 4,
  ArrowDown: 4,
  Zap: 3,
  Trophy: 3,
  Trash: 3,
  Target: 3,
  TabletSmartphone: 3,
  Shuffle: 3,
  Send: 3,
  Pin: 3,
  Percent: 3,
  Pencil: 3,
  Megaphone: 3,
  List: 3,
  GripVertical: 3,
  Flame: 3,
  Calculator: 3,
  BookOpen: 3,
  UserMinus: 2,
  Success: 2,
  MessageCircle: 2,
  Menu: 2,
  Medal: 2,
  Link2: 2,
  Laptop: 2,
  Flag: 2,
  Error: 2,
  EllipsisVertical: 2,
  Edit2: 2,
  Edit: 2,
  Ban: 2,
  ZoomOut: 1,
  ZoomIn: 1,
  Youtube: 1,
  WifiOff: 1,
  Wifi: 1,
  UtensilsCrossed: 1,
  UserCircle: 1,
  UserCheck: 1,
  Twitter: 1,
  TestTube: 1,
  Square: 1,
  SkipForward: 1,
  Settings2: 1,
  Rocket: 1,
  Refresh: 1,
  Quote: 1,
  Play: 1,
  Phone: 1,
  Newspaper: 1,
  MessageSquare: 1,
  MailCheck: 1,
  Loading: 1,
  Key: 1,
  Instagram: 1,
  HelpCircle: 1,
  Grid3X3: 1,
  Grid: 1,
  GraduationCap: 1,
  FlaskConical: 1,
  Fingerprint: 1,
  Film: 1,
  FastForward: 1,
  Crown: 1,
  Crosshair: 1,
  Code: 1,
  CheckCheck: 1,
  Bookmark: 1,
  BookText: 1,
  Award: 1,
  AtSign: 1,
  ArrowUpDown: 1,
  ArrowUpCircle: 1,
  ArrowDownCircle: 1,
};

// Define all icons with their animated variants (if available)
interface IconDefinition {
  name: IconName;
  animated?: (props: { isActive: boolean }) => React.ReactNode;
  usageCount: number;
}

// Master icon list - sorted by usage count (most used first)
// Icons with animated variants are defined with the animated property
const ALL_ICONS: IconDefinition[] = [
  { name: 'Loader', usageCount: ICON_USAGE_COUNTS.Loader || 0 },
  {
    name: 'Check',
    animated: ({ isActive }) => <AnimatedCheck className="h-5 w-5 text-green-500" isVisible={isActive} bounce />,
    usageCount: ICON_USAGE_COUNTS.Check || 0
  },
  { name: 'X', usageCount: ICON_USAGE_COUNTS.X || 0 },
  { name: 'LoaderGrid', usageCount: ICON_USAGE_COUNTS.LoaderGrid || 0 },
  { name: 'AlertTriangle', usageCount: ICON_USAGE_COUNTS.AlertTriangle || 0 },
  { name: 'RefreshCw', usageCount: ICON_USAGE_COUNTS.RefreshCw || 0 },
  { name: 'DollarSign', usageCount: ICON_USAGE_COUNTS.DollarSign || 0 },
  { name: 'AlertCircle', usageCount: ICON_USAGE_COUNTS.AlertCircle || 0 },
  { name: 'CheckCircle', usageCount: ICON_USAGE_COUNTS.CheckCircle || 0 },
  { name: 'CreditCard', usageCount: ICON_USAGE_COUNTS.CreditCard || 0 },
  {
    name: 'Plus',
    animated: ({ isActive }) => <AnimatedPlus className="h-5 w-5" isActive={isActive} />,
    usageCount: ICON_USAGE_COUNTS.Plus || 0
  },
  { name: 'TrendingUp', usageCount: ICON_USAGE_COUNTS.TrendingUp || 0 },
  { name: 'Users', usageCount: ICON_USAGE_COUNTS.Users || 0 },
  { name: 'Trash2', usageCount: ICON_USAGE_COUNTS.Trash2 || 0 },
  { name: 'Mail', usageCount: ICON_USAGE_COUNTS.Mail || 0 },
  { name: 'ChevronLeft', usageCount: ICON_USAGE_COUNTS.ChevronLeft || 0 },
  { name: 'Eye', usageCount: ICON_USAGE_COUNTS.Eye || 0 },
  { name: 'ArrowLeft', usageCount: ICON_USAGE_COUNTS.ArrowLeft || 0 },
  { name: 'ChevronDown', usageCount: ICON_USAGE_COUNTS.ChevronDown || 0 },
  { name: 'ExternalLink', usageCount: ICON_USAGE_COUNTS.ExternalLink || 0 },
  { name: 'Copy', usageCount: ICON_USAGE_COUNTS.Copy || 0 },
  { name: 'Clock', usageCount: ICON_USAGE_COUNTS.Clock || 0 },
  { name: 'Calendar', usageCount: ICON_USAGE_COUNTS.Calendar || 0 },
  {
    name: 'Bell',
    animated: ({ isActive }) => <AnimatedBell className="h-5 w-5" isRinging={isActive} hasNotification={false} />,
    usageCount: ICON_USAGE_COUNTS.Bell || 0
  },
  { name: 'Smartphone', usageCount: ICON_USAGE_COUNTS.Smartphone || 0 },
  {
    name: 'Settings',
    animated: ({ isActive }) => <AnimatedSettings className="h-5 w-5" isActive={isActive} />,
    usageCount: ICON_USAGE_COUNTS.Settings || 0
  },
  {
    name: 'Heart',
    animated: ({ isActive }) => <AnimatedHeart className="h-5 w-5 text-red-500" isLiked={isActive} />,
    usageCount: ICON_USAGE_COUNTS.Heart || 0
  },
  { name: 'FileText', usageCount: ICON_USAGE_COUNTS.FileText || 0 },
  { name: 'ChevronRight', usageCount: ICON_USAGE_COUNTS.ChevronRight || 0 },
  { name: 'Search', usageCount: ICON_USAGE_COUNTS.Search || 0 },
  { name: 'Minus', usageCount: ICON_USAGE_COUNTS.Minus || 0 },
  { name: 'XCircle', usageCount: ICON_USAGE_COUNTS.XCircle || 0 },
  { name: 'User', usageCount: ICON_USAGE_COUNTS.User || 0 },
  {
    name: 'Star',
    animated: ({ isActive }) => <AnimatedStar className="h-5 w-5 text-yellow-500" isStarred={isActive} />,
    usageCount: ICON_USAGE_COUNTS.Star || 0
  },
  { name: 'TrendingDown', usageCount: ICON_USAGE_COUNTS.TrendingDown || 0 },
  { name: 'Shield', usageCount: ICON_USAGE_COUNTS.Shield || 0 },
  { name: 'Save', usageCount: ICON_USAGE_COUNTS.Save || 0 },
  { name: 'MapPin', usageCount: ICON_USAGE_COUNTS.MapPin || 0 },
  { name: 'Link', usageCount: ICON_USAGE_COUNTS.Link || 0 },
  { name: 'ChevronUp', usageCount: ICON_USAGE_COUNTS.ChevronUp || 0 },
  { name: 'ArrowRight', usageCount: ICON_USAGE_COUNTS.ArrowRight || 0 },
  { name: 'Share2', usageCount: ICON_USAGE_COUNTS.Share2 || 0 },
  { name: 'Globe', usageCount: ICON_USAGE_COUNTS.Globe || 0 },
  { name: 'CheckCircle2', usageCount: ICON_USAGE_COUNTS.CheckCircle2 || 0 },
  { name: 'Activity', usageCount: ICON_USAGE_COUNTS.Activity || 0 },
  { name: 'RotateCcw', usageCount: ICON_USAGE_COUNTS.RotateCcw || 0 },
  { name: 'Lock', usageCount: ICON_USAGE_COUNTS.Lock || 0 },
  { name: 'Info', usageCount: ICON_USAGE_COUNTS.Info || 0 },
  { name: 'EyeOff', usageCount: ICON_USAGE_COUNTS.EyeOff || 0 },
  { name: 'Edit3', usageCount: ICON_USAGE_COUNTS.Edit3 || 0 },
  { name: 'Wallet', usageCount: ICON_USAGE_COUNTS.Wallet || 0 },
  { name: 'Sparkles', usageCount: ICON_USAGE_COUNTS.Sparkles || 0 },
  { name: 'Image', usageCount: ICON_USAGE_COUNTS.Image || 0 },
  { name: 'BarChart3', usageCount: ICON_USAGE_COUNTS.BarChart3 || 0 },
  {
    name: 'Home',
    animated: ({ isActive }) => <AnimatedHome className="h-5 w-5" isActive={isActive} />,
    usageCount: ICON_USAGE_COUNTS.Home || 0
  },
  { name: 'Download', usageCount: ICON_USAGE_COUNTS.Download || 0 },
  { name: 'UserPlus', usageCount: ICON_USAGE_COUNTS.UserPlus || 0 },
  { name: 'Share', usageCount: ICON_USAGE_COUNTS.Share || 0 },
  { name: 'Filter', usageCount: ICON_USAGE_COUNTS.Filter || 0 },
  { name: 'Database', usageCount: ICON_USAGE_COUNTS.Database || 0 },
  { name: 'Close', usageCount: ICON_USAGE_COUNTS.Close || 0 },
  { name: 'Building2', usageCount: ICON_USAGE_COUNTS.Building2 || 0 },
  { name: 'History', usageCount: ICON_USAGE_COUNTS.History || 0 },
  { name: 'Warning', usageCount: ICON_USAGE_COUNTS.Warning || 0 },
  { name: 'Reply', usageCount: ICON_USAGE_COUNTS.Reply || 0 },
  { name: 'Palette', usageCount: ICON_USAGE_COUNTS.Palette || 0 },
  { name: 'MoreHorizontal', usageCount: ICON_USAGE_COUNTS.MoreHorizontal || 0 },
  { name: 'Monitor', usageCount: ICON_USAGE_COUNTS.Monitor || 0 },
  { name: 'LogOut', usageCount: ICON_USAGE_COUNTS.LogOut || 0 },
  { name: 'Lightbulb', usageCount: ICON_USAGE_COUNTS.Lightbulb || 0 },
  { name: 'Banknote', usageCount: ICON_USAGE_COUNTS.Banknote || 0 },
  { name: 'UserX', usageCount: ICON_USAGE_COUNTS.UserX || 0 },
  { name: 'Upload', usageCount: ICON_USAGE_COUNTS.Upload || 0 },
  { name: 'Type', usageCount: ICON_USAGE_COUNTS.Type || 0 },
  {
    name: 'ThumbsUp',
    animated: ({ isActive }) => <AnimatedThumbs className="h-5 w-5 text-green-500" direction="up" isVoted={isActive} />,
    usageCount: ICON_USAGE_COUNTS.ThumbsUp || 0
  },
  {
    name: 'ThumbsDown',
    animated: ({ isActive }) => <AnimatedThumbs className="h-5 w-5 text-red-500" direction="down" isVoted={isActive} />,
    usageCount: ICON_USAGE_COUNTS.ThumbsDown || 0
  },
  { name: 'Sun', usageCount: ICON_USAGE_COUNTS.Sun || 0 },
  { name: 'PenLine', usageCount: ICON_USAGE_COUNTS.PenLine || 0 },
  { name: 'Network', usageCount: ICON_USAGE_COUNTS.Network || 0 },
  { name: 'MoreVertical', usageCount: ICON_USAGE_COUNTS.MoreVertical || 0 },
  { name: 'Moon', usageCount: ICON_USAGE_COUNTS.Moon || 0 },
  { name: 'ArrowUp', usageCount: ICON_USAGE_COUNTS.ArrowUp || 0 },
  { name: 'ArrowDown', usageCount: ICON_USAGE_COUNTS.ArrowDown || 0 },
  { name: 'Zap', usageCount: ICON_USAGE_COUNTS.Zap || 0 },
  { name: 'Trophy', usageCount: ICON_USAGE_COUNTS.Trophy || 0 },
  { name: 'Trash', usageCount: ICON_USAGE_COUNTS.Trash || 0 },
  { name: 'Target', usageCount: ICON_USAGE_COUNTS.Target || 0 },
  { name: 'TabletSmartphone', usageCount: ICON_USAGE_COUNTS.TabletSmartphone || 0 },
  { name: 'Shuffle', usageCount: ICON_USAGE_COUNTS.Shuffle || 0 },
  {
    name: 'Send',
    animated: ({ isActive }) => <AnimatedSend className="h-5 w-5" isSending={isActive} />,
    usageCount: ICON_USAGE_COUNTS.Send || 0
  },
  { name: 'Pin', usageCount: ICON_USAGE_COUNTS.Pin || 0 },
  { name: 'Percent', usageCount: ICON_USAGE_COUNTS.Percent || 0 },
  { name: 'Pencil', usageCount: ICON_USAGE_COUNTS.Pencil || 0 },
  { name: 'Megaphone', usageCount: ICON_USAGE_COUNTS.Megaphone || 0 },
  { name: 'List', usageCount: ICON_USAGE_COUNTS.List || 0 },
  { name: 'GripVertical', usageCount: ICON_USAGE_COUNTS.GripVertical || 0 },
  { name: 'Flame', usageCount: ICON_USAGE_COUNTS.Flame || 0 },
  { name: 'Calculator', usageCount: ICON_USAGE_COUNTS.Calculator || 0 },
  { name: 'BookOpen', usageCount: ICON_USAGE_COUNTS.BookOpen || 0 },
  { name: 'UserMinus', usageCount: ICON_USAGE_COUNTS.UserMinus || 0 },
  { name: 'Success', usageCount: ICON_USAGE_COUNTS.Success || 0 },
  { name: 'MessageCircle', usageCount: ICON_USAGE_COUNTS.MessageCircle || 0 },
  { name: 'Menu', usageCount: ICON_USAGE_COUNTS.Menu || 0 },
  { name: 'Medal', usageCount: ICON_USAGE_COUNTS.Medal || 0 },
  { name: 'Link2', usageCount: ICON_USAGE_COUNTS.Link2 || 0 },
  { name: 'Laptop', usageCount: ICON_USAGE_COUNTS.Laptop || 0 },
  { name: 'Flag', usageCount: ICON_USAGE_COUNTS.Flag || 0 },
  { name: 'Error', usageCount: ICON_USAGE_COUNTS.Error || 0 },
  { name: 'EllipsisVertical', usageCount: ICON_USAGE_COUNTS.EllipsisVertical || 0 },
  { name: 'Edit2', usageCount: ICON_USAGE_COUNTS.Edit2 || 0 },
  { name: 'Edit', usageCount: ICON_USAGE_COUNTS.Edit || 0 },
  { name: 'Ban', usageCount: ICON_USAGE_COUNTS.Ban || 0 },
  { name: 'ZoomOut', usageCount: ICON_USAGE_COUNTS.ZoomOut || 0 },
  { name: 'ZoomIn', usageCount: ICON_USAGE_COUNTS.ZoomIn || 0 },
  { name: 'Youtube', usageCount: ICON_USAGE_COUNTS.Youtube || 0 },
  { name: 'WifiOff', usageCount: ICON_USAGE_COUNTS.WifiOff || 0 },
  { name: 'Wifi', usageCount: ICON_USAGE_COUNTS.Wifi || 0 },
  { name: 'UtensilsCrossed', usageCount: ICON_USAGE_COUNTS.UtensilsCrossed || 0 },
  { name: 'UserCircle', usageCount: ICON_USAGE_COUNTS.UserCircle || 0 },
  { name: 'UserCheck', usageCount: ICON_USAGE_COUNTS.UserCheck || 0 },
  { name: 'Twitter', usageCount: ICON_USAGE_COUNTS.Twitter || 0 },
  { name: 'TestTube', usageCount: ICON_USAGE_COUNTS.TestTube || 0 },
  { name: 'Square', usageCount: ICON_USAGE_COUNTS.Square || 0 },
  { name: 'SkipForward', usageCount: ICON_USAGE_COUNTS.SkipForward || 0 },
  { name: 'Settings2', usageCount: ICON_USAGE_COUNTS.Settings2 || 0 },
  { name: 'Rocket', usageCount: ICON_USAGE_COUNTS.Rocket || 0 },
  { name: 'Refresh', usageCount: ICON_USAGE_COUNTS.Refresh || 0 },
  { name: 'Quote', usageCount: ICON_USAGE_COUNTS.Quote || 0 },
  { name: 'Play', usageCount: ICON_USAGE_COUNTS.Play || 0 },
  { name: 'Phone', usageCount: ICON_USAGE_COUNTS.Phone || 0 },
  { name: 'Newspaper', usageCount: ICON_USAGE_COUNTS.Newspaper || 0 },
  { name: 'MessageSquare', usageCount: ICON_USAGE_COUNTS.MessageSquare || 0 },
  { name: 'MailCheck', usageCount: ICON_USAGE_COUNTS.MailCheck || 0 },
  { name: 'Loading', usageCount: ICON_USAGE_COUNTS.Loading || 0 },
  { name: 'Key', usageCount: ICON_USAGE_COUNTS.Key || 0 },
  { name: 'Instagram', usageCount: ICON_USAGE_COUNTS.Instagram || 0 },
  { name: 'HelpCircle', usageCount: ICON_USAGE_COUNTS.HelpCircle || 0 },
  { name: 'Grid3X3', usageCount: ICON_USAGE_COUNTS.Grid3X3 || 0 },
  { name: 'Grid', usageCount: ICON_USAGE_COUNTS.Grid || 0 },
  { name: 'GraduationCap', usageCount: ICON_USAGE_COUNTS.GraduationCap || 0 },
  { name: 'FlaskConical', usageCount: ICON_USAGE_COUNTS.FlaskConical || 0 },
  { name: 'Fingerprint', usageCount: ICON_USAGE_COUNTS.Fingerprint || 0 },
  { name: 'Film', usageCount: ICON_USAGE_COUNTS.Film || 0 },
  { name: 'FastForward', usageCount: ICON_USAGE_COUNTS.FastForward || 0 },
  { name: 'Crown', usageCount: ICON_USAGE_COUNTS.Crown || 0 },
  { name: 'Crosshair', usageCount: ICON_USAGE_COUNTS.Crosshair || 0 },
  { name: 'Code', usageCount: ICON_USAGE_COUNTS.Code || 0 },
  { name: 'CheckCheck', usageCount: ICON_USAGE_COUNTS.CheckCheck || 0 },
  {
    name: 'Bookmark',
    animated: ({ isActive }) => <AnimatedBookmark className="h-5 w-5 text-blue-500" isSaved={isActive} />,
    usageCount: ICON_USAGE_COUNTS.Bookmark || 0
  },
  { name: 'BookText', usageCount: ICON_USAGE_COUNTS.BookText || 0 },
  { name: 'Award', usageCount: ICON_USAGE_COUNTS.Award || 0 },
  { name: 'AtSign', usageCount: ICON_USAGE_COUNTS.AtSign || 0 },
  { name: 'ArrowUpDown', usageCount: ICON_USAGE_COUNTS.ArrowUpDown || 0 },
  { name: 'ArrowUpCircle', usageCount: ICON_USAGE_COUNTS.ArrowUpCircle || 0 },
  { name: 'ArrowDownCircle', usageCount: ICON_USAGE_COUNTS.ArrowDownCircle || 0 },
];

type ViewMode = 'list' | 'grid';
type SortField = 'name' | 'usage';
type SortDirection = 'asc' | 'desc';

export default function IconsShowcase() {
  const [animateAll, setAnimateAll] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('usage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Count animated icons
  const animatedCount = ALL_ICONS.filter(i => i.animated).length;
  const totalCount = ALL_ICONS.length;

  // Sort icons based on current sort settings
  const sortedIcons = [...ALL_ICONS].sort((a, b) => {
    if (sortField === 'name') {
      const comparison = a.name.localeCompare(b.name);
      return sortDirection === 'asc' ? comparison : -comparison;
    } else {
      // Sort by usage - put 0 usage at the end when sorting desc
      if (sortDirection === 'desc') {
        if (a.usageCount === 0 && b.usageCount > 0) return 1;
        if (b.usageCount === 0 && a.usageCount > 0) return -1;
      }
      const comparison = a.usageCount - b.usageCount;
      return sortDirection === 'asc' ? comparison : -comparison;
    }
  });

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'usage' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="sm"
          variant={animateAll ? "default" : "outline"}
          onClick={() => setAnimateAll(!animateAll)}
        >
          {animateAll ? "Stop Animations" : "Play All Animations"}
        </Button>

        {/* View Mode Toggle - Segmented Control */}
        <SegmentedControl value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <SegmentedControlList className="w-auto">
            <SegmentedControlTrigger value="list" className="gap-1.5 px-3">
              <Icon name="List" size={14} />
              List
            </SegmentedControlTrigger>
            <SegmentedControlTrigger value="grid" className="gap-1.5 px-3">
              <Icon name="Grid3X3" size={14} />
              Grid
            </SegmentedControlTrigger>
          </SegmentedControlList>
        </SegmentedControl>

        <span className="text-sm text-muted-foreground">
          {animatedCount}/{totalCount} icons have animated variants
        </span>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {sortedIcons.map((icon) => (
            <div
              key={icon.name}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              title={`${icon.name} (${icon.usageCount} uses)`}
            >
              <div className="relative">
                <Icon name={icon.name} size={24} weight="regular" />
                {icon.animated && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" title="Has animation" />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground text-center truncate w-full group-hover:text-foreground">
                {icon.name}
              </span>
              <span className={cn(
                "text-[9px] font-mono",
                icon.usageCount === 0 ? "text-muted-foreground/30" : "text-muted-foreground/60"
              )}>
                {icon.usageCount}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* List View - Icon Matrix */}
      {viewMode === 'list' && (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr,80px,80px,80px] bg-muted/50 border-b border-border">
            <button
              onClick={() => handleSort('name')}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground text-left hover:text-foreground flex items-center gap-1"
            >
              Icon Name
              {sortField === 'name' && (
                <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
              )}
            </button>
            <button
              onClick={() => handleSort('usage')}
              className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center hover:text-foreground flex items-center justify-center gap-1"
            >
              Usage
              {sortField === 'usage' && (
                <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} />
              )}
            </button>
            <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center">Static</div>
            <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center">Animated</div>
          </div>

          {/* Icon Rows */}
          <div className="divide-y divide-border">
            {sortedIcons.map((icon) => (
              <div
                key={icon.name}
                className="grid grid-cols-[1fr,80px,80px,80px] items-center hover:bg-muted/30 transition-colors"
              >
                {/* Name */}
                <div className="px-4 py-2 text-sm font-mono">{icon.name}</div>

                {/* Usage Count */}
                <div className="px-2 py-2 flex items-center justify-center">
                  <span className={cn(
                    "text-xs font-mono",
                    icon.usageCount === 0 ? "text-muted-foreground/40" : "text-muted-foreground"
                  )}>
                    {icon.usageCount}
                  </span>
                </div>

                {/* Static (regular weight) */}
                <div className="px-2 py-2 flex items-center justify-center">
                  <Icon name={icon.name} size={20} weight="regular" />
                </div>

                {/* Animated */}
                <div className="px-2 py-2 flex items-center justify-center">
                  {icon.animated ? (
                    <motion.div
                      animate={animateAll ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ repeat: animateAll ? Infinity : 0, duration: 1 }}
                    >
                      {icon.animated({ isActive: animateAll })}
                    </motion.div>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Animation Wrapper Demo */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Animation Wrapper</h4>
        <p className="text-xs text-muted-foreground">
          Use <code className="bg-muted px-1 rounded">AnimatedIconWrapper</code> to add animations to any icon.
        </p>
        <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="bounce" onHover="scale">
              <Icon name="Sparkles" size={24} className="text-yellow-500" />
            </AnimatedIconWrapper>
            <span className="text-xs">bounce</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="shake" onHover="rotate">
              <Icon name="Bell" size={24} className="text-blue-500" />
            </AnimatedIconWrapper>
            <span className="text-xs">shake</span>
          </div>
        </div>
      </div>

      {/* Pulsing Dot */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Pulsing Dot</h4>
        <p className="text-xs text-muted-foreground">
          Use pulsing dots for notifications and status indicators (not loading states).
        </p>
        <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="pulse" onHover="none">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </AnimatedIconWrapper>
            <span className="text-xs">notification</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="pulse" onHover="none">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </AnimatedIconWrapper>
            <span className="text-xs">online</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedIconWrapper animate="pulse" onHover="none">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </AnimatedIconWrapper>
            <span className="text-xs">active</span>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Usage</h4>
        <div className="p-4 rounded-lg bg-muted font-mono text-xs overflow-x-auto">
          <pre>{`import { Icon } from '@/components/ui/Icon';

// Static (default)
<Icon name="Heart" size={20} />

// With animation wrapper
import { AnimatedIconWrapper } from '@/components/ui/animated-icons';

<AnimatedIconWrapper animate="pulse">
  <Icon name="Heart" size={20} />
</AnimatedIconWrapper>`}</pre>
        </div>
      </div>
    </div>
  );
}
