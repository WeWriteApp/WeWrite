#!/usr/bin/env node

/**
 * Bundle Analysis Script for WeWrite Performance Optimization
 * 
 * This script analyzes the Next.js build output to identify:
 * - Large bundles that impact initial load
 * - Opportunities for code splitting
 * - Unused dependencies
 * - Performance optimization recommendations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.join(path.dirname(__dirname), '.next');
const STATIC_DIR = path.join(BUILD_DIR, 'static');
const CHUNKS_DIR = path.join(STATIC_DIR, 'chunks');

// Performance thresholds (in bytes)
const THRESHOLDS = {
  CRITICAL_CHUNK: 50 * 1024,      // 50KB - critical for first load
  LARGE_CHUNK: 100 * 1024,       // 100KB - should be code split
  HUGE_CHUNK: 250 * 1024,        // 250KB - definitely needs optimization
  TOTAL_JS_BUDGET: 500 * 1024,   // 500KB - total JS budget for good performance
};

// Known heavy dependencies that should be code split
const HEAVY_DEPENDENCIES = [
  'firebase',
  '@firebase',
  'react-icons',
  '@mui',
  '@radix-ui',
  'framer-motion',
  'recharts',
  'mapbox-gl',
  'stripe',
  'lexical',
  '@lexical',
];

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeChunks() {
  console.log('🔍 Analyzing bundle chunks...\n');
  
  if (!fs.existsSync(CHUNKS_DIR)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }
  
  const chunks = [];
  const files = fs.readdirSync(CHUNKS_DIR);
  
  files.forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(CHUNKS_DIR, file);
      const stats = fs.statSync(filePath);
      
      chunks.push({
        name: file,
        size: stats.size,
        path: filePath,
      });
    }
  });
  
  // Sort by size (largest first)
  chunks.sort((a, b) => b.size - a.size);
  
  return chunks;
}

function analyzeMainBundle() {
  console.log('📊 Main Bundle Analysis\n');
  
  const chunks = analyzeChunks();
  let totalSize = 0;
  let criticalSize = 0;
  
  chunks.forEach(chunk => {
    totalSize += chunk.size;
    
    // Identify critical chunks (likely loaded on first page load)
    if (chunk.name.includes('main') || chunk.name.includes('framework') || chunk.name.includes('webpack')) {
      criticalSize += chunk.size;
    }
    
    let status = '✅';
    let recommendation = '';
    
    if (chunk.size > THRESHOLDS.HUGE_CHUNK) {
      status = '🚨';
      recommendation = ' - URGENT: Split this chunk';
    } else if (chunk.size > THRESHOLDS.LARGE_CHUNK) {
      status = '⚠️';
      recommendation = ' - Consider code splitting';
    } else if (chunk.size > THRESHOLDS.CRITICAL_CHUNK) {
      status = '💡';
      recommendation = ' - Monitor size growth';
    }
    
    console.log(`${status} ${chunk.name}: ${formatBytes(chunk.size)}${recommendation}`);
  });
  
  console.log(`\n📈 Total JavaScript: ${formatBytes(totalSize)}`);
  console.log(`🎯 Critical Path JS: ${formatBytes(criticalSize)}`);
  
  if (totalSize > THRESHOLDS.TOTAL_JS_BUDGET) {
    console.log(`🚨 PERFORMANCE ALERT: Total JS exceeds ${formatBytes(THRESHOLDS.TOTAL_JS_BUDGET)} budget!`);
  }
  
  return { chunks, totalSize, criticalSize };
}

function identifyHeavyDependencies(chunks) {
  console.log('\n🏋️ Heavy Dependencies Analysis\n');
  
  const heavyChunks = chunks.filter(chunk => chunk.size > THRESHOLDS.LARGE_CHUNK);
  
  heavyChunks.forEach(chunk => {
    console.log(`\n📦 Analyzing ${chunk.name} (${formatBytes(chunk.size)}):`);
    
    // Try to read the chunk content to identify dependencies
    try {
      const content = fs.readFileSync(chunk.path, 'utf8');
      
      HEAVY_DEPENDENCIES.forEach(dep => {
        if (content.includes(dep)) {
          console.log(`  - Contains: ${dep}`);
        }
      });
      
      // Look for common patterns that indicate specific libraries
      if (content.includes('firebase')) {
        console.log('  💡 Recommendation: Consider lazy loading Firebase features');
      }
      if (content.includes('react-icons')) {
        console.log('  💡 Recommendation: Use tree-shaking for react-icons');
      }
      if (content.includes('@mui') || content.includes('@radix-ui')) {
        console.log('  💡 Recommendation: Import UI components individually');
      }
      
    } catch (error) {
      console.log('  ❌ Could not analyze chunk content');
    }
  });
}

function generateOptimizationRecommendations(analysis) {
  console.log('\n🚀 Performance Optimization Recommendations\n');
  
  const { totalSize, criticalSize } = analysis;
  
  // Critical path optimization
  if (criticalSize > 200 * 1024) { // 200KB threshold
    console.log('🎯 Critical Path Optimizations:');
    console.log('  - Implement route-based code splitting');
    console.log('  - Move non-critical features to dynamic imports');
    console.log('  - Consider server-side rendering for above-the-fold content');
    console.log('');
  }
  
  // Bundle size optimization
  if (totalSize > THRESHOLDS.TOTAL_JS_BUDGET) {
    console.log('📦 Bundle Size Optimizations:');
    console.log('  - Enable tree shaking for all dependencies');
    console.log('  - Use dynamic imports for heavy features');
    console.log('  - Consider alternative lighter libraries');
    console.log('  - Implement progressive loading');
    console.log('');
  }
  
  // Specific recommendations
  console.log('🔧 Specific Optimizations:');
  console.log('  - Use next/dynamic for non-critical components');
  console.log('  - Implement intersection observer for lazy loading');
  console.log('  - Split vendor chunks by usage frequency');
  console.log('  - Use webpack-bundle-analyzer for detailed analysis');
  console.log('  - Consider using SWC for faster builds');
  console.log('');
  
  // Network-specific recommendations
  console.log('🌐 Network Optimization:');
  console.log('  - Implement service worker caching');
  console.log('  - Use resource hints (preload, prefetch)');
  console.log('  - Enable compression (gzip/brotli)');
  console.log('  - Optimize images with next/image');
  console.log('  - Implement progressive enhancement');
}

function generateBundleReport(analysis) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSize: analysis.totalSize,
      criticalSize: analysis.criticalSize,
      chunkCount: analysis.chunks.length,
      performanceGrade: getPerformanceGrade(analysis.totalSize),
    },
    chunks: analysis.chunks.map(chunk => ({
      name: chunk.name,
      size: chunk.size,
      sizeFormatted: formatBytes(chunk.size),
      category: categorizeChunk(chunk),
    })),
    recommendations: generateRecommendationsList(analysis),
  };
  
  const reportPath = path.join(path.dirname(__dirname), 'bundle-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

function getPerformanceGrade(totalSize) {
  if (totalSize < 300 * 1024) return 'A';
  if (totalSize < 500 * 1024) return 'B';
  if (totalSize < 750 * 1024) return 'C';
  if (totalSize < 1000 * 1024) return 'D';
  return 'F';
}

function categorizeChunk(chunk) {
  if (chunk.name.includes('main')) return 'main';
  if (chunk.name.includes('framework')) return 'framework';
  if (chunk.name.includes('vendor')) return 'vendor';
  if (chunk.name.includes('webpack')) return 'runtime';
  return 'page';
}

function generateRecommendationsList(analysis) {
  const recommendations = [];
  
  if (analysis.criticalSize > 200 * 1024) {
    recommendations.push('Reduce critical path JavaScript');
  }
  
  if (analysis.totalSize > THRESHOLDS.TOTAL_JS_BUDGET) {
    recommendations.push('Implement aggressive code splitting');
  }
  
  const largeChunks = analysis.chunks.filter(c => c.size > THRESHOLDS.LARGE_CHUNK);
  if (largeChunks.length > 0) {
    recommendations.push(`Split ${largeChunks.length} large chunks`);
  }
  
  return recommendations;
}

// Main execution
function main() {
  console.log('🎯 WeWrite Bundle Analysis Tool\n');
  console.log('Analyzing build output for performance optimization opportunities...\n');
  
  const analysis = analyzeMainBundle();
  identifyHeavyDependencies(analysis.chunks);
  generateOptimizationRecommendations(analysis);
  generateBundleReport(analysis);
  
  console.log('\n✅ Analysis complete!');
  console.log('\nNext steps:');
  console.log('1. Review the recommendations above');
  console.log('2. Check the detailed JSON report');
  console.log('3. Run "npx webpack-bundle-analyzer .next/static/chunks/*.js" for visual analysis');
  console.log('4. Implement optimizations and re-run this analysis');
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  analyzeChunks,
  analyzeMainBundle,
  identifyHeavyDependencies,
  generateOptimizationRecommendations,
};
