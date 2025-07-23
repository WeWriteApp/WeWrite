"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Switch } from '../../components/ui/switch';
import { Slider } from '../../components/ui/slider';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  Search, 
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Zap
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

export default function UITestPage() {
  const [analysisData, setAnalysisData] = useState<UIAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    fetchUIAnalysis();
  }, []);

  const fetchUIAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ui-analysis');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch UI analysis');
      }
      
      setAnalysisData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching UI analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredComponents = analysisData?.components.filter(component => {
    const matchesSearch = component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         component.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || component.category === selectedCategory;
    const matchesType = selectedType === 'all' || component.type === selectedType;
    
    return matchesSearch && matchesCategory && matchesType;
  }) || [];

  const getUsageColor = (count: number) => {
    if (count === 0) return 'bg-red-500';
    if (count < 5) return 'bg-orange-500';
    if (count < 15) return 'bg-yellow-500';
    if (count < 30) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'primitive': return <Zap className="h-4 w-4" />;
      case 'composite': return <FileText className="h-4 w-4" />;
      case 'utility': return <Users className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading UI Analysis</AlertTitle>
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchUIAnalysis}
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No UI analysis data could be loaded.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">UI Design System Test</h1>
          <p className="text-muted-foreground">
            Comprehensive analysis of UI components, usage patterns, and design system health
          </p>
        </div>
        <Button onClick={fetchUIAnalysis} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Analysis
        </Button>
      </div>

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
              Avg: {analysisData.stats.averageUsage} per component
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.stats.mostUsed.name}</div>
            <p className="text-xs text-muted-foreground">
              {analysisData.stats.mostUsed.usageCount} usages
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unused Components</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analysisData.stats.unused.length}</div>
            <p className="text-xs text-muted-foreground">
              Need cleanup or promotion
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="components" className="space-y-4">
        <TabsList>
          <TabsTrigger value="components">Component Analysis</TabsTrigger>
          <TabsTrigger value="showcase">Component Showcase</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="search">Search Components</Label>
                  <Input
                    id="search"
                    placeholder="Search by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.keys(analysisData.byCategory).map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="primitive">Primitive</SelectItem>
                      <SelectItem value="composite">Composite</SelectItem>
                      <SelectItem value="utility">Utility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component List */}
          <Card>
            <CardHeader>
              <CardTitle>Components ({filteredComponents.length})</CardTitle>
              <CardDescription>
                Sorted by usage count (most used first)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredComponents.map((component, index) => (
                <div key={component.name} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">#{index + 1}</span>
                      {getTypeIcon(component.type)}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{component.name}</span>
                        <Badge variant="outline">{component.category}</Badge>
                        <Badge variant={component.type === 'primitive' ? 'default' : 'secondary'}>
                          {component.type}
                        </Badge>
                      </div>
                      
                      {component.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {component.description}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                        <span>{component.path}</span>
                        {component.props && component.props.length > 0 && (
                          <span>{component.props.length} props</span>
                        )}
                        {component.variants && component.variants.length > 0 && (
                          <span>{component.variants.length} variants</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="font-bold">{component.usageCount}</div>
                      <div className="text-xs text-muted-foreground">usages</div>
                    </div>
                    <div className={`w-3 h-8 rounded ${getUsageColor(component.usageCount)}`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="showcase" className="space-y-6">
          {/* Buttons Section */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>All button variants and states</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
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
                    <Button size="icon"><Search className="h-4 w-4" /></Button>
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

          {/* Form Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Form Controls</CardTitle>
              <CardDescription>Input fields, selects, and form elements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="demo-input">Input</Label>
                  <Input id="demo-input" placeholder="Enter text..." />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-select">Select</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose option..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-textarea">Textarea</Label>
                  <Textarea id="demo-textarea" placeholder="Enter longer text..." />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="demo-checkbox" />
                    <Label htmlFor="demo-checkbox">Checkbox option</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="demo-switch" />
                    <Label htmlFor="demo-switch">Switch option</Label>
                  </div>

                  <RadioGroup defaultValue="option1" className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option1" id="radio1" />
                      <Label htmlFor="radio1">Radio Option 1</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option2" id="radio2" />
                      <Label htmlFor="radio2">Radio Option 2</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Slider</Label>
                <Slider defaultValue={[50]} max={100} step={1} className="w-full" />
              </div>
            </CardContent>
          </Card>

          {/* Display Components */}
          <Card>
            <CardHeader>
              <CardTitle>Display Components</CardTitle>
              <CardDescription>Cards, badges, avatars, and visual elements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Label className="text-sm font-medium">Avatars</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" alt="Avatar" />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Progress</Label>
                <div className="space-y-2 mt-2">
                  <Progress value={33} className="w-full" />
                  <Progress value={66} className="w-full" />
                  <Progress value={100} className="w-full" />
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">Loading States</Label>
                <div className="space-y-2 mt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feedback Components */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback Components</CardTitle>
              <CardDescription>Alerts, notifications, and status indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Info Alert</AlertTitle>
                <AlertDescription>
                  This is an informational alert message.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Alert</AlertTitle>
                <AlertDescription>
                  This is an error alert message.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {/* Cleanup Recommendations */}
          {analysisData.recommendations.cleanup.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span>Cleanup Recommendations</span>
                </CardTitle>
                <CardDescription>
                  Components with zero usage that should be removed or promoted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisData.recommendations.cleanup.map(component => (
                    <div key={component.name} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <span className="font-medium">{component.name}</span>
                        <p className="text-sm text-muted-foreground">{component.path}</p>
                      </div>
                      <Badge variant="destructive">0 usages</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Consolidation Recommendations */}
          {analysisData.recommendations.consolidation.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <span>Consolidation Opportunities</span>
                </CardTitle>
                <CardDescription>
                  Low-usage composite components that could be consolidated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisData.recommendations.consolidation.map(component => (
                    <div key={component.name} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <span className="font-medium">{component.name}</span>
                        <p className="text-sm text-muted-foreground">{component.path}</p>
                      </div>
                      <Badge variant="outline">{component.usageCount} usages</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Promotion Recommendations */}
          {analysisData.recommendations.promotion.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Promotion Candidates</span>
                </CardTitle>
                <CardDescription>
                  High-usage composite components that should become primitives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisData.recommendations.promotion.map(component => (
                    <div key={component.name} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <span className="font-medium">{component.name}</span>
                        <p className="text-sm text-muted-foreground">{component.path}</p>
                      </div>
                      <Badge variant="default">{component.usageCount} usages</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Design System Health */}
          <Card>
            <CardHeader>
              <CardTitle>Design System Health</CardTitle>
              <CardDescription>
                Overall assessment and improvement suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Component Distribution</Label>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Primitives</span>
                      <span>{analysisData.stats.primitiveCount}</span>
                    </div>
                    <Progress value={(analysisData.stats.primitiveCount / analysisData.stats.totalComponents) * 100} />

                    <div className="flex justify-between text-sm">
                      <span>Composite</span>
                      <span>{analysisData.stats.compositeCount}</span>
                    </div>
                    <Progress value={(analysisData.stats.compositeCount / analysisData.stats.totalComponents) * 100} />

                    <div className="flex justify-between text-sm">
                      <span>Utility</span>
                      <span>{analysisData.stats.utilityCount}</span>
                    </div>
                    <Progress value={(analysisData.stats.utilityCount / analysisData.stats.totalComponents) * 100} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Usage Health</Label>
                  <div className="space-y-2">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Average Usage:</strong> {analysisData.stats.averageUsage} per component
                      </AlertDescription>
                    </Alert>

                    {analysisData.stats.unused.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{analysisData.stats.unused.length}</strong> components are unused
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Recommendations Summary</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {analysisData.recommendations.cleanup.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Components to cleanup</div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {analysisData.recommendations.consolidation.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Consolidation opportunities</div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {analysisData.recommendations.promotion.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Promotion candidates</div>
                    </div>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
