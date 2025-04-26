import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("./components/HomePage"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>
  ),
});

export default function Home() {
  return <HomePage />;
}
