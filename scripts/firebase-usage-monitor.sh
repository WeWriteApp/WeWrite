#!/bin/bash

# Firebase Usage Monitor
# Comprehensive monitoring of Firebase/Firestore usage using CLI tools
# Requires: firebase-tools, gcloud CLI

PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PID:-"wewrite-ccd82"}
DAYS_BACK=${1:-7}  # Default to 7 days of data

echo "🔍 FIREBASE USAGE MONITOR"
echo "=========================="
echo "📅 Date: $(date)"
echo "🎯 Project: $PROJECT_ID"
echo "📊 Analyzing last $DAYS_BACK days"
echo ""

# Check if required tools are installed
check_tools() {
    echo "🔧 Checking required tools..."
    
    if ! command -v firebase &> /dev/null; then
        echo "❌ Firebase CLI not found"
        echo "💡 Install with: npm install -g firebase-tools"
        echo "💡 Login with: firebase login"
        exit 1
    fi
    
    if ! command -v gcloud &> /dev/null; then
        echo "❌ Google Cloud CLI not found"
        echo "💡 Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    echo "✅ All tools available"
    echo ""
}

# Get Firebase project info
get_project_info() {
    echo "📋 PROJECT INFORMATION"
    echo "====================="
    
    # Get project details
    firebase projects:list --json 2>/dev/null | jq -r ".[] | select(.projectId == \"$PROJECT_ID\") | \"📁 Name: \\(.displayName)\\n🆔 ID: \\(.projectId)\\n🔢 Number: \\(.projectNumber)\""
    
    # Get current Firebase config
    echo ""
    echo "⚙️  Current Firebase configuration:"
    firebase use --json 2>/dev/null | jq -r "\"🎯 Active project: \\(.active)\""
    echo ""
}

# Get Firestore usage statistics
get_firestore_usage() {
    echo "🗄️  FIRESTORE USAGE STATISTICS"
    echo "=============================="
    
    # Get Firestore operations (requires proper permissions)
    echo "📊 Recent Firestore operations:"
    gcloud firestore operations list \
        --project=$PROJECT_ID \
        --limit=10 \
        --format="table(name.basename(),metadata.operationType,metadata.state,done)" \
        2>/dev/null || echo "⚠️  Could not fetch operations (may require additional permissions)"
    
    echo ""
    
    # Get database information
    echo "🗃️  Database information:"
    gcloud firestore databases list \
        --project=$PROJECT_ID \
        --format="table(name.basename(),type,locationId)" \
        2>/dev/null || echo "⚠️  Could not fetch database info"
    
    echo ""
}

# Get billing and quota information
get_billing_info() {
    echo "💰 BILLING & QUOTA INFORMATION"
    echo "=============================="
    
    # Get quota usage (requires billing API access)
    echo "📈 API quota usage:"
    gcloud logging read "resource.type=\"firestore_database\"" \
        --project=$PROJECT_ID \
        --limit=10 \
        --format="table(timestamp,severity,textPayload)" \
        --freshness=7d \
        2>/dev/null || echo "⚠️  Could not fetch quota information"
    
    echo ""
    
    # Get billing account info
    echo "💳 Billing information:"
    gcloud beta billing projects describe $PROJECT_ID \
        --format="table(billingAccountName,billingEnabled)" \
        2>/dev/null || echo "⚠️  Could not fetch billing information"
    
    echo ""
}

# Analyze Firestore indexes
analyze_indexes() {
    echo "📇 FIRESTORE INDEXES"
    echo "==================="
    
    # List composite indexes
    echo "🔗 Composite indexes:"
    gcloud firestore indexes composite list \
        --project=$PROJECT_ID \
        --format="table(name.basename(),state,fields[].fieldPath:label=FIELDS)" \
        2>/dev/null || echo "⚠️  Could not fetch composite indexes"
    
    echo ""
    
    # List field configurations
    echo "🏷️  Field configurations:"
    gcloud firestore indexes fields list \
        --project=$PROJECT_ID \
        --format="table(name.basename(),indexConfig.indexes[].mode:label=MODES)" \
        --limit=10 \
        2>/dev/null || echo "⚠️  Could not fetch field configurations"
    
    echo ""
}

# Get Cloud Monitoring metrics
get_monitoring_metrics() {
    echo "📊 CLOUD MONITORING METRICS"
    echo "=========================="
    
    local end_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local start_time=$(date -u -d "$DAYS_BACK days ago" +"%Y-%m-%dT%H:%M:%SZ")
    
    echo "📅 Time range: $start_time to $end_time"
    echo ""
    
    # Get Firestore read operations
    echo "📖 Firestore read operations:"
    gcloud monitoring metrics list \
        --filter="metric.type:firestore" \
        --project=$PROJECT_ID \
        --format="table(metricDescriptor.type,metricDescriptor.displayName)" \
        2>/dev/null || echo "⚠️  Could not fetch monitoring metrics"
    
    echo ""
    
    # Try to get actual usage data
    echo "📈 Attempting to fetch usage data..."
    gcloud logging read "resource.type=\"firestore_database\" AND severity>=INFO" \
        --project=$PROJECT_ID \
        --limit=5 \
        --format="table(timestamp,severity,resource.labels.database_id)" \
        --freshness=${DAYS_BACK}d \
        2>/dev/null || echo "⚠️  Could not fetch usage logs"
    
    echo ""
}

# Generate recommendations
generate_recommendations() {
    echo "💡 OPTIMIZATION RECOMMENDATIONS"
    echo "==============================="
    echo ""
    echo "Based on Firebase best practices:"
    echo ""
    echo "🔍 MONITORING:"
    echo "  • Set up Cloud Monitoring alerts for read/write quotas"
    echo "  • Monitor billing alerts to prevent unexpected charges"
    echo "  • Track query performance with Firebase Performance Monitoring"
    echo ""
    echo "⚡ OPTIMIZATION:"
    echo "  • Use pagination for large result sets (limit + startAfter)"
    echo "  • Implement client-side caching for frequently accessed data"
    echo "  • Use composite indexes for complex queries"
    echo "  • Consider denormalization for read-heavy operations"
    echo ""
    echo "💰 COST REDUCTION:"
    echo "  • Cache query results on the client side"
    echo "  • Use Firebase Functions for server-side caching"
    echo "  • Implement proper data lifecycle management"
    echo "  • Consider using Firestore bundles for static data"
    echo ""
    echo "🛠️  TOOLS:"
    echo "  • Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
    echo "  • Cloud Console: https://console.cloud.google.com/firestore/data?project=$PROJECT_ID"
    echo "  • Monitoring: https://console.cloud.google.com/monitoring?project=$PROJECT_ID"
    echo ""
}

# Main execution
main() {
    check_tools
    get_project_info
    get_firestore_usage
    analyze_indexes
    get_monitoring_metrics
    get_billing_info
    generate_recommendations
    
    echo "✅ Analysis complete!"
    echo ""
    echo "🔗 Next steps:"
    echo "  1. Run the Firestore Resource Analyzer: node scripts/firestore-resource-analyzer.js"
    echo "  2. Check your Firebase Console for detailed usage metrics"
    echo "  3. Set up monitoring alerts for quota usage"
    echo "  4. Implement caching strategies for high-read operations"
}

# Run the main function
main
