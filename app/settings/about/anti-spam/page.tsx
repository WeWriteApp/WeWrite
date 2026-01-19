"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import {
  ANTI_SPAM_EXPLANATION,
  RISK_FACTOR_INFO,
  RISK_LEVELS,
  RISK_FACTOR_IMPORTANCE
} from '../../../constants/risk-scoring';

export default function AntiSpamPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <Link href="/settings/about" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <Icon name="ArrowLeft" size={16} />
          Back to About
        </Link>
        <h1 className="text-2xl font-bold mb-2">{ANTI_SPAM_EXPLANATION.title}</h1>
        <p className="text-muted-foreground">{ANTI_SPAM_EXPLANATION.introduction}</p>
      </div>

      {/* How It Works */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Icon name="Shield" size={20} className="text-primary" />
          {ANTI_SPAM_EXPLANATION.howItWorks.title}
        </h2>
        <p className="text-muted-foreground mb-4">{ANTI_SPAM_EXPLANATION.howItWorks.description}</p>
        <ul className="space-y-2">
          {ANTI_SPAM_EXPLANATION.howItWorks.keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon name="Check" size={16} className="text-green-500 mt-0.5 shrink-0" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Risk Levels */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Icon name="BarChart2" size={20} className="text-primary" />
          Risk Score Levels
        </h2>
        <div className="grid gap-2">
          {(Object.entries(RISK_LEVELS) as [string, typeof RISK_LEVELS[keyof typeof RISK_LEVELS]][]).map(([key, level]) => (
            <div
              key={key}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                level.color === 'green' ? 'bg-green-500/5 border-green-500/20' :
                level.color === 'yellow' ? 'bg-yellow-500/5 border-yellow-500/20' :
                level.color === 'orange' ? 'bg-orange-500/5 border-orange-500/20' :
                'bg-red-500/5 border-red-500/20'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${
                level.color === 'green' ? 'bg-green-500' :
                level.color === 'yellow' ? 'bg-yellow-500' :
                level.color === 'orange' ? 'bg-orange-500' :
                'bg-red-500'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{level.label}</span>
                  <span className="text-xs text-muted-foreground">({level.range})</span>
                </div>
                <p className="text-xs text-muted-foreground">{level.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Factors */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Icon name="Search" size={20} className="text-primary" />
          {ANTI_SPAM_EXPLANATION.factors.title}
        </h2>
        <p className="text-muted-foreground mb-4">{ANTI_SPAM_EXPLANATION.factors.description}</p>
        <div className="space-y-3">
          {(Object.entries(RISK_FACTOR_INFO) as [string, typeof RISK_FACTOR_INFO[keyof typeof RISK_FACTOR_INFO]][]).map(([key, factor]) => (
            <Card key={key} className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon name={factor.icon as any} size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{factor.label}</span>
                    {(RISK_FACTOR_IMPORTANCE as Record<string, number>)[key] > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {(RISK_FACTOR_IMPORTANCE as Record<string, number>)[key]}x importance
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{factor.publicDescription}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* What It Means */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Icon name="User" size={20} className="text-primary" />
          {ANTI_SPAM_EXPLANATION.whatItMeans.title}
        </h2>
        <p className="text-muted-foreground mb-4">{ANTI_SPAM_EXPLANATION.whatItMeans.description}</p>
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Tips for building trust:</h3>
          <ul className="space-y-2">
            {ANTI_SPAM_EXPLANATION.whatItMeans.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Icon name="Lightbulb" size={14} className="text-yellow-500 mt-0.5 shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Privacy */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Icon name="Lock" size={20} className="text-primary" />
          {ANTI_SPAM_EXPLANATION.privacy.title}
        </h2>
        <p className="text-muted-foreground">{ANTI_SPAM_EXPLANATION.privacy.description}</p>
      </section>

      {/* Appeals */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Icon name="HelpCircle" size={20} className="text-primary" />
          {ANTI_SPAM_EXPLANATION.appeals.title}
        </h2>
        <p className="text-muted-foreground mb-4">{ANTI_SPAM_EXPLANATION.appeals.description}</p>
        <Button variant="outline" asChild>
          <a href="mailto:support@wewrite.app">
            <Icon name="Mail" size={16} className="mr-2" />
            Contact Support
          </a>
        </Button>
      </section>

      {/* Back link */}
      <div className="pt-4 border-t">
        <Link href="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Icon name="ArrowLeft" size={16} />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
