import TypeaheadSearch from '../components/TypeaheadSearch';

export const generateMetadata = () => {
  return {
    title: "Sandbox testing",
    description: "Area for testing features of the app"
  }
}

export default function Page() {
  return (
    <div>
      <TypeaheadSearch />
    </div>
  );
}

