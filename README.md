# WeWrite

**A social wiki where every page you write is a fundraiser.**

WeWrite transforms knowledge sharing into a collaborative economy where writers earn direct USD payments from their contributions and readers support creators with transparent monthly funding.

## 🌐 Connect With Us

- **🔗 [Bento](https://bento.me/wewrite)** - All our links in one place
- **📸 [Instagram](https://www.instagram.com/getwewrite/)** - Behind the scenes and updates
- **🎥 [YouTube](https://www.youtube.com/@WeWriteApp)** - Tutorials and feature demos
- **🐦 [Twitter](https://twitter.com/getwewrite)** - Real-time updates and community
- **💬 [Discord](https://discord.gg/wewrite)** - Join our community discussions

## ✨ What Makes WeWrite Special

- **📝 Collaborative Writing** - Create and edit pages together
- **💰 Direct USD Payments** - Support creators with transparent monthly funding
- **🔗 Smart Linking** - Connect ideas across the platform
- **🌙 Beautiful Interface** - Clean, modern design with dark mode
- **🔒 Secure & Private** - Your data is protected and encrypted

## 🚀 Quick Start

WeWrite is built with [Next.js](https://nextjs.org/) and uses modern web technologies for optimal performance.

### Prerequisites

- **Node.js** 18+
- **pnpm** (preferred package manager)

### Installation

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Clone the repository
git clone https://github.com/WeWriteApp/WeWrite.git
cd WeWrite

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see WeWrite in action! 🎉

## 📚 Documentation

### 🎯 Essential Documentation (Start Here)

#### Core System Understanding
- **[Current Architecture](docs/CURRENT_ARCHITECTURE.md)** - ⭐ **ESSENTIAL** - Complete system overview and architecture principles
- **[Payment System Guide](docs/PAYMENT_SYSTEM_GUIDE.md)** - ⭐ **ESSENTIAL** - Complete USD payment system documentation
- **[Performance Optimization Guide](docs/PERFORMANCE_OPTIMIZATION_GUIDE.md)** - ⭐ **ESSENTIAL** - Optimization strategies (90% cost reduction achieved)
- **[Design System](docs/design-system.md)** - ⭐ **ESSENTIAL** - FloatingCard component system and glassmorphism guidelines
- **[OKLCH Color System](docs/color-system-oklch.md)** - ⭐ **ESSENTIAL** - Modern OKLCH color space for better accessibility and perceptual uniformity

#### Quick Start Guides
- **[Environment Quick Reference](docs/ENVIRONMENT_QUICK_REFERENCE.md)** - Development environment setup
- **[Subscription Quick Reference](docs/SUBSCRIPTION_QUICK_REFERENCE.md)** - Subscription system overview
- **[Stripe Dashboard Quick Reference](docs/STRIPE_DASHBOARD_QUICK_REFERENCE.md)** - Stripe dashboard navigation

### 🔒 Security & Core Systems (Essential Reading)

- **[USERNAME_SECURITY_GUIDELINES](docs/USERNAME_SECURITY_GUIDELINES.md)** - **🔒 CRITICAL**: Prevent email exposure vulnerabilities
- **[VERSION_SYSTEM](docs/VERSION_SYSTEM.md)** - **ESSENTIAL**: Unified version system for page edit tracking
- **[AUTHENTICATION_ARCHITECTURE](docs/AUTHENTICATION_ARCHITECTURE.md)** - Environment-specific authentication rules
- **[USER_DATA_FETCHING_PATTERNS](docs/USER_DATA_FETCHING_PATTERNS.md)** - Standardized patterns for secure user data handling

### 💰 Financial System

#### Payment & Subscription
- **[Subscription System](docs/SUBSCRIPTION_SYSTEM.md)** - Subscription management and Stripe integration
- **[Simplified Payout System](docs/SIMPLIFIED_PAYOUT_SYSTEM.md)** - Current payout architecture
- **[Platform Fee Management System](docs/PLATFORM_FEE_MANAGEMENT_SYSTEM.md)** - Fee configuration and management
- **[USD System Overview](docs/USD_SYSTEM_OVERVIEW.md)** - Overview of the USD-based system

#### Allocation & Earnings
- **[Allocation System](docs/ALLOCATION_SYSTEM.md)** - USD allocation system
- **[Storage Balance Guide](docs/STORAGE_BALANCE_GUIDE.md)** - Storage balance functionality
- **[Payout System Index](docs/PAYOUT_SYSTEM_INDEX.md)** - Payout system documentation index

#### Testing & Troubleshooting
- **[Payout Testing Infrastructure](docs/PAYOUT_TESTING_INFRASTRUCTURE.md)** - Comprehensive payout testing
- **[Payment Flow Testing Guide](docs/PAYMENT_FLOW_TESTING_GUIDE.md)** - Payment system testing procedures
- **[Payout Troubleshooting Guide](docs/PAYOUT_TROUBLESHOOTING_GUIDE.md)** - Payout system troubleshooting
- **[Subscription Troubleshooting](docs/SUBSCRIPTION_TROUBLESHOOTING.md)** - Common payment issues and solutions
- **[Payment Failure Tracking](docs/PAYMENT_FAILURE_TRACKING.md)** - Payment error tracking
- **[Webhook Setup Guide](docs/WEBHOOK_SETUP_GUIDE.md)** - Stripe webhook configuration

### 🏗️ System Architecture

#### Core Architecture
- **[Financial Data Architecture](docs/FINANCIAL_DATA_ARCHITECTURE.md)** - Separated financial contexts architecture
- **[Content Display Architecture](docs/CONTENT_DISPLAY_ARCHITECTURE.md)** - Content rendering and display
- **[Environment Architecture](docs/ENVIRONMENT_ARCHITECTURE.md)** - Development vs production environments
- **[Session Management Architecture](docs/SESSION_MANAGEMENT_ARCHITECTURE.md)** - Session handling and device management

#### Specialized Systems
- **[Header System](docs/HEADER_SYSTEM.md)** - Navigation header architecture
- **[Theme System Architecture](docs/THEME_SYSTEM_ARCHITECTURE.md)** - Theme and styling system
- **[Save System Reliability Architecture](docs/SAVE_SYSTEM_RELIABILITY_ARCHITECTURE.md)** - Save system design
- **[Simplified Activity System](docs/SIMPLIFIED_ACTIVITY_SYSTEM.md)** - Activity tracking using recent pages

### 🔧 Development & Operations

#### Development Workflow
- **[Branch Aware Development](docs/BRANCH_AWARE_DEVELOPMENT.md)** - Development workflow and environment switching
- **[Development Auth Guide](docs/DEVELOPMENT_AUTH_GUIDE.md)** - Development authentication setup
- **[Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT_GUIDE.md)** - Deployment procedures and best practices

#### Standards & Guidelines
- **[Collection Naming Standards](docs/COLLECTION_NAMING_STANDARDS.md)** - Database collection naming
- **[Dependency Management Standards](docs/DEPENDENCY_MANAGEMENT_STANDARDS.md)** - Package management standards
- **[Border Styling Guidelines](docs/BORDER_STYLING_GUIDELINES.md)** - UI styling standards
- **[DOM Element Identifiers](docs/DOM_ELEMENT_IDENTIFIERS.md)** - DOM element naming conventions
- **[Native App Migration Plan](docs/NATIVE_APP_PLAN.md)** - PWA-to-native migration strategy and notification system architecture

### 📱 Features & User Experience

#### Content Features
- **[Editor Viewer Separation](docs/EDITOR_VIEWER_SEPARATION.md)** - Editor/viewer architecture
- **[Line Based Editor](docs/LINE_BASED_EDITOR.md)** - Editor implementation details
- **[Recent Edits System](docs/RECENT_EDITS_SYSTEM.md)** - Recent edits functionality
- **[Search System](docs/SEARCH_SYSTEM.md)** - Search implementation and features
- **[Writing Suggestions System](docs/WRITING_SUGGESTIONS_SYSTEM.md)** - Writing suggestion features
- **[Link Suggestion System](docs/LINK_SUGGESTION_SYSTEM.md)** - Link suggestion functionality

#### User Interface
- **[Settings Navigation System](docs/SETTINGS_NAVIGATION_SYSTEM.md)** - Settings page navigation
- **[Version System](docs/VERSION_SYSTEM.md)** - Version management system

### ⚡ Performance & Optimization

- **[Firebase Cost Optimization Summary](docs/FIREBASE_COST_OPTIMIZATION_SUMMARY.md)** - Cost optimization results and strategies
- **[Database Schema Optimization Guide](docs/DATABASE_SCHEMA_OPTIMIZATION_GUIDE.md)** - Database optimization techniques
- **[Search Performance Optimizations](docs/SEARCH_PERFORMANCE_OPTIMIZATIONS.md)** - Search system optimization
- **[Navigation Caching Optimization](docs/NAVIGATION_CACHING_OPTIMIZATION.md)** - Navigation performance optimization

### 🚨 Troubleshooting & Support

#### Issue Resolution
- **[Username Issue Analysis and Solution](docs/USERNAME_ISSUE_ANALYSIS_AND_SOLUTION.md)** - Username-related issues
- **[Production Error Analysis](docs/PRODUCTION_ERROR_ANALYSIS.md)** - Production error patterns
- **[Critical Production Fixes](docs/CRITICAL_PRODUCTION_FIXES.md)** - Critical issue resolutions

#### Maintenance & Cleanup
- **[Legacy Code Cleanup Guide](docs/LEGACY_CODE_CLEANUP_GUIDE.md)** - **ESSENTIAL**: Identifying and removing deprecated patterns
- **[Auth Cleanup Guide](docs/AUTH_CLEANUP_GUIDE.md)** - Authentication cleanup procedures

### 📦 Archive & Historical

#### Completed Work
- **[Archive](docs/archive/README.md)** - ⭐ **REFERENCE** - Completed migrations, optimization summaries, and historical documentation
- **[USD Migration Guide](docs/USD_MIGRATION_GUIDE.md)** - ✅ **COMPLETED** - USD system migration documentation

#### Deprecated (Reference Only)
- **[Deprecated API Endpoints](docs/DEPRECATED_API_ENDPOINTS.md)** - ⚠️ **REFERENCE** - Deprecated API documentation
- **[Deprecated Components](docs/DEPRECATED_COMPONENTS.md)** - ⚠️ **REFERENCE** - Deprecated component documentation
- **[Deprecated UI Patterns](docs/DEPRECATED_UI_PATTERNS.md)** - ⚠️ **REFERENCE** - Deprecated UI pattern documentation

## 🛠️ Technology Stack

### Core Technologies

- **⚛️ [Next.js 14](https://nextjs.org/)** - React framework with App Router
- **🔥 [Firebase](https://firebase.google.com/)** - Backend-as-a-Service platform
- **🎨 [Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **📝 [Slate.js](https://slatejs.org/)** - Customizable rich text editor framework
- **💳 [Stripe](https://stripe.com/)** - Payment processing and subscriptions

### Firebase Services

- **🗄️ Firestore** - NoSQL document database for pages, users, and versions
- **🔐 Authentication** - Email/password authentication with session management
- **☁️ Functions** - Serverless functions for webhooks and background processing
- **📁 Storage** - File storage for images and attachments

### Development & Deployment

- **📦 [pnpm](https://pnpm.io/)** - Fast, disk space efficient package manager
- **🚀 [Vercel](https://vercel.com/)** - Deployment platform with automatic CI/CD
- **📊 [LogRocket](https://logrocket.com/)** - Session replay and error tracking
- **🔍 [TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript development

### Key Features

- **🌙 Dark Mode** - System-aware theme switching
- **📱 Responsive Design** - Mobile-first responsive interface
- **🔗 Smart Linking** - Automatic page linking and backlinks
- **💰 USD Creator Support** - Direct USD payments to creators with transparent monthly funding
- **🔒 Security** - Comprehensive security measures and data protection

## 📁 Project Structure

```
WeWrite/
├── app/                    # Next.js App Router
│   ├── api/               # API routes and endpoints
│   ├── auth/              # Authentication pages
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts for global state
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries and helpers
│   ├── providers/         # Context providers
│   ├── settings/          # User settings pages
│   └── utils/             # Utility functions
├── docs/                  # Technical documentation
├── public/                # Static assets
└── functions/             # Firebase Cloud Functions
```

### Key Directories

- **`app/`** - Next.js 14 App Router with file-based routing
- **`app/components/`** - Reusable UI components organized by feature
- **`app/api/`** - API routes for backend functionality
- **`docs/`** - Comprehensive technical documentation
- **`functions/`** - Firebase Cloud Functions for webhooks and background tasks

## 🚀 Deployment

### Automatic Deployment

WeWrite uses Vercel for automatic deployment:

- **Production**: Deploys from `main` branch to [wewrite.app](https://wewrite.app)
- **Preview**: Deploys from `dev` branch for testing
- **Environment Variables**: Configured in Vercel dashboard

### Local Development Environment

WeWrite uses **branch-aware environment detection** for local development:

- **Main branch** (`main`): Uses **production collections** - connects to real data
- **Dev branch** (`dev`): Uses **dev collections** (`DEV_*` prefix) - isolated test data
- **Other branches**: Uses **dev collections** (safe default) - isolated test data

This ensures you can test against production data when needed (main branch) while keeping development work safely isolated (dev branch).

### Manual Deployment

```bash
# Build for production
pnpm build

# Deploy to Vercel
pnpm deploy
```

For detailed deployment procedures, see [PRODUCTION_DEPLOYMENT_GUIDE](docs/PRODUCTION_DEPLOYMENT_GUIDE.md).

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Follow our coding standards** (see documentation)
4. **Write tests** for new functionality
5. **Submit a pull request**

### Development Guidelines

- **Security First**: Follow [USERNAME_SECURITY_GUIDELINES](docs/USERNAME_SECURITY_GUIDELINES.md)
- **Clean Code**: Use [LEGACY_CODE_CLEANUP_GUIDE](docs/LEGACY_CODE_CLEANUP_GUIDE.md)
- **Testing**: Write comprehensive tests for all features
- **Documentation**: Update docs for any new features or changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **📧 Email**: [support@wewrite.app](mailto:support@wewrite.app)
- **💬 Discord**: [Join our community](https://discord.gg/wewrite)
- **🐛 Issues**: [GitHub Issues](https://github.com/WeWriteApp/WeWrite/issues)
- **📖 Documentation**: [docs/](docs/) directory

---

**Made with ❤️ by the WeWrite team**
