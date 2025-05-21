import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Custom Document component
 * 
 * This component customizes the HTML document structure for all pages.
 * It ensures that the DOCTYPE declaration is properly set to prevent Quirks Mode.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
