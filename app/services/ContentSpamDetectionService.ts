/**
 * Content Spam Detection Service
 *
 * Analyzes content for spam indicators before publishing.
 * Uses multiple signals including:
 * - Duplicate content detection (hash comparison)
 * - Link analysis (external link limits, suspicious domains)
 * - Keyword filtering (gambling, pharma, crypto scams)
 * - New account restrictions
 *
 * @see app/services/RiskScoringService.ts
 */

import { createHash } from 'crypto';

// Types
export interface SpamCheckResult {
  isSpam: boolean;
  confidence: number; // 0-100
  reasons: string[];
  flags: SpamFlag[];
  action: 'allow' | 'review' | 'block';
}

export interface SpamFlag {
  type: SpamFlagType;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export type SpamFlagType =
  | 'duplicate_content'
  | 'excessive_links'
  | 'suspicious_domain'
  | 'spam_keywords'
  | 'new_account'
  | 'rapid_posting'
  | 'short_content'
  | 'repetitive_patterns'
  | 'hidden_text'
  | 'excessive_caps';

export interface ContentAnalysisInput {
  content: string;
  title?: string;
  userId: string;
  accountAgeDays?: number;
  isEmailVerified?: boolean;
  previousContentHashes?: string[];
}

// Spam keyword categories
const SPAM_KEYWORDS: Record<string, string[]> = {
  gambling: [
    'casino', 'poker', 'slots', 'betting', 'jackpot', 'blackjack',
    'roulette', 'sports betting', 'online gambling', 'free spins',
  ],
  pharma: [
    'viagra', 'cialis', 'pharmacy online', 'cheap meds', 'prescription free',
    'weight loss pills', 'diet pills', 'fat burner', 'muscle gain fast',
  ],
  crypto_scam: [
    'guaranteed returns', 'double your bitcoin', 'free crypto', 'crypto giveaway',
    'send btc', 'airdrop claim', 'nft giveaway', 'pump and dump',
    'get rich quick', 'financial freedom guaranteed',
  ],
  adult: [
    // Keeping this minimal, just flagging obvious patterns
    'xxx', 'adult content', 'nsfw link',
  ],
  phishing: [
    'verify your account', 'suspended account', 'click here immediately',
    'urgent action required', 'your account will be closed',
    'confirm your identity', 'unusual activity detected',
  ],
  mlm: [
    'work from home opportunity', 'be your own boss', 'passive income guaranteed',
    'join my team', 'network marketing', 'downline', 'upline',
  ],
};

// Suspicious domain patterns
const SUSPICIOUS_DOMAIN_PATTERNS = [
  /bit\.ly/i,
  /tinyurl\.com/i,
  /t\.co/i, // Only suspicious in certain contexts
  /goo\.gl/i,
  /is\.gd/i,
  /v\.gd/i,
  /ow\.ly/i,
  /buff\.ly/i,
  // Known spam domains (add as needed)
  /\.(tk|ml|ga|cf|gq)$/i, // Free domains often used for spam
  /click\d+\./i,
  /track\d+\./i,
  /redirect\./i,
];

// Content thresholds
const THRESHOLDS = {
  MIN_CONTENT_LENGTH: 20,
  MAX_LINKS_NEW_ACCOUNT: 1,
  MAX_LINKS_REGULAR: 5,
  MAX_LINKS_TRUSTED: 20,
  MAX_EXTERNAL_LINK_RATIO: 0.3, // External links / word count
  MAX_CAPS_RATIO: 0.3, // Uppercase / total letters
  DUPLICATE_HASH_THRESHOLD: 0.9, // Similarity threshold
  SPAM_KEYWORD_THRESHOLD: 3, // Number of spam keywords to flag
};

export class ContentSpamDetectionService {
  /**
   * Analyze content for spam indicators
   */
  async analyzeContent(input: ContentAnalysisInput): Promise<SpamCheckResult> {
    const flags: SpamFlag[] = [];
    const reasons: string[] = [];
    let spamScore = 0;

    const content = input.content || '';
    const title = input.title || '';
    const fullText = `${title} ${content}`.trim();

    // 1. Check for empty/short content
    if (fullText.length < THRESHOLDS.MIN_CONTENT_LENGTH) {
      flags.push({
        type: 'short_content',
        severity: 'low',
        detail: `Content is very short (${fullText.length} chars)`,
      });
      spamScore += 10;
    }

    // 2. Check for spam keywords
    const keywordResults = this.checkSpamKeywords(fullText);
    if (keywordResults.count > 0) {
      flags.push({
        type: 'spam_keywords',
        severity: keywordResults.count >= THRESHOLDS.SPAM_KEYWORD_THRESHOLD ? 'high' : 'medium',
        detail: `Found ${keywordResults.count} spam keywords in categories: ${keywordResults.categories.join(', ')}`,
      });
      reasons.push(`Contains spam keywords: ${keywordResults.matches.slice(0, 3).join(', ')}`);
      spamScore += Math.min(keywordResults.count * 15, 60);
    }

    // 3. Check link analysis
    const linkResults = this.analyzeLinks(fullText, {
      accountAgeDays: input.accountAgeDays ?? 0,
      isEmailVerified: input.isEmailVerified ?? false,
    });
    if (linkResults.flags.length > 0) {
      flags.push(...linkResults.flags);
      reasons.push(...linkResults.reasons);
      spamScore += linkResults.score;
    }

    // 4. Check for duplicate content
    if (input.previousContentHashes && input.previousContentHashes.length > 0) {
      const contentHash = this.hashContent(content);
      const isDuplicate = input.previousContentHashes.some(
        (hash) => this.calculateSimilarity(hash, contentHash) > THRESHOLDS.DUPLICATE_HASH_THRESHOLD
      );
      if (isDuplicate) {
        flags.push({
          type: 'duplicate_content',
          severity: 'high',
          detail: 'Content appears to be duplicate of previous submission',
        });
        reasons.push('Duplicate content detected');
        spamScore += 40;
      }
    }

    // 5. Check for excessive caps
    const capsResult = this.checkExcessiveCaps(fullText);
    if (capsResult.excessive) {
      flags.push({
        type: 'excessive_caps',
        severity: 'low',
        detail: `${Math.round(capsResult.ratio * 100)}% uppercase letters`,
      });
      spamScore += 10;
    }

    // 6. Check for repetitive patterns
    const repetitionResult = this.checkRepetitivePatterns(fullText);
    if (repetitionResult.isRepetitive) {
      flags.push({
        type: 'repetitive_patterns',
        severity: 'medium',
        detail: repetitionResult.detail,
      });
      reasons.push('Repetitive patterns detected');
      spamScore += 25;
    }

    // 7. New account restrictions
    if (input.accountAgeDays !== undefined && input.accountAgeDays < 7) {
      // More scrutiny for new accounts
      spamScore = Math.round(spamScore * 1.5);
      if (flags.length > 0) {
        flags.push({
          type: 'new_account',
          severity: 'low',
          detail: `Account is ${input.accountAgeDays} days old`,
        });
      }
    }

    // Calculate final result
    const confidence = Math.min(spamScore, 100);
    const isSpam = confidence >= 50;
    const action = this.determineAction(confidence, flags);

    return {
      isSpam,
      confidence,
      reasons,
      flags,
      action,
    };
  }

  /**
   * Check content for spam keywords
   */
  private checkSpamKeywords(text: string): {
    count: number;
    categories: string[];
    matches: string[];
  } {
    const lowerText = text.toLowerCase();
    const matches: string[] = [];
    const categories: Set<string> = new Set();

    for (const [category, keywords] of Object.entries(SPAM_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          matches.push(keyword);
          categories.add(category);
        }
      }
    }

    return {
      count: matches.length,
      categories: Array.from(categories),
      matches,
    };
  }

  /**
   * Analyze links in content
   */
  private analyzeLinks(
    text: string,
    context: { accountAgeDays: number; isEmailVerified: boolean }
  ): { flags: SpamFlag[]; reasons: string[]; score: number } {
    const flags: SpamFlag[] = [];
    const reasons: string[] = [];
    let score = 0;

    // Extract URLs
    const urlRegex = /https?:\/\/[^\s<>\[\]"']+/gi;
    const urls = text.match(urlRegex) || [];

    // Determine link limit based on account trust
    let maxLinks = THRESHOLDS.MAX_LINKS_REGULAR;
    if (context.accountAgeDays < 7) {
      maxLinks = THRESHOLDS.MAX_LINKS_NEW_ACCOUNT;
    } else if (context.accountAgeDays > 90 && context.isEmailVerified) {
      maxLinks = THRESHOLDS.MAX_LINKS_TRUSTED;
    }

    // Check for excessive links
    if (urls.length > maxLinks) {
      flags.push({
        type: 'excessive_links',
        severity: 'medium',
        detail: `${urls.length} links found (limit: ${maxLinks})`,
      });
      reasons.push(`Too many links (${urls.length})`);
      score += 20;
    }

    // Check for suspicious domains
    const suspiciousUrls = urls.filter((url) =>
      SUSPICIOUS_DOMAIN_PATTERNS.some((pattern) => pattern.test(url))
    );

    if (suspiciousUrls.length > 0) {
      flags.push({
        type: 'suspicious_domain',
        severity: 'high',
        detail: `Found ${suspiciousUrls.length} suspicious URLs`,
      });
      reasons.push('Contains suspicious URLs');
      score += 30;
    }

    // Check link-to-content ratio
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    if (wordCount > 0 && urls.length / wordCount > THRESHOLDS.MAX_EXTERNAL_LINK_RATIO) {
      flags.push({
        type: 'excessive_links',
        severity: 'medium',
        detail: 'High link-to-content ratio',
      });
      score += 15;
    }

    return { flags, reasons, score };
  }

  /**
   * Check for excessive capitalization
   */
  private checkExcessiveCaps(text: string): { excessive: boolean; ratio: number } {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 20) {
      return { excessive: false, ratio: 0 };
    }

    const uppercase = letters.replace(/[^A-Z]/g, '').length;
    const ratio = uppercase / letters.length;

    return {
      excessive: ratio > THRESHOLDS.MAX_CAPS_RATIO,
      ratio,
    };
  }

  /**
   * Check for repetitive patterns (copy-paste spam)
   */
  private checkRepetitivePatterns(text: string): { isRepetitive: boolean; detail: string } {
    // Check for repeated phrases
    const words = text.toLowerCase().split(/\s+/);
    const phrases: Map<string, number> = new Map();

    // Check 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (phrase.length > 10) {
        phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
      }
    }

    // Find most repeated phrase
    let maxRepeat = 0;
    let mostRepeated = '';
    for (const [phrase, count] of phrases) {
      if (count > maxRepeat) {
        maxRepeat = count;
        mostRepeated = phrase;
      }
    }

    // Flag if any phrase appears more than 3 times
    if (maxRepeat > 3) {
      return {
        isRepetitive: true,
        detail: `Phrase "${mostRepeated.substring(0, 30)}..." repeated ${maxRepeat} times`,
      };
    }

    // Check for character repetition (aaaaa, !!!!!!)
    const charRepeatPattern = /(.)\1{4,}/g;
    const charRepeats = text.match(charRepeatPattern);
    if (charRepeats && charRepeats.length > 2) {
      return {
        isRepetitive: true,
        detail: 'Excessive character repetition detected',
      };
    }

    return { isRepetitive: false, detail: '' };
  }

  /**
   * Generate hash of content for duplicate detection
   */
  hashContent(content: string): string {
    // Normalize content before hashing
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Calculate similarity between two hashes (using normalized content comparison)
   * Returns 1.0 for identical, 0.0 for completely different
   */
  private calculateSimilarity(hash1: string, hash2: string): number {
    // For now, simple exact match
    // Could implement SimHash or MinHash for fuzzy matching
    return hash1 === hash2 ? 1.0 : 0.0;
  }

  /**
   * Determine action based on spam score
   */
  private determineAction(
    confidence: number,
    flags: SpamFlag[]
  ): 'allow' | 'review' | 'block' {
    // Immediate block for high-severity flags
    const hasHighSeverity = flags.some((f) => f.severity === 'high');
    if (hasHighSeverity && confidence >= 60) {
      return 'block';
    }

    if (confidence >= 70) {
      return 'block';
    }

    if (confidence >= 40) {
      return 'review';
    }

    return 'allow';
  }

  /**
   * Quick check - returns true if content is likely spam
   */
  async quickCheck(content: string, userId: string): Promise<boolean> {
    const result = await this.analyzeContent({ content, userId });
    return result.isSpam;
  }
}

// Singleton instance
let instance: ContentSpamDetectionService | null = null;

export function getContentSpamDetectionService(): ContentSpamDetectionService {
  if (!instance) {
    instance = new ContentSpamDetectionService();
  }
  return instance;
}

export default ContentSpamDetectionService;
