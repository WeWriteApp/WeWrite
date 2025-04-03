import { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { PageLoader } from "./ui/page-loader";

export const Loader = ({ children, show = false, message }) => {
  const { loading } = useContext(DataContext);

  if (show || loading) {
    return <PageLoader message={message} fullScreen={true} />;
  }
  return children;
}
