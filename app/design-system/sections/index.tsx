"use client";

import React from 'react';

// Import all section components
import { ActivityCardSection } from './ActivityCardSection';
import { AlertSection } from './AlertSection';
import { AnimationsSection } from './AnimationsSection';
import { AllocationBarSection } from './AllocationBarSection';
import { BadgeSection } from './BadgeSection';
import { BannerSystemSection } from './BannerSystemSection';
import { BordersSeparatorsSection } from './BordersSeparatorsSection';
import { ButtonSection } from './ButtonSection';
import { CardSection } from './CardSection';
import { ChartsSection } from './ChartsSection';
import { ColorSystemSection } from './ColorSystemSection';
import { ContentPageSection } from './ContentPageSection';
import { ColorTokenReferenceSection } from './ColorTokenReferenceSection';
import { DrawersModalsSection } from './DrawersModalsSection';
import { PageStatsSection } from './PageStatsSection';
import { EmailSection } from './EmailSection';
import { MenuDropdownSection } from './MenuDropdownSection';
import { MenuSidebarSection } from './MenuSidebarSection';
import { EmptyStateSection } from './EmptyStateSection';
import { FormControlsSection } from './FormControlsSection';
import { FullPageErrorSection } from './FullPageErrorSection';
import { IconsSection } from './IconsSection';
import { InlineErrorSection } from './InlineErrorSection';
import { InputSection } from './InputSection';
import { LoadingStatesSection } from './LoadingStatesSection';
import { PageHeaderSection } from './PageHeaderSection';
import { PageLinksCardSection } from './PageLinksCardSection';
import { PieChartSection } from './PieChartSection';
import { PillLinkSection } from './PillLinkSection';
import { RollingCounterSection } from './RollingCounterSection';
import { SaveStatusSection } from './SaveStatusSection';
import { SearchResultsSection } from './SearchResultsSection';
import { SegmentedControlSection } from './SegmentedControlSection';
import { ShinyButtonSection } from './ShinyButtonSection';
import { TableSection } from './TableSection';
import { TabsSection } from './TabsSection';
import { TextareaSection } from './TextareaSection';
import { TextSelectionMenuSection } from './TextSelectionMenuSection';
import { ToastSection } from './ToastSection';
import { TooltipSection } from './TooltipSection';
import { TurnstileSection } from './TurnstileSection';
import { TypographySection } from './TypographySection';
import { UsernameBadgeSection } from './UsernameBadgeSection';

export interface DesignSystemSection {
  id: string;
  label: string;
  component: React.ComponentType<{ id: string }>;
}

// Define all sections - they will be auto-sorted alphabetically by label
const SECTIONS_UNSORTED: DesignSystemSection[] = [
  { id: 'activity-card', label: 'Activity Card', component: ActivityCardSection },
  { id: 'alert', label: 'Alert', component: AlertSection },
  { id: 'animations', label: 'Animations', component: AnimationsSection },
  { id: 'allocation-bar', label: 'Allocation Bar', component: AllocationBarSection },
  { id: 'badge', label: 'Badge', component: BadgeSection },
  { id: 'banner-system', label: 'Banner System', component: BannerSystemSection },
  { id: 'borders-separators', label: 'Borders & Separators', component: BordersSeparatorsSection },
  { id: 'button', label: 'Button', component: ButtonSection },
  { id: 'card', label: 'Card', component: CardSection },
  { id: 'charts', label: 'Charts & Sparklines', component: ChartsSection },
  { id: 'color-system', label: 'Color System Controls', component: ColorSystemSection },
  { id: 'color-token-reference', label: 'Color Token Reference', component: ColorTokenReferenceSection },
  { id: 'content-page', label: 'Content Page', component: ContentPageSection },
  { id: 'drawers-modals', label: 'Drawers & Modals', component: DrawersModalsSection },
  { id: 'email', label: 'Email', component: EmailSection },
  { id: 'menu-dropdown', label: 'Menu (Dropdown)', component: MenuDropdownSection },
  { id: 'menu-sidebar', label: 'Menu (Sidebar)', component: MenuSidebarSection },
  { id: 'empty-state', label: 'Empty State', component: EmptyStateSection },
  { id: 'form-controls', label: 'Form Controls', component: FormControlsSection },
  { id: 'full-page-error', label: 'Full Page Error', component: FullPageErrorSection },
    { id: 'icons', label: 'Icons', component: IconsSection },
  { id: 'inline-error', label: 'Inline Error Cards', component: InlineErrorSection },
  { id: 'input', label: 'Input', component: InputSection },
  { id: 'loading-states', label: 'Loading States', component: LoadingStatesSection },
  { id: 'page-header', label: 'Page Header', component: PageHeaderSection },
  { id: 'page-links-card', label: 'Page Links Card', component: PageLinksCardSection },
  { id: 'page-stats', label: 'Page Stats', component: PageStatsSection },
  { id: 'pie-chart', label: 'Pie Chart', component: PieChartSection },
  { id: 'pill-link', label: 'PillLink', component: PillLinkSection },
  { id: 'rolling-counter', label: 'Rolling Counter', component: RollingCounterSection },
  { id: 'save-status', label: 'Save Status', component: SaveStatusSection },
  { id: 'search-results', label: 'Search Results', component: SearchResultsSection },
  { id: 'segmented-control', label: 'Segmented Control', component: SegmentedControlSection },
  { id: 'shiny-button', label: 'Shiny Button System', component: ShinyButtonSection },
  { id: 'table', label: 'Table', component: TableSection },
  { id: 'tabs', label: 'Tabs', component: TabsSection },
  { id: 'textarea', label: 'Textarea', component: TextareaSection },
  { id: 'text-selection-menu', label: 'Text Selection Menu', component: TextSelectionMenuSection },
  { id: 'toast', label: 'Toast', component: ToastSection },
  { id: 'tooltip', label: 'Tooltip', component: TooltipSection },
  { id: 'turnstile', label: 'Turnstile (Spam Prevention)', component: TurnstileSection },
  { id: 'typography', label: 'Typography', component: TypographySection },
  { id: 'username-badge', label: 'UsernameBadge', component: UsernameBadgeSection },
];

// Auto-sort alphabetically by label
export const DESIGN_SYSTEM_SECTIONS = SECTIONS_UNSORTED.sort((a, b) =>
  a.label.localeCompare(b.label)
);

// Export for sidebar navigation (just id and label)
export const DESIGN_SYSTEM_NAV = DESIGN_SYSTEM_SECTIONS.map(({ id, label }) => ({ id, label }));
