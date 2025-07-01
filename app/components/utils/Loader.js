import { useContext } from "react";
import { DataContext } from "../../providers/DataProvider";
import { useControlledAnimation } from "../../hooks/useControlledAnimation";

export const Loader = ({ children, show = false, message, id }) => {
  const { loading } = useContext(DataContext);

  // Generate a unique ID for this loader instance
  const componentId = `loader-${id || message || 'default'}`;

  // Control animation to prevent double rendering effect
  const shouldAnimate = useControlledAnimation(componentId);

  if (show || loading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[50vh] w-full"
        style={{
          // Only animate if this is the first render
          animation: shouldAnimate ? 'fadeIn 0.3s ease-in-out' : 'none'
        }}
      >
        <div className="loader loader-md"></div>
        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }
  return children;
}