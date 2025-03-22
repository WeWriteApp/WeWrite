import { useContext } from "react";
import { DataContext } from "../providers/DataProvider";

export const Loader = ({ children, show = false }) => {
  const { loading } = useContext(DataContext);

  if (show || loading) {
    return (
      <div className="flex justify-center items-center h-screen w-full fixed top-0 left-0 bg-background z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  return children;
}
