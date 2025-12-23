"use client";

import { AdminDataProvider, useAdminData } from '../providers/AdminDataProvider';
import { Icon } from '@/components/ui/Icon';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';

function AdminDataSourceToggle() {
  const { dataSource, setDataSource, isProduction, isHydrated } = useAdminData();

  // Don't render until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return (
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg px-4 py-2 shadow-lg">
        <Icon name="Database" size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Data:</span>
        <Icon name="Loader" className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg px-4 py-2 shadow-lg">
      <Icon name="Database" size={16} className="text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Data:</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${!isProduction ? 'font-medium' : 'text-muted-foreground'}`}>
          DEV
        </span>
        <Switch
          checked={isProduction}
          onCheckedChange={(checked) => setDataSource(checked ? 'production' : 'dev')}
        />
        <span className={`text-sm ${isProduction ? 'font-medium' : 'text-muted-foreground'}`}>
          PROD
        </span>
      </div>
      <Badge variant={isProduction ? 'default' : 'secondary'} className="ml-2">
        {isProduction ? 'Production' : 'Development'}
      </Badge>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminDataProvider>
      <AdminDataSourceToggle />
      <div className="pt-16">
        {children}
      </div>
    </AdminDataProvider>
  );
}
