# Background Image System

The WeWrite app supports custom background images with proper database storage and cleanup.

## Features

- **Database Storage**: Background images are stored in Firebase Storage and metadata in Firestore
- **Single Image Management**: Only one background image per user, with automatic cleanup of old images
- **Authentication Required**: Background images are tied to user accounts
- **Automatic Cleanup**: Old images are deleted when new ones are uploaded
- **Glassmorphism Support**: Cards become semi-transparent to show background images
- **Background Blur**: Adjustable blur effect (0-20px) for background images
- **Theme-Aware Loading**: Dark mode shows black loading backgrounds, light mode shows white
- **Persistence**: Background images persist across navigation and page changes

## Architecture

### Database Schema

User documents in Firestore include an optional `backgroundImage` field:

```typescript
interface User {
  // ... other fields
  backgroundImage?: {
    url: string;           // Firebase Storage download URL
    filename: string;      // Original filename for cleanup
    uploadedAt: string;    // ISO timestamp
  };
}
```

### Storage Structure

Background images are stored in Firebase Storage under:
```
backgrounds/{userId}/{filename}
```

### API Endpoints

- `POST /api/upload/background` - Upload new background image
- `GET /api/upload/background` - Get current background image
- `DELETE /api/upload/background` - Remove background image

## Implementation Details

### Upload Process

1. User selects image file (max 10MB, image types only)
2. System deletes any existing background image from Storage
3. New image is uploaded to Firebase Storage
4. User document is updated with new background metadata
5. AppBackgroundContext is updated to display new background

### Display System

The background image system uses CSS custom properties:

- `--background-image`: Set to `url(...)` when image is active
- `--background`: Fallback solid color (theme-aware: black in dark mode, light in light mode)
- `--background-blur`: Blur effect in pixels (0-20px range)

Layout containers with `bg-background` class become transparent when a background image is present.

### Background Blur System

The background blur feature allows users to add a blur effect to their background images:

```css
body {
  filter: blur(var(--background-blur, 0px));
}
```

- **Range**: 0-20px blur
- **Default**: 0px (no blur)
- **Control**: Slider in Appearance settings (0-100% maps to 0-20px)
- **Persistence**: Saved to localStorage and user account

### Context Integration

The `AppBackgroundContext` handles:

- Loading user's background image from database on authentication
- Saving background changes to database (authenticated users) or localStorage (guests)
- Applying CSS variables to display background images
- Managing card opacity for glassmorphism effect

## Usage

### For Authenticated Users

1. Navigate to Settings > Appearance
2. Click "Upload Background Image" 
3. Select image file
4. Image is automatically saved to database
5. Background appears immediately with glassmorphism cards

### For Guest Users

Guest users can still use solid color backgrounds, which are saved to localStorage.

## File Size and Format Limits

- **Maximum Size**: 10MB
- **Supported Formats**: All image types (JPG, PNG, WebP, etc.)
- **Recommended**: High-resolution images work best for full-screen backgrounds

## Cleanup Behavior

- When a new image is uploaded, the old image is automatically deleted from Firebase Storage
- When a user deletes their background, the image is removed from both Storage and database
- No orphaned files are left in Storage

## CSS Implementation

The system uses CSS custom properties and attribute selectors to show/hide backgrounds:

```css
/* Background image is applied to html/body */
html, body {
  background-image: var(--background-image);
  background-size: cover;
  background-attachment: fixed;
}

/* Layout containers become transparent when image is present */
html[style*="--background-image: url"] .bg-background {
  background-color: transparent !important;
}
```

## Security

- All uploads require authentication
- File type validation prevents non-image uploads
- File size limits prevent abuse
- User can only manage their own background image
