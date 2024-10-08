"use client";
import React, { useState, useEffect } from "react";
import { getVersionsByPageId, setCurrentVersion } from "../firebase/database";

const VersionsList = ({ pageId, currentVersion }) => {
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    getVersionsByPageId(pageId).then((versions) => {
      // sorts versions by createdAt
      versions.sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setVersions(versions);
    });
  }, [pageId]);

  return (
    <div>
      <h2
        className="text-md font-semibold text-text mt-4"
      >Versions</h2>
      <ul>
        {versions.map((version) => (
          <VersionItem
            key={version.id}
            version={version}
            isCurrent={currentVersion === version.id}
          />
        ))}
      </ul>
    </div>
  );
};

const VersionItem = ({ version, isCurrent }) => {
  const handleSetCurrentVersion = async () => {
    let confirm = window.confirm(
      "Are you sure you want to set this version as the current version?"
    );
    if (!confirm) return;
    await setCurrentVersion(version.pageId, version.id);
  };

  return (
    <li>
      <p
        className="text-sm font-semibold text-text"
      >{version.createdAt}</p>
      {/* {isCurrent ? (
        <button className="bg-background text-button-text px-4 py-2">Current version</button>
      ) : (
        <button
          className="bg-background text-button-text border border-gray-500 rounded-lg text-black px-4 py-2 hover:bg-gray-200"
          onClick={handleSetCurrentVersion}
        >
          Set as current version
        </button>
      )} */}
    </li>
  );
};

export default VersionsList;
