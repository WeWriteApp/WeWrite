# Modal Component

A reusable modal component that includes click-outside behavior, ESC key handling, and a consistent design.

## Features

- Click outside to close
- Press ESC key to close
- Optional close button
- Customizable title and footer
- Option to prevent closing on click outside
- Accessible with proper ARIA attributes

## Usage

```jsx
import Modal from "./ui/modal";
import { Button } from "./ui/button";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="My Modal Title"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // Do something
              setIsOpen(false);
            }}>
              Confirm
            </Button>
          </div>
        }
      >
        <p>Modal content goes here</p>
      </Modal>
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | required | Controls whether the modal is visible |
| `onClose` | function | required | Function called when the modal should close |
| `title` | string | undefined | Optional title displayed at the top of the modal |
| `children` | ReactNode | required | Content of the modal |
| `footer` | ReactNode | undefined | Optional footer content, typically contains action buttons |
| `className` | string | undefined | Additional CSS classes to apply to the modal |
| `showCloseButton` | boolean | true | Whether to show the X close button in the top-right corner |
| `preventClickOutside` | boolean | false | If true, clicking outside the modal won't close it |
