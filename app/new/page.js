"use client";
import { useContext, useEffect, useState } from "react";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";

const New = () => {
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  return (
    <DashboardLayout>
      <div className="p-4 w-full h-full flex flex-col space-y-4">
        <div>
          <h1 className="text-2xl font-semibold mb-4">New Page</h1>
          <Form Page={Page} setPage={setPage} />
        </div>
      </div>
    </DashboardLayout>
  );
};

const Form = ({ Page, setPage }) => {
  const router = useRouter();
  const [editorState, setEditorState] = useState();
  const { user, loading } = useContext(AuthContext);
  const [attachGeo, setAttachGeo] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);

  const handleSave = async () => {
    let data = {
      ...Page,
      content: JSON.stringify(editorState),
      userId: user.uid,
    };

    const res = await createPage(data);
    if (res) {
      router.push("/pages");
    } else {
      console.log("Error creating page");
    }
  };

  // const getLatLng = () => {
  //   navigator.geolocation.getCurrentPosition((position) => {
  //     setLat(position.coords.latitude);
  //     setLng(position.coords.longitude);
  //   });
  // };

  // useEffect(() => {
  //   if (!attachGeo) {
  //     setLat(null);
  //     setLng(null);
  //   }
  // }, [attachGeo]);

  return (
    <form
      className="w-full flex flex-col space-y-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="text"
        value={Page.title}
        placeholder="Title"
        onChange={(e) => setPage({ ...Page, title: e.target.value })}
        className="border border-gray-300 rounded p-2 w-full"
      />
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={Page.isPublic}
          onChange={(e) => setPage({ ...Page, isPublic: e.target.checked })}
        />
        <label>Public</label>
      </div>

      <SlateEditor setEditorState={setEditorState} />

      {/* <div className="fle flex-col items-center space-x-2">
        <input
          type="checkbox"
          checked={attachGeo}
          onChange={(e) => setAttachGeo(e.target.checked)}
        />
        <label>Attach Geo Location</label>

        {attachGeo && (
          <button
            onClick={getLatLng}
            className="bg-blue-500 text-white rounded p-2"
          >
            Get Location
          </button>
        )}

        {lat && lng && (
          <div>
            <p>Latitude: {lat}</p>
            <p>Longitude: {lng}</p>
          </div>
        )}
      </div> */}

      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={!Page.title || !editorState}
          className={`text-black bg-white rounded-lg border border-gray-500 px-4 py-2 hover:bg-gray-200 transition-colors ${!editorState ? "cursor-not-allowed" : ""}`}
          type="submit"
        >
          Save
        </button>
        <button
          onClick={() => router.push("/pages")}
          className="bg-white text-black px-4 py-2"
        >
          Cancel
        </button>
      </div>

      <pre className="bg-gray-100 p-2 hidden">
        {JSON.stringify(Page, null, 2)}
        {JSON.stringify(editorState, null, 2)}
      </pre>
    </form>
  );
};

export default New;
