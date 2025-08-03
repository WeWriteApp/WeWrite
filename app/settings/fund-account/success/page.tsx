'use client';

import React from 'react';
import NavPageLayout from '../../../components/layout/NavPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CheckCircle, Home } from 'lucide-react';
import Link from 'next/link';

export default function FundAccountSuccessPage() {

  return (
    <NavPageLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full space-y-6">
          {/* Success message */}
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-2xl text-green-800 dark:text-green-200">
                Success!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-green-700 dark:text-green-300">
                Your account funding has been activated successfully. You can now start supporting creators!
              </p>

              <Button asChild className="w-full">
                <Link href="/">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </NavPageLayout>
  );
}
