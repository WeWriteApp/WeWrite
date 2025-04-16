# PageLoader Component

A consistent, centered loading spinner component for use throughout the application.

## Usage

```jsx
import { PageLoader } from "./components/ui/page-loader";

// Full-screen loader with message
<PageLoader message="Loading your content..." />

// Inline loader (not full-screen)
<PageLoader fullScreen={false} />

// Custom styling
<PageLoader className="bg-black/50" />
```

## Props

- `message` (optional): Text to display below the spinner
- `fullScreen` (default: true): Whether to display as a full-screen overlay
- `className` (optional): Additional CSS classes to apply to the container

## Examples

### Loading state in a page component

```jsx
function MyPage() {
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Fetch data
    fetchData().then(() => setLoading(false));
  }, []);
  
  if (loading) {
    return <PageLoader message="Loading data..." />;
  }
  
  return <div>My page content</div>;
}
```

### Inline loader in a component

```jsx
function MyComponent() {
  const [loading, setLoading] = useState(true);
  
  if (loading) {
    return (
      <div className="h-40">
        <PageLoader fullScreen={false} />
      </div>
    );
  }
  
  return <div>Component content</div>;
}
```
