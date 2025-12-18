# WeWrite Storage Balance System Guide

## 🎯 **Overview**

WeWrite now uses **Stripe's Storage Balance** system for perfect fund separation and enhanced auditability. This guide explains how the system works and what you'll see in your Stripe dashboard.

---

## 💰 **Understanding Your Stripe Dashboard**

### **Payments Balance**
- **What it contains:** Your platform revenue
- **Sources:** Platform fees (10%) + unallocated subscription funds
- **Usage:** This is your money - transfer to business bank account anytime
- **Example:** $3,000 in Payments Balance = $3,000 you can keep

### **Storage Balance** 
- **What it contains:** Creator obligations (escrowed funds)
- **Sources:** User allocations to creators
- **Usage:** Automatically paid out to creators monthly
- **Example:** $7,000 in Storage Balance = $7,000 owed to creators

### **Total Balance**
- **What it shows:** Payments Balance + Storage Balance
- **Example:** $3,000 + $7,000 = $10,000 total

---

## 🔄 **How Funds Flow**

### **1. Subscription Payment (Start of Month)**
```
User pays $10 subscription → Recorded as monthly allocation balance (funds initially land in Stripe Payments Balance)
```

### **2. Allocations (Ledger-Only During Month)**
```
User allocates $7 to creators → Recorded in usdAllocations + ServerUsdService (no Stripe balance movement yet)
```

### **3. Month-End Storage/Payments Transfer**
```
Allocated $7  → Moved to Storage Balance (cron: /api/cron/storage-balance-processing)
Unallocated $3 → Remains in Payments Balance as platform revenue
```

### **4. Monthly Payouts**
```
Storage Balance ($7) → Creator bank accounts
Platform fee (10%) → Retained in Payments Balance
```

---

## 📊 **Monthly Processing Cycle**

### **Throughout the Month:**
- **Subscriptions** → Payments Balance (settle at checkout) + recorded as monthly allocation balances
- **User allocations** → Ledger only (usdAllocations + ServerUsdService); Stripe balances unchanged until month-end
- **Unallocated funds** → Remain in Payments Balance

### **Month-End Processing:**
1. **Lock allocations** (no more changes allowed)
2. **Storage/Payments transfer** (`/api/cron/storage-balance-processing`): allocated → Storage Balance; unallocated → Payments Balance
3. **Calculate earnings** (with 10% platform fee)
4. **Process payouts** from Storage Balance
5. **Platform revenue** remains in Payments Balance

### **Result:**
- **Storage Balance** → Near $0 (after payouts)
- **Payments Balance** → Contains your platform revenue

---

## ✅ **Benefits of Storage Balance System**

### **For WeWrite:**
- ✅ **Clear Fund Separation** in Stripe dashboard
- ✅ **Better Auditability** with Stripe's escrow system
- ✅ **Regulatory Compliance** through proper fund segregation
- ✅ **Simplified Accounting** - Stripe handles creator obligations
- ✅ **Enhanced Trust** - creators see funds properly escrowed
- ✅ **Reduced Complexity** - less internal balance tracking

### **For Creators:**
- ✅ **Visible Escrow** - funds clearly separated for their benefit
- ✅ **Regulatory Protection** - proper fund segregation
- ✅ **Reliable Payouts** - from dedicated Storage Balance
- ✅ **Transparent Process** - clear fund flow visibility

### **For Users:**
- ✅ **Same Experience** - no changes to user interface
- ✅ **"Use It or Lose It"** - still encourages engagement
- ✅ **Transparent Allocations** - clear where funds go

---

## 🎯 **Key Differences from Old System**

### **Old System (Legacy Fund Holding):**
```
Payments Balance: $10,000 (mixed funds - creator + platform)
Storage Balance:  $0
Tracking: Internal database tracking required
```

### **New System (Storage Balance):**
```
Payments Balance: $3,000 (platform revenue only)
Storage Balance:  $7,000 (creator obligations only)
Tracking: Stripe-managed escrow system
```

---

## 📈 **Monitoring Your Balances**

### **Daily Monitoring:**
- **Payments Balance** should grow with platform revenue
- **Storage Balance** should reflect current creator obligations
- **Total Balance** should match expected subscription volume

### **Monthly Patterns:**
- **Early Month:** Storage Balance grows as users allocate
- **Mid Month:** Steady growth in both balances
- **Month End:** Storage Balance drops to ~$0 after payouts
- **Post Payout:** Payments Balance contains accumulated platform revenue

### **Alert Conditions:**
- **Storage Balance > Payments Balance** → Normal (more owed than earned)
- **Storage Balance >> Payments Balance** → Monitor for sufficient coverage
- **Storage Balance = 0** → Normal after monthly payouts

---

## 🔧 **Admin Operations**

### **Monthly Processing:**
1. **Allocation Locking** → Automatic on last day of month
2. **Earnings Calculation** → Automatic with 10% platform fee
3. **Payout Processing** → Automatic on 1st of next month
4. **Balance Monitoring** → Continuous monitoring and alerts

### **Manual Operations:**
- **Platform Revenue Transfer** → Move Payments Balance to business account
- **Emergency Payout** → Manual payout from Storage Balance if needed
- **Balance Reconciliation** → Verify Storage Balance matches obligations

### **Monitoring Tools:**
- **Admin Dashboard** → Real-time balance breakdown
- **Balance Alerts** → Automatic notifications for issues
- **Monthly Reports** → Comprehensive financial reporting

---

## 🚨 **Troubleshooting**

### **Common Scenarios:**

**Q: Storage Balance is higher than expected**
- **A:** Users allocated more than usual - this is normal

**Q: Payments Balance is lower than expected**
- **A:** More funds moved to Storage Balance - check allocation rates

**Q: Storage Balance didn't clear after payouts**
- **A:** Some creators may not be eligible - check payout logs

**Q: What happens to funds when creators haven't set up bank accounts?**
- **A:** Funds remain in Storage Balance indefinitely until bank account is connected. No automatic cleanup or timeout mechanisms exist.

**Q: Do unpaid funds ever move back to Payments Balance?**
- **A:** No. Only unallocated subscription funds move to Payments Balance via "use it or lose it". Allocated funds stay in Storage Balance until paid out.

**Q: Balances don't match internal tracking**
- **A:** Storage Balance is now the source of truth - update internal systems

---

## 💰 **Fund Retention Policy**

### **Unpaid Creator Funds**
When creators have valid earnings but haven't set up bank accounts:

- **✅ Funds Remain Safe**: All allocated funds stay in Storage Balance indefinitely
- **✅ No Expiration**: There are no timeout mechanisms that move funds elsewhere
- **✅ Accumulation**: Monthly earnings continue to accumulate in Storage Balance
- **✅ Immediate Access**: Once bank account is connected, all accumulated funds become available for payout

### **What This Means:**
- **For Creators**: Your earnings are safely held until you're ready to receive them
- **For WeWrite**: Storage Balance accurately reflects all outstanding creator obligations
- **For Compliance**: Proper fund segregation ensures regulatory compliance

### **Important Notes:**
- Only **unallocated subscription funds** move to Payments Balance via "use it or lose it"
- **Allocated funds** (creator earnings) never expire or move back to platform revenue
- **Storage Balance** serves as a permanent escrow for creator obligations

---

## 🎉 **Success Metrics**

### **System Health:**
- **Fund Separation:** Perfect (Payments ≠ Storage)
- **Auditability:** Stripe-managed
- **Compliance:** Regulatory compliant
- **Creator Trust:** Enhanced through visible escrow

### **Business Metrics:**
- **Platform Revenue:** Clear visibility in Payments Balance
- **Creator Obligations:** Clear tracking in Storage Balance
- **Payout Success Rate:** Maintained or improved
- **User Engagement:** "Use it or lose it" still effective

---

## 🚀 **The Future**

The Storage Balance system positions WeWrite for:
- **Enhanced regulatory compliance**
- **Better investor confidence** through clear fund separation
- **Improved creator trust** through visible escrow
- **Simplified operations** with Stripe-managed accounting
- **Maintained innovation** with "use it or lose it" model

**Welcome to the future of creator economy platforms!** 🎯
