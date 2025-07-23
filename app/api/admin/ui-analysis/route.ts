import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../admin-auth-helper';
import { promises as fs } from 'fs';
import path from 'path';

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

/**
 * Recursively search for component usage in files
 */
async function searchComponentUsage(componentName: string, searchDir: string): Promise<string[]> {
  const usages: string[] = [];
  
  try {
    const entries = await fs.readdir(searchDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(searchDir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subUsages = await searchComponentUsage(componentName, fullPath);
        usages.push(...subUsages);
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          
          // Check for various usage patterns
          const patterns = [
            new RegExp(`import.*${componentName}.*from`, 'g'),
            new RegExp(`import.*{.*${componentName}.*}`, 'g'),
            new RegExp(`<${componentName}[\\s>]`, 'g'),
            new RegExp(`${componentName}\\(`, 'g'),
          ];
          
          const hasUsage = patterns.some(pattern => pattern.test(content));
          if (hasUsage) {
            usages.push(fullPath.replace(process.cwd(), ''));
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
  
  return usages;
}

/**
 * Extract component information from file
 */
async function analyzeComponent(filePath: string): Promise<Partial<ComponentUsage>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Extract props interface
    const propsMatch = content.match(/interface\s+\w*Props\s*{([^}]*)}/s);
    const props = propsMatch ? 
      propsMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && !line.startsWith('*'))
        .map(line => line.split(':')[0].replace('?', '').trim())
        .filter(prop => prop)
      : [];
    
    // Extract variants (for button, card, etc.)
    const variantMatch = content.match(/variant.*?=.*?["'`]([^"'`]+)["'`]/g);
    const variants = variantMatch ? 
      variantMatch.map(match => match.match(/["'`]([^"'`]+)["'`]/)?.[1]).filter(Boolean)
      : [];
    
    // Extract description from comments
    const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^\n]*)/);
    const description = descMatch ? descMatch[1].trim() : '';
    
    return {
      props,
      variants,
      description
    };
  } catch (error) {
    return {};
  }
}

/**
 * Categorize components
 */
function categorizeComponent(name: string, filePath: string): { type: ComponentUsage['type'], category: string } {
  const fileName = name.toLowerCase();
  
  // Primitive components
  if (['button', 'input', 'textarea', 'select', 'checkbox', 'radio', 'switch', 'slider'].includes(fileName)) {
    return { type: 'primitive', category: 'Form Controls' };
  }
  
  if (['card', 'badge', 'avatar', 'separator', 'progress'].includes(fileName)) {
    return { type: 'primitive', category: 'Display' };
  }
  
  if (['dialog', 'modal', 'popover', 'tooltip', 'sheet', 'dropdown-menu'].includes(fileName)) {
    return { type: 'primitive', category: 'Overlays' };
  }
  
  if (['accordion', 'tabs', 'collapsible', 'navigation-menu'].includes(fileName)) {
    return { type: 'primitive', category: 'Navigation' };
  }
  
  if (['table', 'data-table', 'command'].includes(fileName)) {
    return { type: 'primitive', category: 'Data Display' };
  }
  
  if (['skeleton', 'placeholder', 'loader', 'spinner'].some(term => fileName.includes(term))) {
    return { type: 'utility', category: 'Loading States' };
  }
  
  if (['toast', 'alert', 'error'].some(term => fileName.includes(term))) {
    return { type: 'utility', category: 'Feedback' };
  }
  
  // Composite components
  if (fileName.includes('modal') || fileName.includes('menu') || fileName.includes('picker')) {
    return { type: 'composite', category: 'Complex UI' };
  }
  
  return { type: 'composite', category: 'Custom' };
}

/**
 * GET /api/admin/ui-analysis
 * Analyze UI component usage across the codebase
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: 'Admin access required',
        details: adminCheck.error
      }, { status: 403 });
    }
    
    const uiComponentsDir = path.join(process.cwd(), 'app/components/ui');
    const appDir = path.join(process.cwd(), 'app');
    
    // Get all UI components
    const files = await fs.readdir(uiComponentsDir);
    const componentFiles = files.filter(file => 
      (file.endsWith('.tsx') || file.endsWith('.ts')) && 
      !file.endsWith('.d.ts') &&
      file !== 'use-toast.ts'
    );
    
    const components: ComponentUsage[] = [];
    
    // Analyze each component
    for (const file of componentFiles) {
      const filePath = path.join(uiComponentsDir, file);
      const componentName = path.basename(file, path.extname(file));
      const relativePath = `app/components/ui/${file}`;
      
      // Get usage count
      const usages = await searchComponentUsage(componentName, appDir);
      
      // Analyze component details
      const analysis = await analyzeComponent(filePath);
      
      // Categorize component
      const { type, category } = categorizeComponent(componentName, filePath);
      
      components.push({
        name: componentName,
        path: relativePath,
        type,
        category,
        usageCount: usages.length,
        importedBy: usages,
        ...analysis
      });
    }
    
    // Sort by usage count (most used first)
    components.sort((a, b) => b.usageCount - a.usageCount);
    
    // Group by category
    const byCategory = components.reduce((acc, component) => {
      if (!acc[component.category]) {
        acc[component.category] = [];
      }
      acc[component.category].push(component);
      return acc;
    }, {} as Record<string, ComponentUsage[]>);
    
    // Calculate statistics
    const stats = {
      totalComponents: components.length,
      totalUsages: components.reduce((sum, c) => sum + c.usageCount, 0),
      averageUsage: Math.round(components.reduce((sum, c) => sum + c.usageCount, 0) / components.length),
      mostUsed: components[0],
      leastUsed: components[components.length - 1],
      unused: components.filter(c => c.usageCount === 0),
      categories: Object.keys(byCategory).length,
      primitiveCount: components.filter(c => c.type === 'primitive').length,
      compositeCount: components.filter(c => c.type === 'composite').length,
      utilityCount: components.filter(c => c.type === 'utility').length
    };
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      components,
      byCategory,
      recommendations: {
        consolidation: components.filter(c => c.usageCount < 3 && c.type === 'composite'),
        promotion: components.filter(c => c.usageCount > 20 && c.type === 'composite'),
        cleanup: components.filter(c => c.usageCount === 0)
      }
    });
    
  } catch (error) {
    console.error('[UI Analysis] Error:', error);
    
    return NextResponse.json({
      error: 'UI analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
