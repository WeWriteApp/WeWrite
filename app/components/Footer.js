import Link from "next/link";
import { Twitter, Heart, Map, Info, MessageSquare, Github } from 'lucide-react';

/**
 * Footer component for the application.
 * Displays links to various pages and external resources.
 * 
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS classes to apply to the footer
 */
export default function Footer({ className = "" }) {
  const currentYear = new Date().getFullYear();
  
  const footerLinks = [
    { 
      href: "https://x.com/WeWriteApp", 
      label: "X", 
      icon: <Twitter className="h-3 w-3" />,
      external: true 
    },
    { 
      href: "https://github.com/WeWriteApp/WeWrite", 
      label: "GitHub", 
      icon: <Github className="h-3 w-3" />,
      external: true 
    },
    { 
      href: "https://opencollective.com/wewrite-app", 
      label: "Support us", 
      icon: <Heart className="h-3 w-3" />,
      external: true 
    },
    { 
      href: "/pages/zRNwhNgIEfLFo050nyAT", 
      label: "Roadmap", 
      icon: <Map className="h-3 w-3" />,
      external: false 
    },
    { 
      href: "/pages/sUASL4gNdCMVHkr7Qzty", 
      label: "About us", 
      icon: <Info className="h-3 w-3" />,
      external: false 
    },
    { 
      href: "/pages/Kva5XqFpFb2bl5TCZoxE", 
      label: "Feedback", 
      icon: <MessageSquare className="h-3 w-3" />,
      external: false 
    }
  ];
  
  return (
    <footer className={`w-full py-4 px-4 border-t backdrop-blur-sm ${className}`}>
      <div className="container mx-auto flex flex-col items-center">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-4">
          {footerLinks.map((link, index) => (
            <Link 
              key={index}
              href={link.href} 
              target={link.external ? "_blank" : undefined} 
              rel={link.external ? "noopener noreferrer" : undefined}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 group"
            >
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {link.icon}
              </span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground">
          Made with agápē in New York City
        </div>
        
        {/* Add extra padding to ensure content isn't covered by pledge bar */}
        <div className="h-20"></div>
      </div>
    </footer>
  );
}
