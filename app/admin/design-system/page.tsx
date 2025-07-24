"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Slider } from '../../components/ui/slider';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Modal } from '../../components/ui/modal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import { 
  Palette, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  Search,
  Filter,
  Download,
  Upload,
  Settings,
  Users,
  FileText,
  BarChart3,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Minus,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Home,
  Menu,
  Bell,
  Heart,
  Star,
  Share,
  MessageCircle,
  Calendar,
  Clock,
  MapPin,
  Mail,
  Phone,
  Globe,
  Lock,
  Unlock,
  Shield,
  Key,
  Database,
  Server,
  Cloud,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Stop,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Move,
  Crop,
  Image,
  Video,
  Music,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  HardDrive,
  Cpu,
  MemoryStick,
  MousePointer,
  Keyboard,
  Headphones,
  Printer,
  Scanner,
  Gamepad2,
  Joystick,
  Tv,
  Radio,
  Bluetooth,
  Usb,
  HardDriveIcon
} from 'lucide-react';

interface ComponentUsage {
  name: string;
  path: string;
  type: 'primitive' | 'composite' | 'utility';
  category: string;
  usageCount: number;
  importedBy: string[];
  variants?: string[];
  props?: string[];
  description?: string;
  duplicates?: string[];
}

interface UIAnalysisData {
  stats: {
    totalComponents: number;
    totalUsages: number;
    averageUsage: number;
    mostUsed: ComponentUsage;
    leastUsed: ComponentUsage;
    unused: ComponentUsage[];
    categories: number;
    primitiveCount: number;
    compositeCount: number;
    utilityCount: number;
  };
  components: ComponentUsage[];
  byCategory: Record<string, ComponentUsage[]>;
  recommendations: {
    consolidation: ComponentUsage[];
    promotion: ComponentUsage[];
    cleanup: ComponentUsage[];
  };
}

export default function DesignSystemPage() {
  const [analysisData, setAnalysisData] = useState<UIAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'usage' | 'name' | 'category'>('usage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch UI analysis data
  const fetchUIAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/ui-analysis');
      if (response.ok) {
        const data = await response.json();
        setAnalysisData(data);
      } else {
        console.error('Failed to fetch UI analysis:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching UI analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUIAnalysis();
  }, []);

  // Filter and sort components
  const filteredComponents = React.useMemo(() => {
    if (!analysisData) return [];
    
    let filtered = analysisData.components.filter(component => {
      const matchesSearch = component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           component.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || component.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort components
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'usage':
          comparison = a.usageCount - b.usageCount;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [analysisData, searchTerm, selectedCategory, sortBy, sortOrder]);

  // Get unique categories
  const categories = React.useMemo(() => {
    if (!analysisData) return [];
    return Array.from(new Set(analysisData.components.map(c => c.category))).sort();
  }, [analysisData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Palette className="h-8 w-8" />
            Design System
          </h1>
          <p className="text-muted-foreground">
            Comprehensive catalog of UI components, usage patterns, and design system health
          </p>
        </div>
        <Button onClick={fetchUIAnalysis} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisData && !isLoading && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysisData.stats.totalComponents}</div>
                <p className="text-xs text-muted-foreground">
                  {analysisData.stats.primitiveCount} primitives, {analysisData.stats.compositeCount} composite
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysisData.stats.totalUsages}</div>
                <p className="text-xs text-muted-foreground">
                  Avg: {analysisData.stats.averageUsage.toFixed(1)} per component
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Most Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{analysisData.stats.mostUsed?.name || 'N/A'}</div>
                <p className="text-xs text-muted-foreground">
                  {analysisData.stats.mostUsed?.usageCount || 0} usages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unused Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {analysisData.stats.unused.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cleanup opportunities
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="showcase">Showcase</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Component Categories</CardTitle>
                  <CardDescription>
                    Distribution of components across different categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(analysisData.byCategory).map(([category, components]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{category}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {components.length} components
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {components.reduce((sum, c) => sum + c.usageCount, 0)} total usages
                          </div>
                          <Progress
                            value={(components.length / analysisData.stats.totalComponents) * 100}
                            className="w-20"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Health Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      High Usage Components
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisData.components
                        .filter(c => c.usageCount > 10)
                        .slice(0, 5)
                        .map(component => (
                          <div key={component.name} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{component.name}</span>
                            <Badge variant="secondary">{component.usageCount}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-600" />
                      Low Usage Components
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisData.components
                        .filter(c => c.usageCount <= 2 && c.usageCount > 0)
                        .slice(0, 5)
                        .map(component => (
                          <div key={component.name} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{component.name}</span>
                            <Badge variant="outline">{component.usageCount}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Components Tab */}
            <TabsContent value="components" className="space-y-4">
              {/* Filters */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="search">Search Components</Label>
                      <Input
                        id="search"
                        placeholder="Search by name or category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="w-full md:w-48">
                      <Label htmlFor="category">Category</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full md:w-32">
                      <Label htmlFor="sort">Sort By</Label>
                      <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usage">Usage</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="category">Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full md:w-24">
                      <Label htmlFor="order">Order</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="mt-1 w-full"
                      >
                        {sortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Components List */}
              <div className="grid grid-cols-1 gap-4">
                {filteredComponents.map(component => (
                  <Card key={component.name}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold">{component.name}</h3>
                            <Badge variant={component.type === 'primitive' ? 'default' : 'secondary'}>
                              {component.type}
                            </Badge>
                            <Badge variant="outline">{component.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {component.description || 'No description available'}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Path: <code className="bg-muted px-1 rounded">{component.path}</code>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{component.usageCount}</div>
                          <div className="text-xs text-muted-foreground">usages</div>
                        </div>
                      </div>

                      {component.variants && component.variants.length > 0 && (
                        <div className="mt-3">
                          <Label className="text-xs">Variants:</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {component.variants.map(variant => (
                              <Badge key={variant} variant="outline" className="text-xs">
                                {variant}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {component.duplicates && component.duplicates.length > 0 && (
                        <Alert className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Potential Duplicates</AlertTitle>
                          <AlertDescription>
                            Similar components found: {component.duplicates.join(', ')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredComponents.length === 0 && (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground">No components found matching your criteria.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Showcase Tab */}
            <TabsContent value="showcase" className="space-y-6">
              {/* Buttons Showcase */}
              <Card>
                <CardHeader>
                  <CardTitle>Buttons</CardTitle>
                  <CardDescription>All button variants and states</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Variants</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button variant="default">Default</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="link">Link</Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Sizes</Label>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Button size="sm">Small</Button>
                        <Button size="default">Default</Button>
                        <Button size="lg">Large</Button>
                        <Button size="icon"><Settings className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">States</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button>Normal</Button>
                        <Button disabled>Disabled</Button>
                        <Button>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Loading
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Form Elements Showcase */}
              <Card>
                <CardHeader>
                  <CardTitle>Form Elements</CardTitle>
                  <CardDescription>Input fields, selects, and form controls</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="demo-input">Input</Label>
                        <Input id="demo-input" placeholder="Enter text..." className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="demo-textarea">Textarea</Label>
                        <Textarea id="demo-textarea" placeholder="Enter longer text..." className="mt-1" />
                      </div>
                      <div>
                        <Label>Select</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Choose option..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="option1">Option 1</SelectItem>
                            <SelectItem value="option2">Option 2</SelectItem>
                            <SelectItem value="option3">Option 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="demo-checkbox" />
                        <Label htmlFor="demo-checkbox">Checkbox</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="demo-switch" />
                        <Label htmlFor="demo-switch">Switch</Label>
                      </div>
                      <div>
                        <Label>Radio Group</Label>
                        <RadioGroup defaultValue="option1" className="mt-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="option1" id="r1" />
                            <Label htmlFor="r1">Option 1</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="option2" id="r2" />
                            <Label htmlFor="r2">Option 2</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div>
                        <Label>Slider</Label>
                        <Slider defaultValue={[50]} max={100} step={1} className="mt-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feedback Elements Showcase */}
              <Card>
                <CardHeader>
                  <CardTitle>Feedback & Status</CardTitle>
                  <CardDescription>Alerts, badges, progress indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Alerts</Label>
                      <div className="space-y-2 mt-2">
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertTitle>Info</AlertTitle>
                          <AlertDescription>This is an informational alert.</AlertDescription>
                        </Alert>
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>This is an error alert.</AlertDescription>
                        </Alert>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Badges</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge>Default</Badge>
                        <Badge variant="secondary">Secondary</Badge>
                        <Badge variant="destructive">Destructive</Badge>
                        <Badge variant="outline">Outline</Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Progress</Label>
                      <div className="space-y-2 mt-2">
                        <Progress value={33} />
                        <Progress value={66} />
                        <Progress value={100} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Skeleton Loading</Label>
                      <div className="space-y-2 mt-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Layout Elements Showcase */}
              <Card>
                <CardHeader>
                  <CardTitle>Layout & Navigation</CardTitle>
                  <CardDescription>Cards, separators, and navigation elements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Card</Label>
                      <Card className="mt-2">
                        <CardHeader>
                          <CardTitle>Card Title</CardTitle>
                          <CardDescription>Card description goes here</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p>This is the card content area.</p>
                        </CardContent>
                      </Card>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Separator</Label>
                      <div className="mt-2">
                        <p>Content above separator</p>
                        <Separator className="my-4" />
                        <p>Content below separator</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Avatar</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar>
                          <AvatarImage src="https://github.com/shadcn.png" />
                          <AvatarFallback>CN</AvatarFallback>
                        </Avatar>
                        <Avatar>
                          <AvatarFallback>JD</AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-4">
              {analysisData.recommendations.cleanup.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-600" />
                      Cleanup Opportunities
                    </CardTitle>
                    <CardDescription>
                      Components that may be candidates for removal or consolidation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisData.recommendations.cleanup.map(component => (
                        <div key={component.name} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{component.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({component.usageCount} usages)
                            </span>
                          </div>
                          <Badge variant="outline">
                            {component.usageCount === 0 ? 'Unused' : 'Low Usage'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysisData.recommendations.consolidation.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Copy className="h-4 w-4 text-orange-600" />
                      Consolidation Candidates
                    </CardTitle>
                    <CardDescription>
                      Components that might be duplicates or could be merged
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisData.recommendations.consolidation.map(component => (
                        <div key={component.name} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{component.name}</span>
                            {component.duplicates && (
                              <div className="text-sm text-muted-foreground">
                                Similar to: {component.duplicates.join(', ')}
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary">Review</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysisData.recommendations.promotion.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Promotion Candidates
                    </CardTitle>
                    <CardDescription>
                      Components that are heavily used and could be enhanced or documented better
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisData.recommendations.promotion.map(component => (
                        <div key={component.name} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{component.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({component.usageCount} usages)
                            </span>
                          </div>
                          <Badge variant="default">High Priority</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Design System Health Score */}
              <Card>
                <CardHeader>
                  <CardTitle>Design System Health</CardTitle>
                  <CardDescription>
                    Overall assessment of the design system organization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Component Utilization</span>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={((analysisData.stats.totalComponents - analysisData.stats.unused.length) / analysisData.stats.totalComponents) * 100}
                          className="w-20"
                        />
                        <span className="text-sm">
                          {Math.round(((analysisData.stats.totalComponents - analysisData.stats.unused.length) / analysisData.stats.totalComponents) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Average Usage per Component</span>
                      <span className="text-sm font-medium">
                        {analysisData.stats.averageUsage.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Categories</span>
                      <span className="text-sm font-medium">
                        {analysisData.stats.categories}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
