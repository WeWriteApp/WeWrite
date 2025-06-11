/**
 * Custom ESLint Rules for Layout Validation
 * 
 * These rules help prevent layout regressions by detecting deprecated
 * layout patterns and enforcing modern layout usage.
 */

module.exports = {
  rules: {
    'no-deprecated-dashboard-layout': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow usage of deprecated DashboardLayout component',
          category: 'Layout',
          recommended: true
        },
        fixable: 'code',
        schema: []
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            // Check for DashboardLayout imports
            if (node.source.value.includes('DashboardLayout')) {
              context.report({
                node,
                message: 'DashboardLayout is deprecated. Remove this import and use the modern layout structure in ClientLayout.js instead.',
                fix(fixer) {
                  return fixer.remove(node);
                }
              });
            }
          },
          
          JSXElement(node) {
            // Check for DashboardLayout JSX usage
            if (node.openingElement.name.name === 'DashboardLayout') {
              context.report({
                node,
                message: 'DashboardLayout component is deprecated. Remove this wrapper and return content directly. The modern layout is handled by ClientLayout.js automatically.',
                fix(fixer) {
                  // Remove opening and closing tags, keep children
                  const sourceCode = context.getSourceCode();
                  const openingTag = node.openingElement;
                  const closingTag = node.closingElement;
                  
                  if (closingTag) {
                    return [
                      fixer.remove(openingTag),
                      fixer.remove(closingTag)
                    ];
                  }
                  return fixer.remove(openingTag);
                }
              });
            }
          }
        };
      }
    },
    
    'enforce-modern-layout': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce usage of modern layout patterns',
          category: 'Layout',
          recommended: true
        },
        schema: []
      },
      create(context) {
        return {
          Program(node) {
            const sourceCode = context.getSourceCode();
            const text = sourceCode.getText();
            
            // Check for patterns that suggest old layout usage
            const deprecatedPatterns = [
              'const Layout = user ? DashboardLayout',
              'Layout = DashboardLayout',
              'return (<DashboardLayout>'
            ];
            
            deprecatedPatterns.forEach(pattern => {
              if (text.includes(pattern)) {
                context.report({
                  node,
                  message: `Deprecated layout pattern detected: "${pattern}". Use React.Fragment for authenticated users instead of DashboardLayout.`
                });
              }
            });
          }
        };
      }
    }
  }
};

/**
 * ESLint configuration for layout validation
 */
module.exports.config = {
  plugins: ['layout-validation'],
  rules: {
    'layout-validation/no-deprecated-dashboard-layout': 'error',
    'layout-validation/enforce-modern-layout': 'warn'
  }
};

/**
 * Instructions for integrating these rules:
 * 
 * 1. Add to .eslintrc.js:
 * ```javascript
 * module.exports = {
 *   // ... existing config
 *   plugins: ['layout-validation'],
 *   rules: {
 *     'layout-validation/no-deprecated-dashboard-layout': 'error',
 *     'layout-validation/enforce-modern-layout': 'warn'
 *   }
 * };
 * ```
 * 
 * 2. Or create a custom script to check for deprecated patterns:
 * ```bash
 * grep -r "DashboardLayout" app/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
 * ```
 */
