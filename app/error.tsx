"use client";

import FullPageError from "./components/ui/FullPageError";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <FullPageError
      error={error}
      reset={reset}
      title="Something went wrong"
      message="We're sorry, but there was an error loading this page."
    />
  );
}