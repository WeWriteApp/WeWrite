export interface OGImageType {
  id: string;
  name: string;
  description: string;
  route: string;
  params?: Record<string, string>;
  usedIn: string[];
  customParams: Record<string, string>;
  section: 'branding' | 'content' | 'user' | 'static' | 'auth' | 'missing';
}
