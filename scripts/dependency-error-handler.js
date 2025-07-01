#!/usr/bin/env node

/**
 * Dependency Error Handler
 * 
 * Provides clear, actionable error messages for dependency issues
 * with specific solutions and automated fix suggestions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DependencyErrorHandler {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.errorPatterns = this.initializeErrorPatterns();
  }

  initializeErrorPatterns() {
    return [
      {
        pattern: /Cannot resolve module ['"`]([^'"`]+)['"`]/,
        type: 'MODULE_NOT_FOUND',
        handler: this.handleModuleNotFound.bind(this)
      },
      {
        pattern: /Module not found: Error: Can't resolve ['"`]([^'"`]+)['"`]/,
        type: 'WEBPACK_MODULE_NOT_FOUND',
        handler: this.handleWebpackModuleNotFound.bind(this)
      },
      {
        pattern: /Cannot find module ['"`]([^'"`]+)['"`]/,
        type: 'NODE_MODULE_NOT_FOUND',
        handler: this.handleNodeModuleNotFound.bind(this)
      },
      {
        pattern: /Dependency cycle detected/,
        type: 'CIRCULAR_DEPENDENCY',
        handler: this.handleCircularDependency.bind(this)
      },
      {
        pattern: /TypeScript error.*Cannot find module ['"`]([^'"`]+)['"`]/,
        type: 'TYPESCRIPT_MODULE_NOT_FOUND',
        handler: this.handleTypeScriptModuleNotFound.bind(this)
      },
      {
        pattern: /ESLint.*import\/no-unresolved/,
        type: 'ESLINT_IMPORT_UNRESOLVED',
        handler: this.handleESLintImportUnresolved.bind(this)
      },
      {
        pattern: /npm ERR! peer dep missing/,
        type: 'PEER_DEPENDENCY_MISSING',
        handler: this.handlePeerDependencyMissing.bind(this)
      },
      {
        pattern: /npm ERR! ERESOLVE unable to resolve dependency tree/,
        type: 'DEPENDENCY_CONFLICT',
        handler: this.handleDependencyConflict.bind(this)
      }
    ];
  }

  analyzeError(errorMessage, context = {}) {
    const analysis = {
      type: 'UNKNOWN',
      severity: 'medium',
      message: errorMessage,
      solutions: [],
      autoFixAvailable: false,
      context
    };

    // Find matching error pattern
    for (const pattern of this.errorPatterns) {
      const match = errorMessage.match(pattern.pattern);
      if (match) {
        return pattern.handler(match, analysis);
      }
    }

    // Generic error handling
    return this.handleGenericError(analysis);
  }

  handleModuleNotFound(match, analysis) {
    const moduleName = match[1];
    
    analysis.type = 'MODULE_NOT_FOUND';
    analysis.severity = 'high';
    analysis.module = moduleName;
    
    if (this.isRelativeImport(moduleName)) {
      analysis.solutions = [
        {
          title: 'Fix Relative Import Path',
          description: `The relative import "${moduleName}" cannot be resolved.`,
          actions: [
            'Check if the file exists at the specified path',
            'Verify the file extension is correct',
            'Consider using absolute imports with @/ prefix',
            'Run: npm run deps:fix to automatically fix import paths'
          ],
          autoFix: 'npm run deps:fix',
          priority: 'high'
        }
      ];
      analysis.autoFixAvailable = true;
    } else if (this.isAbsoluteImport(moduleName)) {
      analysis.solutions = [
        {
          title: 'Fix Absolute Import Path',
          description: `The absolute import "${moduleName}" cannot be resolved.`,
          actions: [
            'Check TypeScript path mappings in tsconfig.json',
            'Verify the file exists in the mapped directory',
            'Run: npm run deps:validate to check all imports'
          ],
          autoFix: 'npm run deps:validate',
          priority: 'high'
        }
      ];
      analysis.autoFixAvailable = true;
    } else {
      analysis.solutions = [
        {
          title: 'Install Missing Package',
          description: `The package "${moduleName}" is not installed.`,
          actions: [
            `Install the package: npm install ${moduleName}`,
            'Check if the package name is correct',
            'Verify the package exists on npm registry'
          ],
          autoFix: `npm install ${moduleName}`,
          priority: 'high'
        }
      ];
      analysis.autoFixAvailable = true;
    }

    return analysis;
  }

  handleWebpackModuleNotFound(match, analysis) {
    const moduleName = match[1];
    
    analysis.type = 'WEBPACK_MODULE_NOT_FOUND';
    analysis.severity = 'high';
    analysis.module = moduleName;
    
    analysis.solutions = [
      {
        title: 'Resolve Webpack Module',
        description: `Webpack cannot resolve "${moduleName}".`,
        actions: [
          'Check if the module is installed: npm list ' + moduleName,
          'Verify import path is correct',
          'Check webpack configuration for path mappings',
          'Run: npm run deps:heal to auto-fix dependency issues'
        ],
        autoFix: 'npm run deps:heal',
        priority: 'high'
      }
    ];
    analysis.autoFixAvailable = true;

    return analysis;
  }

  handleNodeModuleNotFound(match, analysis) {
    const moduleName = match[1];
    
    analysis.type = 'NODE_MODULE_NOT_FOUND';
    analysis.severity = 'high';
    analysis.module = moduleName;
    
    analysis.solutions = [
      {
        title: 'Install Node Module',
        description: `Node.js cannot find module "${moduleName}".`,
        actions: [
          `Install the module: npm install ${moduleName}`,
          'Check if node_modules directory exists',
          'Try: npm install to reinstall all dependencies',
          'Clear npm cache: npm cache clean --force'
        ],
        autoFix: `npm install ${moduleName}`,
        priority: 'high'
      }
    ];
    analysis.autoFixAvailable = true;

    return analysis;
  }

  handleCircularDependency(match, analysis) {
    analysis.type = 'CIRCULAR_DEPENDENCY';
    analysis.severity = 'medium';
    
    analysis.solutions = [
      {
        title: 'Resolve Circular Dependency',
        description: 'Circular dependencies can cause runtime issues and should be resolved.',
        actions: [
          'Run: npm run deps:check to identify all circular dependencies',
          'Refactor code to break the circular reference',
          'Extract shared logic to a separate module',
          'Use dependency injection patterns',
          'Consider using React.lazy() for component dependencies'
        ],
        autoFix: 'npm run deps:check',
        priority: 'medium'
      }
    ];
    analysis.autoFixAvailable = false;

    return analysis;
  }

  handleTypeScriptModuleNotFound(match, analysis) {
    const moduleName = match[1];
    
    analysis.type = 'TYPESCRIPT_MODULE_NOT_FOUND';
    analysis.severity = 'high';
    analysis.module = moduleName;
    
    analysis.solutions = [
      {
        title: 'Fix TypeScript Module Resolution',
        description: `TypeScript cannot find module "${moduleName}".`,
        actions: [
          'Check tsconfig.json path mappings',
          'Install type definitions: npm install --save-dev @types/' + moduleName.replace('@', '').replace('/', '__'),
          'Verify module exists and is properly exported',
          'Run: npx tsc --noEmit to check all TypeScript errors'
        ],
        autoFix: 'npx tsc --noEmit',
        priority: 'high'
      }
    ];
    analysis.autoFixAvailable = false;

    return analysis;
  }

  handleESLintImportUnresolved(match, analysis) {
    analysis.type = 'ESLINT_IMPORT_UNRESOLVED';
    analysis.severity = 'medium';
    
    analysis.solutions = [
      {
        title: 'Fix ESLint Import Resolution',
        description: 'ESLint cannot resolve import paths.',
        actions: [
          'Check ESLint import resolver configuration',
          'Verify TypeScript path mappings',
          'Run: npm run lint --fix to auto-fix ESLint issues',
          'Update eslint-import-resolver-typescript if needed'
        ],
        autoFix: 'npm run lint --fix',
        priority: 'medium'
      }
    ];
    analysis.autoFixAvailable = true;

    return analysis;
  }

  handlePeerDependencyMissing(match, analysis) {
    analysis.type = 'PEER_DEPENDENCY_MISSING';
    analysis.severity = 'medium';
    
    analysis.solutions = [
      {
        title: 'Install Peer Dependencies',
        description: 'Required peer dependencies are missing.',
        actions: [
          'Check npm warnings for specific peer dependencies',
          'Install missing peer dependencies manually',
          'Run: npm install --save-peer to install all peer deps',
          'Use: npx install-peerdeps <package> for automatic installation'
        ],
        autoFix: 'npm install --save-peer',
        priority: 'medium'
      }
    ];
    analysis.autoFixAvailable = false;

    return analysis;
  }

  handleDependencyConflict(match, analysis) {
    analysis.type = 'DEPENDENCY_CONFLICT';
    analysis.severity = 'high';
    
    analysis.solutions = [
      {
        title: 'Resolve Dependency Conflicts',
        description: 'Conflicting dependency versions detected.',
        actions: [
          'Check npm error output for specific conflicts',
          'Update conflicting packages to compatible versions',
          'Use npm overrides in package.json if necessary',
          'Try: npm install --legacy-peer-deps as temporary fix',
          'Run: npm run deps:update to update dependencies safely'
        ],
        autoFix: 'npm run deps:update',
        priority: 'high'
      }
    ];
    analysis.autoFixAvailable = true;

    return analysis;
  }

  handleGenericError(analysis) {
    analysis.solutions = [
      {
        title: 'General Dependency Troubleshooting',
        description: 'Run comprehensive dependency health checks.',
        actions: [
          'Run: npm run deps:health for complete analysis',
          'Check: npm run deps:validate for import issues',
          'Try: npm run deps:heal for automatic fixes',
          'Review: npm run deps:dashboard for visual overview'
        ],
        autoFix: 'npm run deps:health',
        priority: 'low'
      }
    ];
    analysis.autoFixAvailable = true;

    return analysis;
  }

  isRelativeImport(moduleName) {
    return moduleName.startsWith('./') || moduleName.startsWith('../');
  }

  isAbsoluteImport(moduleName) {
    return moduleName.startsWith('@/');
  }

  formatErrorMessage(analysis) {
    let message = `\n🚨 DEPENDENCY ERROR: ${analysis.type}\n`;
    message += '='.repeat(60) + '\n\n';
    
    message += `📋 Error: ${analysis.message}\n`;
    if (analysis.module) {
      message += `📦 Module: ${analysis.module}\n`;
    }
    message += `⚠️  Severity: ${analysis.severity.toUpperCase()}\n\n`;
    
    analysis.solutions.forEach((solution, index) => {
      message += `💡 Solution ${index + 1}: ${solution.title}\n`;
      message += `   ${solution.description}\n\n`;
      
      message += '   📝 Actions to take:\n';
      solution.actions.forEach(action => {
        message += `      • ${action}\n`;
      });
      
      if (solution.autoFix) {
        message += `\n   🔧 Quick fix: ${solution.autoFix}\n`;
      }
      
      message += '\n';
    });
    
    if (analysis.autoFixAvailable) {
      message += '🤖 Automated fixes are available for this error.\n';
    }
    
    message += '='.repeat(60) + '\n';
    
    return message;
  }

  logError(errorMessage, context = {}) {
    const analysis = this.analyzeError(errorMessage, context);
    const formattedMessage = this.formatErrorMessage(analysis);
    
    console.error(formattedMessage);
    
    // Save error log
    this.saveErrorLog(analysis);
    
    return analysis;
  }

  saveErrorLog(analysis) {
    const logPath = path.join(this.projectRoot, 'dependency-errors.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: analysis.type,
      severity: analysis.severity,
      message: analysis.message,
      module: analysis.module,
      solutions: analysis.solutions.map(s => s.title),
      autoFixAvailable: analysis.autoFixAvailable
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(logPath, logLine);
    } catch (error) {
      // Ignore logging errors
    }
  }
}

// Export for use in other scripts
export default DependencyErrorHandler;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const errorHandler = new DependencyErrorHandler();
  const errorMessage = process.argv[2];
  
  if (!errorMessage) {
    console.log('Usage: node dependency-error-handler.js "error message"');
    process.exit(1);
  }
  
  errorHandler.logError(errorMessage);
}
