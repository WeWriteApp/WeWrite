# Drawer Component

## Overview

The Drawer component provides a mobile-first bottom sheet interface with native-like slide-up animations and drag-to-dismiss functionality. It's built on top of Radix UI Dialog primitives and integrates seamlessly with WeWrite's card system.

## Features

- **Slide-up Animation**: Smooth slide-in from bottom with proper easing
- **Drag-to-Dismiss**: Touch-friendly drag down gesture to close
- **Card Integration**: Uses WeWrite card system with configurable opacity
- **Responsive Height**: Configurable height (default 85vh)
- **Accessibility**: Full keyboard navigation and screen reader support
- **Touch Optimized**: Optimized for mobile touch interactions
- **URL Hash Tracking**: Optional URL hash updates for analytics and deep linking
- **Analytics Integration**: Built-in analytics tracking for drawer open/close events
- **Body Scroll Lock**: Prevents background scrolling when drawer is open

## Usage

### Basic Usage

```tsx
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../ui/drawer';

function MyDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>My Drawer</DrawerTitle>
        </DrawerHeader>
        
        <div className="flex-1 p-4">
          {/* Your content here */}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

### With Custom Height and Opacity

```tsx
<Drawer open={isOpen} onOpenChange={setIsOpen}>
  <DrawerContent height="70vh" className="card-80">
    <DrawerHeader>
      <DrawerTitle>Custom Drawer</DrawerTitle>
    </DrawerHeader>
    
    <div className="flex-1 p-4">
      {/* Content */}
    </div>
  </DrawerContent>
</Drawer>
```

## Components

### Drawer
The root component that manages the drawer state.

**Props:**
- `open: boolean` - Controls drawer visibility
- `onOpenChange: (open: boolean) => void` - Called when drawer state changes
- `hashId?: string` - Hash ID to add to URL when drawer is open (e.g., "checkout" → `#checkout`)
- `analyticsId?: string` - Analytics ID for tracking drawer open/close events

### DrawerContent
The main drawer container with slide animations and drag functionality.

**Props:**
- `height?: string` - Drawer height (default: "85vh")
- `className?: string` - Additional CSS classes (supports card-n opacity classes)
- `children: ReactNode` - Drawer content

### DrawerHeader
Header section with consistent spacing and typography.

**Props:**
- `className?: string` - Additional CSS classes
- `children: ReactNode` - Header content

### DrawerTitle
Accessible title component for the drawer.

**Props:**
- `className?: string` - Additional CSS classes
- `children: ReactNode` - Title text

## Drag Behavior

The drawer supports intuitive drag-to-dismiss:

1. **Touch Start**: Begins tracking drag position
2. **Touch Move**: Follows finger movement (only allows downward drag)
3. **Touch End**: 
   - If dragged > 100px down: Closes drawer
   - If dragged < 100px down: Snaps back to original position

## Card System Integration

The drawer integrates with WeWrite's card opacity system:

```tsx
{/* Different opacity levels */}
<DrawerContent className="card-100">  {/* Fully opaque */}
<DrawerContent className="card-80">   {/* 80% opacity */}
<DrawerContent className="card-60">   {/* 60% opacity */}
```

## Styling

The drawer uses WeWrite's card system by default:

- **Background**: `wewrite-card card-100` (fully opaque)
- **Border**: Top border with theme-aware color
- **Shadow**: Elevated shadow for depth
- **Blur**: Backdrop blur for glassmorphism effect

## Animation Details

- **Slide In**: `slide-in-from-bottom` with 500ms duration
- **Slide Out**: `slide-out-to-bottom` with 300ms duration
- **Easing**: `ease-in-out` for smooth transitions
- **Drag Response**: Real-time transform following touch position

## Accessibility

- **ARIA Labels**: Proper dialog labeling
- **Focus Management**: Traps focus within drawer
- **Keyboard Navigation**: ESC key closes drawer
- **Screen Readers**: Announces drawer state changes

## Mobile Optimization

- **Touch Targets**: Large drag handle for easy interaction
- **Gesture Recognition**: Native-like drag behavior
- **Performance**: Hardware-accelerated animations
- **Safe Areas**: Respects mobile safe areas

## Best Practices

1. **Use for Mobile**: Primarily designed for mobile interfaces
2. **Appropriate Height**: Use 85vh for full content, 70vh for focused tasks
3. **Card Opacity**: Use card-100 for important content, lower opacity for overlays
4. **Content Structure**: Always include DrawerHeader for accessibility
5. **Drag Handle**: The built-in drag handle provides clear affordance

## URL Hash Tracking

The drawer supports optional URL hash tracking for analytics and deep linking:

```tsx
<Drawer
  open={isOpen}
  onOpenChange={setIsOpen}
  hashId="checkout"  // URL becomes #checkout when open
>
  <DrawerContent>
    {/* Content */}
  </DrawerContent>
</Drawer>
```

**Behavior:**
- When drawer opens: URL updates to `#checkout` (using `replaceState` to avoid history pollution)
- When drawer closes: URL hash is restored to previous value
- Browser back button: Closes the drawer if hash changes

## Analytics Integration

Built-in analytics tracking for drawer open/close events:

```tsx
<Drawer
  open={isOpen}
  onOpenChange={setIsOpen}
  analyticsId="subscription_checkout"
>
  <DrawerContent>
    {/* Content */}
  </DrawerContent>
</Drawer>
```

**Events tracked:**
- `drawer_opened` with label = analyticsId
- `drawer_closed` with label = analyticsId

## Body Scroll Lock

The drawer automatically prevents background scrolling when open:

- Body position is fixed when drawer opens
- Scroll position is preserved and restored on close
- `data-drawer-open="true"` attribute is added to body for CSS targeting

## Example: Link Editor Modal

```tsx
// Mobile drawer implementation with hash and analytics
if (isMobile) {
  return (
    <Drawer
      open={isOpen}
      onOpenChange={onClose}
      hashId="link-editor"
      analyticsId="link_editor"
    >
      <DrawerContent height="85vh" className="card-100">
        <DrawerHeader>
          <DrawerTitle>Insert Link</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
          <LinkEditorContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

This creates a native-feeling bottom sheet that slides up smoothly, can be dismissed with a downward drag gesture, and tracks analytics events while showing `#link-editor` in the URL.
