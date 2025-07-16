# Mock Earnings System Documentation

## Overview

The Mock Earnings System provides a safe, isolated testing environment for the WeWrite token earnings functionality. It allows administrators to create, test, and validate earnings features without affecting real financial data.

## Architecture

### Data Flow
```
Admin Interface → Mock Earnings API → Firebase Admin SDK → Database
                                                              ↓
Database → Firebase Client SDK → TokenEarningsService → UI Components
                                                              ↓
Database → TestModeDetectionService → TestModeAlertBar → User Alert
```

### Key Components

1. **Mock Earnings API** (`/api/admin/mock-token-earnings`)
   - Creates test earnings data using Firebase Admin SDK
   - Stores data in production collections with mock identifiers
   - Only accessible to verified admin users

2. **Reset API** (`/api/admin/reset-mock-earnings`)
   - Removes all mock earnings data
   - Preserves real financial data
   - Provides detailed cleanup reporting

3. **Test Mode Detection Service**
   - Monitors for presence of mock data
   - Triggers UI alerts when test mode is active
   - Provides detailed test status information

4. **Test Mode Alert Bar**
   - Prominent visual indicator of active test mode
   - Shows test data summary and exit options
   - Prevents confusion between test and real data

## Security Model

### Authentication & Authorization
- **Admin-Only Access**: All mock earnings operations require admin privileges
- **Email-Based Verification**: Admin status verified against hardcoded email list
- **Firebase Admin SDK**: Server-side operations use elevated permissions
- **User Read Access**: Users can read their own earnings data (test + real)

### Data Isolation
- **Mock Identifiers**: All test data uses distinct identifiers:
  - `fromUserId: 'system_mock_allocator'`
  - `fromUsername: 'Mock System'`
  - `resourceId: 'mock_page_*'`
- **Clear Separation**: Mock data is easily identifiable and filterable
- **Safe Cleanup**: Reset operations target only mock-identified records

## Database Schema

### Collections Used
- `writerTokenEarnings`: Individual earnings records by month
- `writerTokenBalances`: Aggregated balance information

### Mock Data Structure
```typescript
// Mock Earnings Record
{
  id: "${userId}_${month}",
  userId: string,
  month: "YYYY-MM",
  totalTokensReceived: number,
  totalUsdValue: number,
  status: "available",
  allocations: [{
    allocationId: "mock_allocation_*",
    fromUserId: "system_mock_allocator",
    fromUsername: "Mock System",
    resourceType: "page",
    resourceId: "mock_page_*",
    resourceTitle: "Mock Test Page",
    tokens: number,
    usdValue: number
  }],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## API Endpoints

### POST /api/admin/mock-token-earnings
Creates mock earnings for the current admin user.

**Request Body:**
```json
{
  "tokenAmount": number,
  "month": "YYYY-MM"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully created mock earnings",
  "data": {
    "targetUserId": string,
    "tokenAmount": number,
    "month": string,
    "earningsId": string,
    "usdValue": number
  }
}
```

### POST /api/admin/reset-mock-earnings
Removes all mock earnings for the current admin user.

**Request Body:** `{}`

**Response:**
```json
{
  "success": true,
  "message": "Mock earnings reset successfully",
  "data": {
    "tokensRemoved": number,
    "usdRemoved": number,
    "recordsModified": number
  }
}
```

## Code Organization

### File Structure
```
app/
├── api/admin/
│   ├── mock-token-earnings/route.ts    # Mock earnings creation API
│   └── reset-mock-earnings/route.ts    # Mock earnings cleanup API
├── components/admin/
│   └── TestModeAlertBar.tsx            # Test mode warning UI
├── services/
│   ├── mockEarningsService.ts          # Centralized mock earnings service
│   ├── testModeDetectionService.ts     # Test mode detection logic
│   └── tokenEarningsService.ts         # Real earnings service
├── types/
│   └── mockEarnings.ts                 # TypeScript interfaces
└── admin/page.tsx                      # Admin interface
```

### Service Integration
- **MockEarningsService**: Centralized business logic and API calls
- **TestModeDetectionService**: Monitors for active test modes
- **TokenEarningsService**: Handles real earnings data (unchanged)
- **TestModeAlertBar**: UI component for test mode warnings

## Development Guidelines

### Adding New Mock Features
1. Use consistent mock identifiers (`system_mock_*`, `mock_*`)
2. Implement both creation and cleanup functionality
3. Add detection logic to TestModeDetectionService
4. Update TestModeAlertBar to display new test types
5. Document security implications and data flow

### Firebase SDK Differences
```typescript
// Client SDK (browser)
if (doc.exists()) { ... }

// Admin SDK (server)
if (doc.exists) { ... }
```

### Error Handling Pattern
```typescript
try {
  // Operation
  console.log('[Service] Operation successful');
  return { success: true, data: result };
} catch (error) {
  console.error('[Service] Operation failed:', error);
  return { 
    success: false, 
    error: error.message || 'Operation failed' 
  };
}
```

## Production Safety

### Deployment Safeguards
- Mock data is clearly marked and identifiable
- Reset functionality targets only mock records
- Admin access is restricted to verified emails
- All operations are logged for audit trails

### Monitoring
- TestModeAlertBar provides immediate visual feedback
- Console logging tracks all mock operations
- Error handling prevents data corruption
- Cleanup operations provide detailed reports

## Recent Improvements (Cleanup Pass)

### Code Quality
✅ **Removed excessive debug logging** from production code
✅ **Added comprehensive JSDoc comments** to all APIs and services
✅ **Centralized mock earnings logic** in MockEarningsService
✅ **Improved error handling** with consistent patterns
✅ **Added TypeScript interfaces** for type safety

### Documentation
✅ **Created comprehensive system documentation** (this file)
✅ **Added test checklist** for validation procedures
✅ **Documented Firebase SDK differences** (Admin vs Client)
✅ **Explained security model** and data isolation

### Financial Safety
✅ **Enhanced mock data identification** with distinct identifiers
✅ **Improved cleanup functionality** with detailed reporting
✅ **Added validation** to prevent invalid test data
✅ **Documented production safety** measures

### Maintainability
✅ **Consolidated functionality** into clear service modules
✅ **Improved admin interface** with better UX
✅ **Added type safety** throughout the system
✅ **Created reusable utilities** for common operations

## Troubleshooting

### Common Issues
1. **"exists is not a function"**: Use `.exists` property with Admin SDK
2. **Permission denied**: Verify admin email in hardcoded list
3. **Data not appearing**: Check Firebase security rules and console logs
4. **Test mode not detected**: Verify mock identifiers are correct

### Debug Information
- Check browser console for service-level errors
- Verify API responses in network tab
- Use TestModeDetectionService for status checking
- Confirm database records using Firebase console

### Quick Fixes
```typescript
// Check if user is admin
MockEarningsService.isAdminUser(user.email)

// Validate request before sending
MockEarningsService.validateCreateRequest(request)

// Get current test status
MockEarningsService.getTestModeStatus(userId)

// Check if allocation is mock data
MockEarningsService.isMockAllocation(allocation)
```
