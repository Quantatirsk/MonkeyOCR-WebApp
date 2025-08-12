import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import './App.css';

function App() {
  useEffect(() => {
    // Global link click handler - open external links in new tab
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a');
      
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // Check if it's an external link
      const isExternal = href.startsWith('http://') || 
                        href.startsWith('https://') || 
                        href.startsWith('//');
      
      // Check if it's a mailto link (currently not needed but may use later)
      // const isMailto = href.startsWith('mailto:');
      
      // Check if it's an internal anchor link (currently not needed but may use later)
      // const isAnchor = href.startsWith('#');
      
      // Check if it's a relative link (for future use)
      // const isRelative = !isExternal && !isMailto && !isAnchor;
      
      // For external links, ensure they open in new tab
      if (isExternal && !link.target) {
        event.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
      // For mailto links, let default behavior handle it
      // For internal links, let React Router or default behavior handle it
    };
    
    // Add event listener to document
    document.addEventListener('click', handleLinkClick, true);
    
    // Cleanup
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, []);

  return <AppLayout />;
}

export default App;