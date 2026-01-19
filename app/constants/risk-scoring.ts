/**
 * Risk Scoring Constants and Documentation
 *
 * This file provides a single source of truth for risk scoring information
 * used across the app:
 * - Admin RiskAssessmentSection component
 * - Public anti-spam explanation page
 * - API documentation
 */

// Re-export the importance multipliers from the service
export { RISK_FACTOR_IMPORTANCE } from '../services/RiskScoringService';

/**
 * Risk score thresholds
 */
export const RISK_THRESHOLDS = {
  ALLOW: 30,           // 0-30: No challenge required
  SOFT_CHALLENGE: 60,  // 31-60: Invisible challenge
  HARD_CHALLENGE: 85,  // 61-85: Visible challenge required
  BLOCK: 100           // 86-100: Action blocked
} as const;

/**
 * Risk levels and their meanings
 */
export const RISK_LEVELS = {
  allow: {
    label: 'Low Risk',
    color: 'green',
    description: 'Account appears legitimate',
    range: '0-30'
  },
  soft_challenge: {
    label: 'Medium Risk',
    color: 'yellow',
    description: 'Some suspicious signals detected',
    range: '31-60'
  },
  hard_challenge: {
    label: 'High Risk',
    color: 'orange',
    description: 'Multiple suspicious signals detected',
    range: '61-85'
  },
  block: {
    label: 'Very High Risk',
    color: 'red',
    description: 'Account likely automated or spam',
    range: '86-100'
  }
} as const;

/**
 * Risk factor information for documentation
 * Used in both admin UI and public explanation page
 */
export const RISK_FACTOR_INFO = {
  botDetection: {
    icon: 'Bot',
    label: 'Bot Detection',
    description: 'Analyzes browser fingerprint, user agent, and automation indicators to detect automated traffic.',
    publicDescription: 'We check for signs of automated software accessing WeWrite.',
    riskExplanation: '0 = Human behavior detected. Higher scores indicate automated/bot-like patterns.',
    importance: 1
  },
  ipReputation: {
    icon: 'Globe',
    label: 'IP Reputation',
    description: 'Checks for proxy/VPN usage, datacenter IPs, and known malicious addresses.',
    publicDescription: 'We check if the connection is coming from a known proxy or suspicious network.',
    riskExplanation: '0 = Clean IP. Higher scores indicate proxies, VPNs, datacenter IPs, or known bad actors.',
    importance: 1
  },
  accountTrust: {
    icon: 'UserCheck',
    label: 'Account Trust',
    description: 'Evaluates account age, email verification status, and activity history. Also detects PWA spoofing.',
    publicDescription: 'We look at how long you\'ve been a member, whether your email is verified, and your activity history.',
    riskExplanation: '0 = Fully trusted account (verified, old, active). Higher scores indicate new/unverified accounts.',
    importance: 1
  },
  behavioral: {
    icon: 'Activity',
    label: 'Behavioral',
    description: 'Analyzes session patterns, interaction rates, and content velocity for suspicious behavior.',
    publicDescription: 'We analyze usage patterns to detect unusual behavior.',
    riskExplanation: '0 = Normal browsing patterns. Higher scores indicate suspicious automation or rapid activity.',
    importance: 1
  },
  velocity: {
    icon: 'Zap',
    label: 'Velocity',
    description: 'Monitors the rate of actions to detect abuse. Different limits apply based on account trust.',
    publicDescription: 'We check if actions are happening too quickly to be human.',
    riskExplanation: '0 = Normal activity rate. Higher scores indicate excessive actions approaching or exceeding limits.',
    importance: 1
  },
  contentBehavior: {
    icon: 'FileText',
    label: 'Content Behavior',
    description: 'Analyzes page creation patterns, external vs internal links, and content characteristics. High external-to-internal link ratios are suspicious.',
    publicDescription: 'We look at the type of content being created and link patterns. Users with external links but no internal links to other WeWrite pages are flagged as suspicious.',
    riskExplanation: '0 = Good behavior (multiple pages, internal links, no spam links). Higher scores indicate spam patterns (single page, external links without internal links).',
    importance: 1
  },
  financialTrust: {
    icon: 'CreditCard',
    label: 'Financial Trust',
    description: 'Evaluates subscription status and financial activity. Paying users are very unlikely to be bots.',
    publicDescription: 'Subscribers and users who support writers receive much higher trust because spam bots don\'t pay.',
    riskExplanation: '0 = Paying subscriber who supports other writers. Higher scores indicate no financial activity (free accounts with no engagement).',
    importance: 3  // 3x importance - bots don't pay!
  }
} as const;

/**
 * Public-facing explanation of how the anti-spam system works
 */
export const ANTI_SPAM_EXPLANATION = {
  title: 'How WeWrite Protects Against Spam',
  introduction: `WeWrite uses a sophisticated risk scoring system to protect our community from spam and automated abuse while ensuring legitimate users have a great experience.`,

  howItWorks: {
    title: 'How It Works',
    description: `Every account receives a risk score from 0-100 based on multiple factors. This score is calculated as a weighted average, with some factors counting more than others.`,
    keyPoints: [
      'Lower scores (0-30) indicate trusted accounts',
      'Higher scores (31+) may indicate suspicious activity',
      'Financial activity is weighted 3x because spam bots don\'t pay',
      'External links without internal links raise suspicion',
      'The system continuously learns and adapts'
    ]
  },

  factors: {
    title: 'What We Look At',
    description: 'We analyze several signals to determine if an account is legitimate:'
  },

  whatItMeans: {
    title: 'What This Means For You',
    description: `If you're a real person using WeWrite normally, you have nothing to worry about. The system is designed to be invisible to legitimate users while catching automated abuse.`,
    tips: [
      'Verify your email address',
      'Build up your activity history naturally',
      'Consider subscribing to support writers you enjoy',
      'Engage authentically with the community'
    ]
  },

  privacy: {
    title: 'Your Privacy',
    description: `We only use this data for spam prevention. We don't sell your data or share it with third parties. Risk scores are not visible to other users - only to you and our admin team.`
  },

  appeals: {
    title: 'Think There\'s a Mistake?',
    description: `If you believe your account has been incorrectly flagged, please contact us at support@wewrite.app and we'll review your account.`
  }
} as const;

/**
 * Helper function to get risk level from score
 */
export function getRiskLevelFromScore(score: number): keyof typeof RISK_LEVELS {
  if (score <= RISK_THRESHOLDS.ALLOW) return 'allow';
  if (score <= RISK_THRESHOLDS.SOFT_CHALLENGE) return 'soft_challenge';
  if (score <= RISK_THRESHOLDS.HARD_CHALLENGE) return 'hard_challenge';
  return 'block';
}

/**
 * Helper function to get risk color from score
 */
export function getRiskColorFromScore(score: number): string {
  const level = getRiskLevelFromScore(score);
  return RISK_LEVELS[level].color;
}
