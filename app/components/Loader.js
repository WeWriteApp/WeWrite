import { useContext } from "react";
import { DataContext } from "../providers/DataProvider";

export const Loader = ({ children, show = false, message }) => {
  const { loading } = useContext(DataContext);

  if (show || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
        <div className="loader loader-md"></div>
        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }
  return children;
}
