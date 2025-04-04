import { useContext } from "react";
import { DataContext } from "../providers/DataProvider";

export const Loader = ({ children, show = false, message }) => {
  const { loading } = useContext(DataContext);

  if (show || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <div className="loader loader-lg"></div>
        {message && <p className="mt-4 text-muted-foreground">{message}</p>}
      </div>
    );
  }
  return children;
}
