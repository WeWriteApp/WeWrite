#!/usr/bin/env node

/**
 * Import Path Configuration
 * 
 * Centralized configuration for import path standards, validation rules,
 * and automated fixing patterns used across the dependency management system.
 */

export const IMPORT_PATH_CONFIG = {
  // TypeScript path mappings
  pathMappings: {
    '@/components/*': ['./app/components/*'],
    '@/utils/*': ['./app/utils/*'],
    '@/hooks/*': ['./app/hooks/*'],
    '@/services/*': ['./app/services/*'],
    '@/firebase/*': ['./app/firebase/*'],
    '@/providers/*': ['./app/providers/*'],
    '@/types/*': ['./app/types/*'],
    '@/lib/*': ['./app/lib/*'],
    '@/constants/*': ['./app/constants/*'],
    '@/contexts/*': ['./app/contexts/*'],
    '@/styles/*': ['./app/styles/*']
  },

  // File extensions to process
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],

  // Directories to exclude from processing
  excludeDirectories: [
    'node_modules',
    '.next',
    '.git',
    'dist',
    'build',
    'functions/node_modules',
    'scripts/node_modules',
    '.vercel',
    'coverage'
  ],

  // Import ordering groups
  importGroups: [
    {
      name: 'builtin',
      pattern: /^(fs|path|crypto|http|https|url|querystring|stream|util|events|buffer|child_process|os|assert|cluster|dgram|dns|domain|net|punycode|readline|repl|string_decoder|tls|tty|vm|zlib)$/,
      order: 1
    },
    {
      name: 'external',
      pattern: /^[a-z@]/,
      order: 2
    },
    {
      name: 'internal-absolute',
      pattern: /^@\//,
      order: 3
    },
    {
      name: 'parent',
      pattern: /^\.\.\//,
      order: 4
    },
    {
      name: 'sibling',
      pattern: /^\.\//,
      order: 5
    },
    {
      name: 'index',
      pattern: /^\.$/,
      order: 6
    }
  ],

  // Rules for when to use absolute vs relative imports
  importRules: {
    // Use absolute imports when crossing these directory boundaries
    absoluteImportTriggers: [
      'components',
      'utils',
      'hooks',
      'services',
      'firebase',
      'providers',
      'types',
      'lib',
      'constants',
      'contexts'
    ],

    // Maximum depth for relative imports before suggesting absolute
    maxRelativeDepth: 2,

    // Always use relative imports for these patterns
    alwaysRelative: [
      /\.css$/,
      /\.scss$/,
      /\.module\.(css|scss)$/,
      /^\.\/[^/]+\.(js|jsx|ts|tsx)$/ // Same directory files
    ],

    // Always use absolute imports for these patterns
    alwaysAbsolute: [
      /^@\//,
      /components\/ui\//,
      /firebase\//,
      /services\//,
      /utils\//,
      /hooks\//
    ]
  },

  // Common import path fixes
  pathFixes: {
    // Map incorrect paths to correct ones
    corrections: {
      '../firebase/auth': '@/components/auth',
      '../../../firebase/config': '@/firebase/config',
      '../../hooks/useAuth': '@/hooks/useAuth',
      '../ui/select': '@/components/ui/select',
      '../providers/AuthProvider': '@/providers/AuthProvider',
      '../constants/analytics-events': '@/constants/analytics-events',
      '../../utils/ios-safari-fixes': '@/utils/ios-safari-fixes',
      '../utils/feeCalculations.js': '@/utils/feeCalculations.js',
      '../services/feeService.js': '@/services/feeService.js'
    },

    // Patterns for automatic path standardization
    standardizationPatterns: [
      {
        pattern: /^(\.\.\/){2,}(components|utils|hooks|services|firebase|providers|types|lib|constants|contexts)\//,
        replacement: '@/$2/'
      },
      {
        pattern: /^(\.\.\/){3,}/,
        replacement: '@/'
      }
    ]
  },

  // Validation rules
  validation: {
    // Required dependencies that should always be available
    requiredDependencies: [
      'react',
      'react-dom',
      'next',
      'typescript'
    ],

    // Dependencies that should not be used
    forbiddenDependencies: [
      'jquery',
      'lodash-es', // Use lodash instead
      'moment' // Use date-fns instead
    ],

    // Patterns for invalid import paths
    invalidPatterns: [
      /^[^@.].*\/\.\.\//,  // Relative imports in absolute-style paths
      /^@\/\.\.\//,        // Relative navigation in absolute paths
      /\/\.\//,            // Redundant current directory references
      /\/\/+/,             // Double slashes
      /\/$$/               // Trailing slashes
    ],

    // Maximum import statement length
    maxImportLength: 120,

    // Maximum number of named imports per statement
    maxNamedImports: 8
  },

  // Auto-fixing preferences
  autoFix: {
    // Enable automatic import path standardization
    standardizePaths: true,

    // Enable unused import removal
    removeUnusedImports: true,

    // Enable import statement organization
    organizeImports: true,

    // Enable path mapping conversion
    convertToAbsolute: true,

    // Preserve certain import styles
    preservePatterns: [
      /\.css$/,
      /\.scss$/,
      /\.json$/,
      /^node:/
    ]
  },

  // Performance settings
  performance: {
    // Maximum files to process in parallel
    maxConcurrency: 10,

    // Timeout for individual file processing (ms)
    fileTimeout: 5000,

    // Maximum file size to process (bytes)
    maxFileSize: 1024 * 1024, // 1MB

    // Cache validation results
    enableCache: true,

    // Cache duration (ms)
    cacheDuration: 5 * 60 * 1000 // 5 minutes
  },

  // Reporting settings
  reporting: {
    // Verbosity levels: 'silent', 'error', 'warn', 'info', 'debug'
    logLevel: 'info',

    // Generate detailed reports
    generateReports: true,

    // Report formats: 'console', 'json', 'html'
    reportFormats: ['console', 'json'],

    // Include performance metrics
    includeMetrics: true,

    // Group similar issues
    groupIssues: true
  },

  // Integration settings
  integration: {
    // ESLint integration
    eslint: {
      enabled: true,
      configPath: '.eslintrc.json',
      rules: {
        'import/no-unresolved': 'error',
        'import/no-cycle': 'error',
        'import/order': 'warn'
      }
    },

    // TypeScript integration
    typescript: {
      enabled: true,
      configPath: 'tsconfig.json',
      strictMode: true
    },

    // Prettier integration
    prettier: {
      enabled: true,
      configPath: '.prettierrc'
    }
  }
};

// Helper functions for working with the configuration
export const CONFIG_HELPERS = {
  /**
   * Check if a path should use absolute imports
   */
  shouldUseAbsolute(importPath, fromFile) {
    const config = IMPORT_PATH_CONFIG;
    
    // Check always absolute patterns
    if (config.importRules.alwaysAbsolute.some(pattern => pattern.test(importPath))) {
      return true;
    }
    
    // Check always relative patterns
    if (config.importRules.alwaysRelative.some(pattern => pattern.test(importPath))) {
      return false;
    }
    
    // Check depth
    const depth = (importPath.match(/\.\.\//g) || []).length;
    return depth > config.importRules.maxRelativeDepth;
  },

  /**
   * Get the appropriate import group for a path
   */
  getImportGroup(importPath) {
    const groups = IMPORT_PATH_CONFIG.importGroups;
    
    for (const group of groups) {
      if (group.pattern.test(importPath)) {
        return group;
      }
    }
    
    return groups.find(g => g.name === 'external');
  },

  /**
   * Check if a dependency is forbidden
   */
  isForbiddenDependency(packageName) {
    return IMPORT_PATH_CONFIG.validation.forbiddenDependencies.includes(packageName);
  },

  /**
   * Check if an import path is valid
   */
  isValidImportPath(importPath) {
    const patterns = IMPORT_PATH_CONFIG.validation.invalidPatterns;
    return !patterns.some(pattern => pattern.test(importPath));
  },

  /**
   * Get standardized path for an import
   */
  getStandardizedPath(importPath) {
    const patterns = IMPORT_PATH_CONFIG.pathFixes.standardizationPatterns;
    
    for (const { pattern, replacement } of patterns) {
      if (pattern.test(importPath)) {
        return importPath.replace(pattern, replacement);
      }
    }
    
    return importPath;
  },

  /**
   * Check if a file should be processed
   */
  shouldProcessFile(filePath) {
    const config = IMPORT_PATH_CONFIG;
    
    // Check extension
    const hasValidExtension = config.fileExtensions.some(ext => 
      filePath.endsWith(ext)
    );
    
    if (!hasValidExtension) return false;
    
    // Check excluded directories
    const isExcluded = config.excludeDirectories.some(dir => 
      filePath.includes(dir)
    );
    
    return !isExcluded;
  }
};

export default IMPORT_PATH_CONFIG;
