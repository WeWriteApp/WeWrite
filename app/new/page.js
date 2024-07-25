"use client";
import { useContext, useEffect, useState } from "react";
import Editor from "../components/Editor";
import DashboardLayout from "../DashboardLayout";
import { createDoc } from "../firebase/database";
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
      <div className="container inner-container mx-auto">
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
  const {user, loading} = useContext(AuthContext);
  const [attachGeo, setAttachGeo] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);

  const handleSave = async () => {

    editorState.read(async () => {
      const jsonString = JSON.stringify(editorState.toJSON());

      const doc = {
        title: Page.title,
        isPublic: Page.isPublic,
        content: jsonString,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      };

      if (attachGeo && lat && lng) {
        doc.lat = lat;
        doc.lng = lng;
      }
      let pageId = await createDoc('pages', doc);

      window.alert('Page created successfully');
  
      router.push(`/pages/${pageId}/edit`);
    });
  }

  const getLatLng = () => {
    navigator.geolocation.getCurrentPosition((position) => {
      console.log(position);
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
    });
  }

  useEffect(() => {
    if (!attachGeo) {
      setLat(null);
      setLng(null);
    }
  }, [attachGeo]);

  return (
    <form className="w-full flex flex-col space-y-4" onSubmit={(e) => e.preventDefault()} >
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
      <Editor editorState={editorState} setEditorState={setEditorState} />

      <div className="fle flex-col items-center space-x-2">
        <input
          type="checkbox"
          checked={attachGeo}
          onChange={(e) => setAttachGeo(e.target.checked)}
        />
        <label>Attach Geo Location</label>

        {
          attachGeo && (
            <button onClick={getLatLng} className="bg-blue-500 text-white rounded p-2">Get Location</button>
          )
        }


        {
          lat && lng && (
            <div>
              <p>Latitude: {lat}</p>
              <p>Longitude: {lng}</p>
            </div>
          )
        }
      </div>

      <button 
      onClick={handleSave}
        className="bg-blue-500 text-white rounded p-2 w-full mt-2 "
      type="submit">Save</button>
    </form>
  );
};

export default New;
