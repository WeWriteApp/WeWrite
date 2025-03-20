export interface SocialLink {
  platform: 'twitter' | 'youtube' | 'instagram';
  url: string;
  handle: string;
  label: string;
}

export const socialLinks: SocialLink[] = [
  {
    platform: 'twitter',
    url: 'https://x.com/WeWriteApp',
    handle: '@WeWriteApp',
    label: 'Follow on X (Twitter)'
  },
  {
    platform: 'youtube',
    url: 'https://youtube.com/@WeWriteApp',
    handle: '@WeWriteApp',
    label: 'Subscribe on YouTube'
  },
  {
    platform: 'instagram',
    url: 'https://instagram.com/getwewrite',
    handle: '@getwewrite',
    label: 'Follow on Instagram'
  }
]; 