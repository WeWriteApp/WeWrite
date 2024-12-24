"use client";
import React, { useContext } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Tooltip } from "react-tooltip";
import { DrawerContext } from "../providers/DrawerProvider";
import SubscriptionsTable from "./SubscriptionsTable";

const DonateBar = () => {
  const { setSelected } = useContext(DrawerContext);

  return (
    <div className="flex flex-col mt-8 fixed bottom-0 left-0 p-4 w-full align-items justify-center z-1">
      <div className="flex gap-4 mx-auto bg-slate-50 p-4 rounded">
        <button
          className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
          data-tooltip-id="View"
          data-tooltip-place="top"
          data-tooltip-content={"View History"}
          onClick={() => setSelected(<SubscriptionsTable />)}
        >
          <Icon icon="mdi:eye" width="24" height="24" />
          <Tooltip id="View" place="top" />
        </button>
      </div>
    </div>
  );
};

export default DonateBar;
