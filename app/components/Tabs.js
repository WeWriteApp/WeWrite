import React, {useState} from 'react';

const Tabs = ({ options = [],tab,setTab, align = 'start' }) => {

  let activeClass = "text-blue-500 border-b-2 border-blue-500";

  return (
    <div className={`flex w-full border-gray-200 mt-4 space-x-6 justify-${align}`}>

      {
        options.map((tabName) => (
          <button 
            key={tabName}
            className={`text-lg ${tab === tabName ? activeClass : ""}`}
            onClick={() => setTab(tabName)}
          >
            {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
          </button>
        ))
      }
    </div>
  );
};

export default Tabs;