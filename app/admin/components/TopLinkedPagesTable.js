"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader, Link } from 'lucide-react';

/**
 * TopLinkedPagesTable Component
 * 
 * A table showing the top linked pages with links and backlinks.
 * 
 * @param {Object} props
 * @param {Array} props.pages - The top linked pages data
 * @param {boolean} props.loading - Whether the data is loading
 */
export default function TopLinkedPagesTable({
  pages = [],
  loading = false
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" />
          <span>Top Linked Pages</span>
        </CardTitle>
        <CardDescription>Pages with the most links pointing to and from them</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Rank</th>
                  <th className="text-left py-2 font-medium">Page Title</th>
                  <th className="text-right py-2 font-medium">Links (In)</th>
                  <th className="text-right py-2 font-medium">Links (Out)</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page, index) => (
                  <tr key={page.id} className="border-b border-border/40 hover:bg-muted/50">
                    <td className="py-2">{index + 1}</td>
                    <td className="py-2">
                      <a href={`/${page.id}`} className="text-primary hover:underline">
                        {page.title}
                      </a>
                    </td>
                    <td className="py-2 text-right">{page.linkCount || 0}</td>
                    <td className="py-2 text-right">{page.backlinkCount || 0}</td>
                  </tr>
                ))}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-4 text-center text-muted-foreground">
                      No linked pages data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
