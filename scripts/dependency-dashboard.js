#!/usr/bin/env node

/**
 * Dependency Dashboard Generator
 * 
 * Creates an interactive HTML dashboard for dependency health monitoring
 * with real-time metrics, visualizations, and actionable insights.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DependencyDashboard {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.outputPath = path.join(this.projectRoot, 'dependency-dashboard.html');
    this.data = {
      timestamp: new Date().toISOString(),
      stats: {},
      issues: {},
      trends: [],
      recommendations: []
    };
  }

  async run() {
    console.log('📊 Generating dependency dashboard...');
    
    // Collect data
    await this.collectData();
    
    // Generate HTML dashboard
    await this.generateDashboard();
    
    console.log(`✅ Dashboard generated: ${this.outputPath}`);
    console.log(`🌐 Open in browser: file://${this.outputPath}`);
  }

  async collectData() {
    console.log('📈 Collecting dependency data...');
    
    // Load existing reports if available
    await this.loadExistingReports();
    
    // Collect package.json data
    await this.collectPackageData();
    
    // Collect project statistics
    await this.collectProjectStats();
    
    // Generate recommendations
    await this.generateRecommendations();
  }

  async loadExistingReports() {
    try {
      const reportPath = path.join(this.projectRoot, 'dependency-report.json');
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        this.data.stats = report.stats || {};
        this.data.issues = {
          circular: report.circularDependencies || [],
          critical: report.criticalPaths || []
        };
      }
    } catch (error) {
      console.warn('Could not load existing reports:', error.message);
    }
  }

  async collectPackageData() {
    const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    
    this.data.packages = {
      dependencies: Object.keys(packageJson.dependencies || {}).length,
      devDependencies: Object.keys(packageJson.devDependencies || {}).length,
      total: Object.keys({...packageJson.dependencies, ...packageJson.devDependencies}).length
    };
  }

  async collectProjectStats() {
    // Count files by type
    const extensions = ['.js', '.jsx', '.ts', '.tsx'];
    let fileCount = 0;
    
    const countFiles = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = path.relative(this.projectRoot, fullPath);
          
          if (relativePath.startsWith('node_modules') || relativePath.startsWith('.git')) {
            continue;
          }
          
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            countFiles(fullPath);
          } else if (extensions.some(ext => item.endsWith(ext))) {
            fileCount++;
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };
    
    countFiles(this.projectRoot);
    
    this.data.project = {
      files: fileCount,
      lastUpdated: this.data.timestamp
    };
  }

  async generateRecommendations() {
    const recommendations = [];
    
    // Circular dependency recommendations
    if (this.data.issues.circular && this.data.issues.circular.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Circular Dependencies Detected',
        description: `Found ${this.data.issues.circular.length} circular dependencies that should be resolved.`,
        action: 'Review and refactor circular imports to improve maintainability.',
        priority: 'high'
      });
    }
    
    // Large dependency count
    if (this.data.packages && this.data.packages.total > 100) {
      recommendations.push({
        type: 'info',
        title: 'Large Dependency Count',
        description: `Project has ${this.data.packages.total} dependencies.`,
        action: 'Consider auditing for unused dependencies to reduce bundle size.',
        priority: 'medium'
      });
    }
    
    // Health check recommendation
    recommendations.push({
      type: 'success',
      title: 'Regular Health Checks',
      description: 'Run dependency health checks regularly.',
      action: 'Schedule weekly runs of `npm run deps:audit`.',
      priority: 'low'
    });
    
    this.data.recommendations = recommendations;
  }

  async generateDashboard() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WeWrite - Dependency Health Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .header h1 { 
            color: #1e293b;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .header .subtitle { 
            color: #64748b;
            font-size: 1.1rem;
        }
        .grid { 
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card { 
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .card h3 { 
            color: #1e293b;
            margin-bottom: 15px;
            font-size: 1.3rem;
        }
        .metric { 
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .metric:last-child { border-bottom: none; }
        .metric-value { 
            font-weight: 600;
            font-size: 1.2rem;
        }
        .status-good { color: #059669; }
        .status-warning { color: #d97706; }
        .status-error { color: #dc2626; }
        .recommendation { 
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid;
        }
        .recommendation.success { 
            background: #f0fdf4;
            border-color: #22c55e;
        }
        .recommendation.warning { 
            background: #fffbeb;
            border-color: #f59e0b;
        }
        .recommendation.error { 
            background: #fef2f2;
            border-color: #ef4444;
        }
        .recommendation h4 { margin-bottom: 8px; }
        .recommendation p { 
            color: #6b7280;
            margin-bottom: 8px;
        }
        .recommendation .action { 
            font-weight: 500;
            color: #374151;
        }
        .timestamp { 
            color: #9ca3af;
            font-size: 0.9rem;
            text-align: center;
            margin-top: 30px;
        }
        .circular-deps { 
            max-height: 300px;
            overflow-y: auto;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .circular-dep { 
            font-family: monospace;
            font-size: 0.9rem;
            padding: 8px;
            background: white;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid #ef4444;
        }
        .commands { 
            background: #1e293b;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .commands h4 { 
            margin-bottom: 15px;
            color: #f1f5f9;
        }
        .command { 
            font-family: monospace;
            background: #334155;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .command:hover { background: #475569; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Dependency Health Dashboard</h1>
            <p class="subtitle">Real-time monitoring and insights for WeWrite project dependencies</p>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📊 Project Overview</h3>
                <div class="metric">
                    <span>Total Files</span>
                    <span class="metric-value">${this.data.project?.files || 0}</span>
                </div>
                <div class="metric">
                    <span>Dependencies</span>
                    <span class="metric-value">${this.data.packages?.dependencies || 0}</span>
                </div>
                <div class="metric">
                    <span>Dev Dependencies</span>
                    <span class="metric-value">${this.data.packages?.devDependencies || 0}</span>
                </div>
                <div class="metric">
                    <span>Total Packages</span>
                    <span class="metric-value">${this.data.packages?.total || 0}</span>
                </div>
            </div>

            <div class="card">
                <h3>🎯 Health Metrics</h3>
                <div class="metric">
                    <span>Circular Dependencies</span>
                    <span class="metric-value ${(this.data.issues?.circular?.length || 0) === 0 ? 'status-good' : 'status-error'}">
                        ${this.data.issues?.circular?.length || 0}
                    </span>
                </div>
                <div class="metric">
                    <span>Critical Paths</span>
                    <span class="metric-value">${this.data.issues?.critical?.length || 0}</span>
                </div>
                <div class="metric">
                    <span>Health Score</span>
                    <span class="metric-value ${this.getHealthScore() >= 80 ? 'status-good' : this.getHealthScore() >= 60 ? 'status-warning' : 'status-error'}">
                        ${this.getHealthScore()}%
                    </span>
                </div>
            </div>
        </div>

        ${this.data.issues?.circular?.length > 0 ? `
        <div class="card">
            <h3>🔄 Circular Dependencies</h3>
            <p>These circular dependencies should be resolved to improve code maintainability:</p>
            <div class="circular-deps">
                ${this.data.issues.circular.slice(0, 10).map(cycle => 
                    `<div class="circular-dep">${Array.isArray(cycle) ? cycle.join(' → ') : cycle}</div>`
                ).join('')}
                ${this.data.issues.circular.length > 10 ? `<div class="circular-dep">... and ${this.data.issues.circular.length - 10} more</div>` : ''}
            </div>
        </div>
        ` : ''}

        <div class="card">
            <h3>💡 Recommendations</h3>
            ${this.data.recommendations.map(rec => `
                <div class="recommendation ${rec.type}">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                    <div class="action">${rec.action}</div>
                </div>
            `).join('')}
        </div>

        <div class="card">
            <h3>🛠️ Quick Actions</h3>
            <p>Run these commands to maintain dependency health:</p>
            <div class="commands">
                <h4>Available Commands</h4>
                <div class="command" onclick="copyToClipboard('npm run deps:audit')">npm run deps:audit</div>
                <div class="command" onclick="copyToClipboard('npm run deps:heal')">npm run deps:heal</div>
                <div class="command" onclick="copyToClipboard('npm run deps:fix')">npm run deps:fix</div>
                <div class="command" onclick="copyToClipboard('npm run deps:validate')">npm run deps:validate</div>
            </div>
        </div>

        <div class="timestamp">
            Last updated: ${new Date(this.data.timestamp).toLocaleString()}
        </div>
    </div>

    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                // Visual feedback
                event.target.style.background = '#22c55e';
                setTimeout(() => {
                    event.target.style.background = '#334155';
                }, 1000);
            });
        }

        // Auto-refresh every 5 minutes
        setTimeout(() => {
            location.reload();
        }, 300000);
    </script>
</body>
</html>`;

    fs.writeFileSync(this.outputPath, html);
  }

  getHealthScore() {
    let score = 100;
    
    // Deduct points for issues
    if (this.data.issues?.circular) {
      score -= Math.min(this.data.issues.circular.length * 10, 50);
    }
    
    // Deduct points for large dependency count
    if (this.data.packages?.total > 150) {
      score -= 20;
    } else if (this.data.packages?.total > 100) {
      score -= 10;
    }
    
    return Math.max(score, 0);
  }
}

// Run the dashboard generator
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new DependencyDashboard();
  dashboard.run().catch(error => {
    console.error('Error generating dashboard:', error);
    process.exit(1);
  });
}

export default DependencyDashboard;
