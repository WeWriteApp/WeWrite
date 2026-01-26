#!/usr/bin/env tsx

/**
 * List Available Icons
 *
 * This script lists all icons currently available in the Icon component.
 * Run with: bun run icons:list
 */

// Read the Icon.tsx file and extract iconMap
import { readFileSync } from 'fs';
import { join } from 'path';

const iconFilePath = join(process.cwd(), 'app/components/ui/Icon.tsx');
const iconFileContent = readFileSync(iconFilePath, 'utf-8');

// Extract iconMap object from the file
const iconMapMatch = iconFileContent.match(/const iconMap[^{]*{([^}]+)}/s);

if (!iconMapMatch) {
  console.error('Could not find iconMap in Icon.tsx');
  process.exit(1);
}

// Parse the iconMap to extract icon names
const iconMapContent = iconMapMatch[1];
const iconNames = iconMapContent
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('//'))
  .map(line => {
    const match = line.match(/^(\w+):/);
    return match ? match[1] : null;
  })
  .filter((name): name is string => name !== null)
  .sort();

// Display results
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║          Available Icons in Icon.tsx Component            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Group icons by category based on comments in Icon.tsx
const categories = {
  'Navigation & Arrows': [] as string[],
  'Media Controls': [] as string[],
  'Actions': [] as string[],
  'Status & Feedback': [] as string[],
  'User & Profile': [] as string[],
  'Communication': [] as string[],
  'Media & Files': [] as string[],
  'Time & Calendar': [] as string[],
  'Location & Map': [] as string[],
  'Finance & Payment': [] as string[],
  'Social & Engagement': [] as string[],
  'Settings & Tools': [] as string[],
  'Layout & Display': [] as string[],
  'Data & Charts': [] as string[],
  'Miscellaneous': [] as string[],
};

// Simple categorization (could be improved with more sophisticated parsing)
iconNames.forEach(name => {
  if (['Home', 'Menu', 'Close', 'X', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowUpCircle', 'ArrowDownCircle', 'ChevronLeft', 'ChevronRight', 'ChevronDown', 'ChevronUp', 'ExternalLink', 'SkipForward'].includes(name)) {
    categories['Navigation & Arrows'].push(name);
  } else if (['Play', 'Pause', 'Stop', 'Square', 'FastForward', 'Video', 'Camera', 'PlayCircle', 'StopCircle'].includes(name)) {
    categories['Media Controls'].push(name);
  } else if (['Plus', 'Minus', 'Check', 'CheckCheck', 'CheckCircle', 'CheckCircle2', 'Edit', 'Edit2', 'Edit3', 'Pencil', 'PenLine', 'Save', 'Trash', 'Trash2', 'Copy', 'Download', 'Upload', 'Share', 'Share2', 'Send', 'Reply', 'Refresh', 'RefreshCw', 'RotateCcw', 'Undo2'].includes(name)) {
    categories['Actions'].push(name);
  } else if (['Info', 'Warning', 'Error', 'Success', 'AlertCircle', 'AlertTriangle', 'HelpCircle', 'XCircle', 'Loader', 'Loading', 'Loader2'].includes(name)) {
    categories['Status & Feedback'].push(name);
  } else if (['User', 'Users', 'UserCircle', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'LogOut'].includes(name)) {
    categories['User & Profile'].push(name);
  } else if (['Bell', 'Mail', 'MailCheck', 'MessageCircle', 'MessageSquare', 'Megaphone', 'Phone', 'AtSign', 'Mic', 'MailWarning'].includes(name)) {
    categories['Communication'].push(name);
  } else if (['Eye', 'EyeOff', 'Search', 'Filter', 'Image', 'File', 'FileText', 'FilePlus', 'Folder', 'FolderOpen', 'Inbox', 'Grid', 'Grid3X3', 'List', 'FileStack', 'FolderPlus'].includes(name)) {
    categories['Media & Files'].push(name);
  } else if (['Calendar', 'Clock', 'History'].includes(name)) {
    categories['Time & Calendar'].push(name);
  } else if (['MapPin', 'Map', 'Globe', 'Crosshair'].includes(name)) {
    categories['Location & Map'].push(name);
  } else if (['DollarSign', 'CreditCard', 'Wallet', 'Banknote', 'Calculator', 'Percent', 'Coins'].includes(name)) {
    categories['Finance & Payment'].push(name);
  } else if (['Heart', 'Star', 'Bookmark', 'ThumbsUp', 'ThumbsDown', 'Trophy', 'Award', 'Crown', 'Medal'].includes(name)) {
    categories['Social & Engagement'].push(name);
  } else if (['Settings', 'Settings2', 'Link', 'Link2', 'Lock', 'Unlock', 'Key', 'Fingerprint', 'Shield', 'ShieldCheck', 'ShieldX', 'ShieldAlert', 'Zap', 'Lightbulb', 'Sparkles', 'Target', 'Wrench'].includes(name)) {
    categories['Settings & Tools'].push(name);
  } else if (['Monitor', 'Smartphone', 'Tablet', 'Laptop', 'Sun', 'Moon', 'Palette', 'Type', 'TabletSmartphone', 'RectangleHorizontal', 'RectangleVertical'].includes(name)) {
    categories['Layout & Display'].push(name);
  } else if (['BarChart3', 'TrendingUp', 'TrendingDown', 'Activity', 'Network', 'Database', 'Code', 'ChartBar', 'Code2'].includes(name)) {
    categories['Data & Charts'].push(name);
  } else {
    categories['Miscellaneous'].push(name);
  }
});

// Display by category
Object.entries(categories).forEach(([category, icons]) => {
  if (icons.length > 0) {
    console.log(`\n${category}:`);
    console.log('─'.repeat(category.length + 1));
    icons.forEach(icon => {
      console.log(`  • ${icon}`);
    });
  }
});

console.log(`\n${'═'.repeat(64)}`);
console.log(`Total Icons: ${iconNames.length}`);
console.log(`${'═'.repeat(64)}\n`);

console.log('📖 Browse all Lucide icons: https://lucide.dev/icons\n');
console.log('ℹ️  To add a new icon:');
console.log('   1. Import it from "lucide-react" in Icon.tsx');
console.log('   2. Add it to the iconMap object');
console.log('   3. Add it to the IconName type union\n');
