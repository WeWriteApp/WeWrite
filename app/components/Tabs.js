import React, { useState } from "react";

const Tabs = ({ children }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="mt-4 md:mt-10">
      {/* Make the tabs scrollable horizontally on mobile */}
      <div className="flex overflow-x-auto whitespace-nowrap">
        {children.map((child, index) => (
          <button
            key={index}
            className={`${
              activeTab === index ? "border border-border" : "border-b border-gray-200"
            } px-4 py-2 whitespace-nowrap`}
            onClick={() => setActiveTab(index)}
          >
            {child.props.label}
          </button>
        ))}
      </div>
      {/* Render the active tab content */}
      <div className="mt-4">
        {children[activeTab]}
      </div>
    </div>
  );
};

export default Tabs;
