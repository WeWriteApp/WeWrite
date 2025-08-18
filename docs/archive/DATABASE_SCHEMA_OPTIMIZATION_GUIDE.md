# Database Schema Optimization Guide

## 🎯 **Overview**

This guide provides recommendations for optimizing WeWrite's database schema to further reduce costs and improve performance.

## 📊 **Current Query Analysis**

### **High-Frequency Queries Identified:**
1. **User Authentication**: `users/{userId}` lookups
2. **Page Access**: `pages/{pageId}` with access control checks
3. **Subscription Status**: `users/{userId}/subscription/current`
4. **Page Views**: `pageViews/{pageId}_{date}` aggregations
5. **Live Analytics**: Real-time counters and stats

## 🔧 **Recommended Optimizations**

### **1. Firestore Indexes**

#### **Critical Indexes to Add:**
```javascript
// Composite indexes for efficient queries
{
  collection: "pages",
  fields: [
    { field: "userId", order: "ASCENDING" },
    { field: "isPublic", order: "ASCENDING" },
    { field: "deleted", order: "ASCENDING" },
    { field: "lastModified", order: "DESCENDING" }
  ]
}

{
  collection: "pages", 
  fields: [
    { field: "isPublic", order: "ASCENDING" },
    { field: "deleted", order: "ASCENDING" },
    { field: "createdAt", order: "DESCENDING" }
  ]
}

{
  collection: "pageViews",
  fields: [
    { field: "pageId", order: "ASCENDING" },
    { field: "date", order: "DESCENDING" }
  ]
}
```

### **2. Data Denormalization**

#### **User Profile Denormalization:**
```javascript
// Add frequently accessed user data to pages collection
{
  pageId: "page123",
  title: "My Page",
  userId: "user456",
  // DENORMALIZED USER DATA
  username: "johndoe",
  displayName: "John Doe",
  userAvatar: "https://...",
  // ... other page data
}
```

#### **Subscription Status Denormalization:**
```javascript
// Add subscription status to user document
{
  userId: "user456",
  email: "john@example.com",
  // DENORMALIZED SUBSCRIPTION DATA
  subscriptionStatus: "active",
  subscriptionTier: "pro",
  subscriptionAmount: 10,
  // ... other user data
}
```

### **3. Counter Documents**

#### **Implement Distributed Counters:**
```javascript
// Replace real-time aggregations with counter documents
{
  collection: "counters",
  document: "page_stats_{pageId}",
  data: {
    totalViews: 1250,
    views24h: 45,
    liveReaders: 3,
    lastUpdated: timestamp
  }
}
```

## 🚀 **Implementation Plan**

### **Phase 1: Critical Indexes (Week 1)**
1. Create composite indexes for page queries
2. Add indexes for user-specific queries
3. Optimize subscription lookup indexes

### **Phase 2: Denormalization (Week 2)**
1. Implement user data denormalization in pages
2. Add subscription status to user documents
3. Create data sync mechanisms

### **Phase 3: Counter Optimization (Week 3)**
1. Implement distributed counters
2. Replace real-time aggregations
3. Add counter update batching

## 📈 **Expected Performance Gains**

| Optimization | Read Reduction | Write Reduction | Cost Impact |
|--------------|----------------|-----------------|-------------|
| Composite Indexes | 40-60% | 0% | High |
| Denormalization | 30-50% | 10-20% | Medium |
| Counter Documents | 20-30% | 60-80% | High |

## ⚠️ **Implementation Considerations**

### **Data Consistency:**
- Implement eventual consistency patterns
- Add data validation and sync mechanisms
- Monitor for data drift

### **Migration Strategy:**
- Gradual rollout with feature flags
- Maintain backward compatibility
- Implement rollback procedures

### **Monitoring:**
- Track query performance metrics
- Monitor data consistency
- Validate cost reductions

## 🔍 **Query Optimization Examples**

### **Before (Inefficient):**
```javascript
// Multiple queries for page with user data
const page = await getDoc(doc(db, 'pages', pageId));
const user = await getDoc(doc(db, 'users', page.data().userId));
const subscription = await getDoc(doc(db, 'users', userId, 'subscription', 'current'));
```

### **After (Optimized):**
```javascript
// Single query with denormalized data
const page = await getDoc(doc(db, 'pages', pageId));
// User data and subscription status already included
```

## 📋 **Action Items**

### **Immediate (This Week):**
- [ ] Create critical Firestore indexes
- [ ] Implement basic counter documents
- [ ] Add query performance monitoring

### **Short-term (Next 2 Weeks):**
- [ ] Implement user data denormalization
- [ ] Add subscription status caching
- [ ] Optimize page query patterns

### **Long-term (Next Month):**
- [ ] Complete distributed counter implementation
- [ ] Add advanced caching strategies
- [ ] Implement query result pagination

## 🎯 **Success Metrics**

- **Query Response Time**: < 200ms for 95% of queries
- **Cache Hit Rate**: > 80% for frequently accessed data
- **Database Costs**: Additional 20-30% reduction
- **Error Rate**: < 0.1% increase during migration
