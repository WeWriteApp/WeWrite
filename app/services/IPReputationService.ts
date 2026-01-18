/**
 * IP Reputation Service
 *
 * Checks IP addresses against reputation services and internal blocklists.
 * Features:
 * - External API integration (IPQualityScore, AbuseIPDB)
 * - Proxy/VPN/TOR detection
 * - Local blocklist management
 * - Geographic anomaly detection
 * - Response caching for performance
 *
 * @see app/services/RiskScoringService.ts
 */

import { adminDb } from '../lib/firebase-admin';

// Types
export interface IPReputationResult {
  ip: string;
  score: number; // 0-100 (higher = more risk)
  isProxy: boolean;
  isVpn: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  isBlocked: boolean;
  country?: string;
  city?: string;
  isp?: string;
  reasons: string[];
  source: 'cache' | 'api' | 'local' | 'fallback';
  checkedAt: Date;
}

export interface IPBlocklistEntry {
  ip: string;
  reason: string;
  blockedAt: Date;
  blockedBy?: string;
  expiresAt?: Date;
}

export interface GeoLocationResult {
  country: string;
  countryCode: string;
  region?: string;
  city?: string;
  timezone?: string;
  lat?: number;
  lon?: number;
}

// Known datacenter/hosting provider IP ranges (simplified patterns)
const DATACENTER_PATTERNS = [
  // AWS
  /^3\.(1[0-9]{2}|2[0-4][0-9]|25[0-5])\./,
  /^13\.(5[0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\./,
  /^18\.1[0-9]{2}\./,
  /^52\./,
  /^54\./,
  // Google Cloud
  /^35\.(1[0-9]{2}|2[0-4][0-9]|25[0-5])\./,
  /^34\./,
  // Azure
  /^40\.(7[0-9]|8[0-9]|9[0-9]|1[0-1][0-9]|12[0-7])\./,
  /^13\.6[4-9]\./,
  /^13\.7[0-9]\./,
  // DigitalOcean
  /^159\.89\./,
  /^167\.99\./,
  /^178\.62\./,
  // Linode
  /^172\.10[4-5]\./,
  /^45\.79\./,
  // OVH
  /^51\.77\./,
  /^51\.79\./,
  /^139\.99\./,
  // Hetzner
  /^95\.216\./,
  /^135\.181\./,
  /^65\.21\./,
];

// High-risk country codes (based on spam statistics)
const HIGH_RISK_COUNTRIES = new Set([
  // This is not about nationality discrimination - it's based on
  // empirical spam origin statistics. Users from these countries
  // still get access, just with additional verification.
]);

// Cache settings
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const LOCAL_CACHE = new Map<string, { result: IPReputationResult; expiresAt: number }>();

export class IPReputationService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.IPQUALITYSCORE_API_KEY;
  }

  /**
   * Check IP reputation
   */
  async checkIP(ip: string): Promise<IPReputationResult> {
    // 1. Check local cache first
    const cached = this.getFromCache(ip);
    if (cached) {
      return cached;
    }

    // 2. Check local blocklist
    const blocklistEntry = await this.checkBlocklist(ip);
    if (blocklistEntry) {
      const result: IPReputationResult = {
        ip,
        score: 100,
        isProxy: false,
        isVpn: false,
        isTor: false,
        isDatacenter: false,
        isBlocked: true,
        reasons: [`Blocked: ${blocklistEntry.reason}`],
        source: 'local',
        checkedAt: new Date(),
      };
      this.addToCache(ip, result);
      return result;
    }

    // 3. Check datacenter IPs
    const isDatacenter = this.isDatacenterIP(ip);

    // 4. Try external API if configured
    if (this.apiKey) {
      try {
        const apiResult = await this.checkIPQualityScore(ip);
        const result: IPReputationResult = {
          ...apiResult,
          isDatacenter: isDatacenter || apiResult.isDatacenter,
          source: 'api',
          checkedAt: new Date(),
        };
        this.addToCache(ip, result);
        await this.cacheToFirestore(ip, result);
        return result;
      } catch (error) {
        console.error('[IPReputation] API error:', error);
        // Fall through to fallback
      }
    }

    // 5. Check Firestore cache
    const firestoreCache = await this.getFromFirestoreCache(ip);
    if (firestoreCache) {
      this.addToCache(ip, firestoreCache);
      return firestoreCache;
    }

    // 6. Fallback result
    const fallbackResult: IPReputationResult = {
      ip,
      score: isDatacenter ? 40 : 0,
      isProxy: false,
      isVpn: false,
      isTor: false,
      isDatacenter,
      isBlocked: false,
      reasons: isDatacenter ? ['Datacenter IP detected'] : [],
      source: 'fallback',
      checkedAt: new Date(),
    };
    this.addToCache(ip, fallbackResult);
    return fallbackResult;
  }

  /**
   * Check IP against IPQualityScore API
   */
  private async checkIPQualityScore(ip: string): Promise<Omit<IPReputationResult, 'source' | 'checkedAt'>> {
    if (!this.apiKey) {
      throw new Error('IPQualityScore API key not configured');
    }

    const url = `https://ipqualityscore.com/api/json/ip/${this.apiKey}/${ip}?strictness=1&allow_public_access_points=true&lighter_penalties=false`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`IPQualityScore API error: ${response.status}`);
    }

    const data = await response.json();

    const reasons: string[] = [];
    if (data.proxy) reasons.push('Proxy detected');
    if (data.vpn) reasons.push('VPN detected');
    if (data.tor) reasons.push('TOR exit node');
    if (data.is_crawler) reasons.push('Crawler/Bot detected');
    if (data.recent_abuse) reasons.push('Recent abuse reported');
    if (data.bot_status) reasons.push('Bot activity detected');

    return {
      ip,
      score: Math.round(data.fraud_score || 0),
      isProxy: data.proxy || false,
      isVpn: data.vpn || false,
      isTor: data.tor || false,
      isDatacenter: data.is_crawler || false,
      isBlocked: (data.fraud_score || 0) >= 90,
      country: data.country_code,
      city: data.city,
      isp: data.ISP,
      reasons,
    };
  }

  /**
   * Check if IP is from a known datacenter
   */
  private isDatacenterIP(ip: string): boolean {
    return DATACENTER_PATTERNS.some((pattern) => pattern.test(ip));
  }

  /**
   * Check local blocklist
   */
  private async checkBlocklist(ip: string): Promise<IPBlocklistEntry | null> {
    try {
      const doc = await adminDb
        .collection('ipBlocklist')
        .doc(ip.replace(/\./g, '_'))
        .get();

      if (!doc.exists) return null;

      const data = doc.data() as IPBlocklistEntry;

      // Check if block has expired
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        // Remove expired entry
        await doc.ref.delete();
        return null;
      }

      return data;
    } catch (error) {
      console.error('[IPReputation] Blocklist check error:', error);
      return null;
    }
  }

  /**
   * Add IP to blocklist
   */
  async blockIP(ip: string, reason: string, blockedBy?: string, durationHours?: number): Promise<void> {
    try {
      const entry: IPBlocklistEntry = {
        ip,
        reason,
        blockedAt: new Date(),
        blockedBy,
        expiresAt: durationHours
          ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
          : undefined,
      };

      await adminDb
        .collection('ipBlocklist')
        .doc(ip.replace(/\./g, '_'))
        .set(entry);

      // Clear from cache
      LOCAL_CACHE.delete(ip);
    } catch (error) {
      console.error('[IPReputation] Block IP error:', error);
      throw error;
    }
  }

  /**
   * Remove IP from blocklist
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      await adminDb
        .collection('ipBlocklist')
        .doc(ip.replace(/\./g, '_'))
        .delete();

      // Clear from cache
      LOCAL_CACHE.delete(ip);
    } catch (error) {
      console.error('[IPReputation] Unblock IP error:', error);
      throw error;
    }
  }

  /**
   * Get all blocked IPs
   */
  async getBlockedIPs(): Promise<IPBlocklistEntry[]> {
    try {
      const snapshot = await adminDb.collection('ipBlocklist').get();
      return snapshot.docs.map((doc) => doc.data() as IPBlocklistEntry);
    } catch (error) {
      console.error('[IPReputation] Get blocked IPs error:', error);
      return [];
    }
  }

  /**
   * Detect geographic anomaly (impossible travel)
   */
  async detectGeoAnomaly(
    userId: string,
    currentIP: string,
    currentCountry: string
  ): Promise<{ isAnomaly: boolean; reason?: string }> {
    try {
      // Get user's last known location
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return { isAnomaly: false };
      }

      const userData = userDoc.data();
      const lastLogin = userData?.lastLogin;
      const lastCountry = userData?.lastCountry;
      const lastIP = userData?.lastIP;

      if (!lastLogin || !lastCountry || lastCountry === currentCountry) {
        return { isAnomaly: false };
      }

      // Check time since last login
      const lastLoginDate = lastLogin.toDate?.() || new Date(lastLogin);
      const hoursSinceLastLogin = (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60);

      // If login from different country within 2 hours, flag as anomaly
      if (hoursSinceLastLogin < 2 && lastCountry !== currentCountry) {
        return {
          isAnomaly: true,
          reason: `Login from ${currentCountry} only ${Math.round(hoursSinceLastLogin * 60)} minutes after login from ${lastCountry}`,
        };
      }

      return { isAnomaly: false };
    } catch (error) {
      console.error('[IPReputation] Geo anomaly check error:', error);
      return { isAnomaly: false };
    }
  }

  /**
   * Update user's last known location
   */
  async updateUserLocation(userId: string, ip: string, country: string): Promise<void> {
    try {
      await adminDb.collection('users').doc(userId).update({
        lastIP: ip,
        lastCountry: country,
        lastLogin: new Date(),
      });
    } catch (error) {
      console.error('[IPReputation] Update location error:', error);
    }
  }

  /**
   * Get result from local cache
   */
  private getFromCache(ip: string): IPReputationResult | null {
    const cached = LOCAL_CACHE.get(ip);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, source: 'cache' };
    }
    LOCAL_CACHE.delete(ip);
    return null;
  }

  /**
   * Add result to local cache
   */
  private addToCache(ip: string, result: IPReputationResult): void {
    LOCAL_CACHE.set(ip, {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Cache result to Firestore for persistence
   */
  private async cacheToFirestore(ip: string, result: IPReputationResult): Promise<void> {
    try {
      await adminDb
        .collection('ipReputationCache')
        .doc(ip.replace(/\./g, '_'))
        .set({
          ...result,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        });
    } catch (error) {
      console.error('[IPReputation] Firestore cache error:', error);
    }
  }

  /**
   * Get result from Firestore cache
   */
  private async getFromFirestoreCache(ip: string): Promise<IPReputationResult | null> {
    try {
      const doc = await adminDb
        .collection('ipReputationCache')
        .doc(ip.replace(/\./g, '_'))
        .get();

      if (!doc.exists) return null;

      const data = doc.data();
      if (!data || new Date(data.expiresAt?.toDate?.() || data.expiresAt) < new Date()) {
        // Expired, delete it
        await doc.ref.delete();
        return null;
      }

      return {
        ip: data.ip,
        score: data.score,
        isProxy: data.isProxy,
        isVpn: data.isVpn,
        isTor: data.isTor,
        isDatacenter: data.isDatacenter,
        isBlocked: data.isBlocked,
        country: data.country,
        city: data.city,
        isp: data.isp,
        reasons: data.reasons || [],
        source: 'cache',
        checkedAt: data.checkedAt?.toDate?.() || new Date(data.checkedAt),
      };
    } catch (error) {
      console.error('[IPReputation] Firestore get error:', error);
      return null;
    }
  }

  /**
   * Quick risk check - returns true if IP is high risk
   */
  async isHighRisk(ip: string): Promise<boolean> {
    const result = await this.checkIP(ip);
    return result.score >= 70 || result.isBlocked;
  }

  /**
   * Clear all caches (for testing/admin)
   */
  clearLocalCache(): void {
    LOCAL_CACHE.clear();
  }
}

// Singleton instance
let instance: IPReputationService | null = null;

export function getIPReputationService(): IPReputationService {
  if (!instance) {
    instance = new IPReputationService();
  }
  return instance;
}

export default IPReputationService;
