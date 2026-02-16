import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';

interface SocialMediaPreviewsProps {
  lookupPageData: any;
  refreshKey: number;
  buildPreviewUrl: (route: string, params: Record<string, string>) => string;
}

const DEFAULT_PARAMS = {
  title: 'The Future of AI in Education',
  author: 'sarah_chen',
  content: 'Exploring how artificial intelligence is transforming learning experiences for students worldwide.',
  sponsors: '12',
};

export function SocialMediaPreviews({ lookupPageData, refreshKey, buildPreviewUrl }: SocialMediaPreviewsProps) {
  const getImageSrc = () =>
    lookupPageData
      ? `/${lookupPageData.id}/opengraph-image?t=${refreshKey}`
      : buildPreviewUrl('/api/og', DEFAULT_PARAMS);

  const getTitle = () => lookupPageData?.title || DEFAULT_PARAMS.title;
  const getAuthor = () =>
    lookupPageData ? `A page by @${lookupPageData.authorUsername || lookupPageData.username}` : `A page by @${DEFAULT_PARAMS.author}`;

  return (
    <div className="wewrite-card mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Share2" size={20} className="text-muted-foreground" />
        <h3 className="text-lg font-semibold">Social Media Platform Previews</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        See how your OG images appear on different social platforms. {lookupPageData ? `Showing: "${lookupPageData.title}"` : 'Using sample content page. Look up a specific page above to preview it.'}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Twitter/X Preview */}
        <div className="border border-border rounded-xl p-4 bg-[#15202b]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs font-bold text-black">X</div>
            <span className="text-sm font-medium text-white">X / Twitter</span>
            <Badge variant="secondary-static" size="sm" className="ml-auto">Large Card</Badge>
          </div>
          <div className="bg-[#192734] rounded-xl overflow-hidden border border-gray-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={`twitter-preview-${refreshKey}`} src={getImageSrc()} alt="Twitter preview" className="w-full object-cover" style={{ aspectRatio: '1200/628' }} />
            <div className="p-3">
              <p className="text-gray-400 text-xs mb-1">getwewrite.app</p>
              <p className="text-white text-sm font-medium line-clamp-1">{getTitle()}</p>
              <p className="text-gray-400 text-xs line-clamp-2 mt-0.5">{getAuthor()}</p>
            </div>
          </div>
        </div>

        {/* Facebook Preview */}
        <div className="border border-border rounded-xl p-4 bg-[#18191a]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-[#1877f2] flex items-center justify-center text-xs font-bold text-white">f</div>
            <span className="text-sm font-medium text-white">Facebook</span>
          </div>
          <div className="bg-[#242526] rounded-lg overflow-hidden border border-gray-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={`facebook-preview-${refreshKey}`} src={getImageSrc()} alt="Facebook preview" className="w-full object-cover" style={{ aspectRatio: '1200/630' }} />
            <div className="p-3">
              <p className="text-gray-400 text-[11px] uppercase tracking-wide mb-1">GETWEWRITE.APP</p>
              <p className="text-white text-sm font-semibold line-clamp-2">{getTitle()}</p>
              <p className="text-gray-400 text-xs line-clamp-1 mt-1">{getAuthor()}</p>
            </div>
          </div>
        </div>

        {/* Instagram DM Preview */}
        <div className="border border-border rounded-xl p-4 bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-lg bg-white flex items-center justify-center text-xs font-bold text-pink-600">IG</div>
            <span className="text-sm font-medium text-white">Instagram DM</span>
            <Badge variant="secondary-static" size="sm" className="ml-auto bg-white/20 text-white border-white/30">Link Sticker</Badge>
          </div>
          <div className="bg-black/40 backdrop-blur rounded-xl p-3">
            <div className="bg-[#262626] rounded-2xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={`instagram-preview-${refreshKey}`} src={getImageSrc()} alt="Instagram DM preview" className="w-full object-cover" style={{ aspectRatio: '1200/630' }} />
              <div className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{getTitle()}</p>
                  <p className="text-gray-400 text-xs">getwewrite.app</p>
                </div>
                <Icon name="ExternalLink" size={14} className="text-gray-400 shrink-0" />
              </div>
            </div>
          </div>
          <p className="text-white/70 text-xs mt-2 text-center">
            Note: Instagram uses Facebook&apos;s crawler. If images don&apos;t appear, clear cache with Facebook Sharing Debugger.
          </p>
        </div>

        {/* LinkedIn Preview */}
        <div className="border border-border rounded-xl p-4 bg-[#0a66c2]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-white flex items-center justify-center text-xs font-bold text-[#0a66c2]">in</div>
            <span className="text-sm font-medium text-white">LinkedIn</span>
          </div>
          <div className="bg-white rounded-lg overflow-hidden shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={`linkedin-preview-${refreshKey}`} src={getImageSrc()} alt="LinkedIn preview" className="w-full object-cover" style={{ aspectRatio: '1200/628' }} />
            <div className="p-3">
              <p className="text-[#000000e6] text-sm font-semibold line-clamp-2">{getTitle()}</p>
              <p className="text-gray-500 text-xs mt-1">getwewrite.app</p>
            </div>
          </div>
        </div>

        {/* Discord Preview */}
        <div className="border border-border rounded-xl p-4 bg-[#36393f]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-[#5865f2] flex items-center justify-center text-xs font-bold text-white">D</div>
            <span className="text-sm font-medium text-white">Discord</span>
          </div>
          <div className="border-l-4 border-[#5865f2] bg-[#2f3136] rounded-r-lg p-3">
            <p className="text-[#00b0f4] text-xs font-medium mb-1">getwewrite.app</p>
            <p className="text-white text-sm font-semibold mb-2 line-clamp-1">{getTitle()}</p>
            <p className="text-gray-400 text-xs mb-2 line-clamp-2">{getAuthor()}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={`discord-preview-${refreshKey}`} src={getImageSrc()} alt="Discord preview" className="w-full rounded object-cover" style={{ maxWidth: '400px', aspectRatio: '1200/630' }} />
          </div>
        </div>

        {/* Slack Preview */}
        <div className="border border-border rounded-xl p-4 bg-[#1a1d21]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-[#e01e5a] via-[#36c5f0] to-[#2eb67d] flex items-center justify-center text-xs font-bold text-white">#</div>
            <span className="text-sm font-medium text-white">Slack</span>
          </div>
          <div className="border-l-4 border-gray-500 bg-[#222529] rounded-r p-3">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={`slack-preview-${refreshKey}`} src={getImageSrc()} alt="Slack preview" className="w-20 h-20 rounded object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[#1264a3] text-sm font-bold hover:underline cursor-pointer line-clamp-1">{getTitle()}</p>
                <p className="text-gray-400 text-xs line-clamp-2 mt-1">{getAuthor()}</p>
                <p className="text-gray-500 text-xs mt-2">getwewrite.app</p>
              </div>
            </div>
          </div>
        </div>

        {/* iMessage Preview */}
        <div className="border border-border rounded-xl p-4 bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ed] lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-[#34c759] flex items-center justify-center text-xs">💬</div>
            <span className="text-sm font-medium text-gray-800">iMessage / SMS</span>
          </div>
          <div className="max-w-md mx-auto">
            <div className="bg-[#007aff] rounded-2xl rounded-br-md p-3 text-white text-sm inline-block">
              Check out this page!
            </div>
            <div className="mt-2">
              <div className="bg-white rounded-2xl rounded-bl-md overflow-hidden shadow-sm border border-gray-200 inline-block max-w-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={`imessage-preview-${refreshKey}`} src={getImageSrc()} alt="iMessage preview" className="w-full object-cover" style={{ aspectRatio: '1200/630' }} />
                <div className="p-3">
                  <p className="text-gray-900 text-sm font-medium line-clamp-2">{getTitle()}</p>
                  <p className="text-gray-500 text-xs mt-1">getwewrite.app</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debugging Tools */}
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Icon name="Wrench" size={14} className="text-muted-foreground" />
          Debugging Tools
        </h4>
        <div className="flex flex-wrap gap-2">
          <a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1877f2] text-white text-xs rounded-full hover:bg-[#166fe5] transition-colors">
            <span>Facebook Debugger</span>
            <Icon name="ExternalLink" size={12} />
          </a>
          <a href="https://cards-dev.twitter.com/validator" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs rounded-full hover:bg-gray-800 transition-colors">
            <span>Twitter Card Validator</span>
            <Icon name="ExternalLink" size={12} />
          </a>
          <a href="https://www.linkedin.com/post-inspector/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0a66c2] text-white text-xs rounded-full hover:bg-[#004182] transition-colors">
            <span>LinkedIn Inspector</span>
            <Icon name="ExternalLink" size={12} />
          </a>
          <a
            href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(lookupPageData ? `https://www.getwewrite.app/${lookupPageData.id}` : 'https://www.getwewrite.app')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-full hover:bg-primary/90 transition-colors"
          >
            <Icon name="RefreshCw" size={12} />
            <span>Debug {lookupPageData ? 'This Page' : 'Homepage'}</span>
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Use these tools to clear cached OG images and verify your meta tags are correct. Instagram uses Facebook&apos;s crawler, so the Facebook Debugger works for Instagram too.
        </p>
      </div>
    </div>
  );
}
