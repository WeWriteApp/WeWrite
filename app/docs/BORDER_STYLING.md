# Border Styling Guide

This document outlines the standardized approach to border styling in the WeWrite application.

## Theme-Based Border Classes

We've implemented a set of theme-based border utility classes to ensure consistent border styling across the application. These classes automatically adapt to light and dark modes, and will support additional theme modes in the future.

### Basic Border Classes

- `.border-theme-light` - Light border (20% opacity)
- `.border-theme-medium` - Medium border (40% opacity)
- `.border-theme-strong` - Strong border (60% opacity)
- `.border-theme-solid` - Solid border (100% opacity)

### Border Direction Utilities

- `.border-t-only` - Top border only
- `.border-r-only` - Right border only
- `.border-b-only` - Bottom border only
- `.border-l-only` - Left border only

### Header Border Transition

For smooth header border transitions during scroll:

```jsx
<header className="header-border-transition border-visible">
  {/* Header content */}
</header>
```

When scrolled, remove the `border-visible` class to hide the border smoothly:

```jsx
<header className={`header-border-transition ${isScrolled ? '' : 'border-visible'}`}>
  {/* Header content */}
</header>
```

### Interactive Border Classes

- `.hover-border-light` - Light hover state (30% opacity)
- `.hover-border-medium` - Medium hover state (50% opacity)
- `.hover-border-strong` - Strong hover state (70% opacity)
- `.hover-border-solid` - Solid hover state (100% opacity)

## Usage Examples

### Basic Card with Border

```jsx
<div className="border-theme-medium rounded-lg p-4">
  Card content
</div>
```

### Interactive Card with Hover Effect

```jsx
<div className="border-theme-light hover-border-medium rounded-lg p-4 transition-all duration-200">
  Interactive card content
</div>
```

### Using with Tailwind Classes

```jsx
<div className="border-theme-medium rounded-lg bg-card text-card-foreground p-4">
  Card with background and text colors
</div>
```

## Button Styling

All outline buttons use the theme-based border classes for consistent styling:

```jsx
<Button variant="outline">Outline Button</Button>
```

The primary buttons (default variant) maintain their blue styling with a subtle border:

```jsx
<Button>Primary Button</Button>
```

## Using the interactiveCard Utility

For consistent card styling, use the `interactiveCard` utility function:

```jsx
import { interactiveCard } from "../lib/utils";

<div className={interactiveCard("additional-class")}>
  Card content
</div>
```

## Glass Card and Glass Panel

We also provide specialized glass-effect components:

- `.glass-card` - Card with a subtle glass effect
- `.glass-panel` - Panel with a more pronounced glass effect

These classes also use theme variables for border colors.

## Theme Variables

The border colors are defined using CSS variables in the theme:

```css
:root {
  --border: 215 20% 85%; /* Light mode border */
}

.dark {
  --border: 217.2 32.6% 25%; /* Dark mode border */
}
```

These variables are used by all border utility classes to ensure consistent styling across the application.
