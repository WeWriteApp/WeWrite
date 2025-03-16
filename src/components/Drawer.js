"use client";
import React, { useState, useEffect, useContext } from "react";
import { DrawerContext } from "../providers/DrawerProvider";
import { MobileContext } from "../providers/MobileProvider";
import { Tooltip } from "react-tooltip";

export const Drawer = ({ children }) => {
  const { isOpen, setIsOpen, selected, setSelected, childDrawerSelection } =
    useContext(DrawerContext);
  const [childDrawerOpen, setChildDrawerOpen] = useState(false);

  const { isMobile } = useContext(MobileContext);
  useEffect(() => {
    const handleClick = (e) => {
      if (e.target.classList.contains("overlay")) {
        setIsOpen(false);
        setSelected(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  // check if escape key is pressed
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSelected(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (selected) {
      setIsOpen(true);
    }
  }, [selected]);

  useEffect(() => {
    if (childDrawerSelection) {
      setChildDrawerOpen(true);
    }
  }, [childDrawerSelection]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed overlay top-0 left-0 h-full w-full overflow-hidden bg-black bg-opacity-20"
          style={{ zIndex: 8 }}
        >
          <div
            style={{
              right: childDrawerOpen ? "64px" : "8px",
            }}
            className={`fixed top-4 bottom-4 transition-all ${
              isMobile ? "w-full" : "w-1/2"
            } bg-gray-50 shadow-xl z-50 overflow-y-scroll`}
          >
            <div className="flex flex-row">
              <div className="flex absolute top-4 right-0">
                <button
                  data-tooltip-id="close"
                  data-tooltip-content="Close"
                  className="bg-gray-100 text-black rounded-lg w-8 h-8 flex items-center justify-center"
                  onClick={() => setIsOpen(false)}
                >
                  &times;
                </button>
                <Tooltip id="close" />
              </div>
              <div className="flex flex-col w-full">
                {/* Render the component passed to selected */}
                {selected}
              </div>
            </div>
          </div>
        </div>
      )}

      <ChildDrawer
        childDrawerOpen={childDrawerOpen}
        setChildDrawerOpen={setChildDrawerOpen}
      />
    </>
  );
};

const ChildDrawer = ({ childDrawerOpen, setChildDrawerOpen }) => {
  const { childDrawerSelection, setChildDrawerSelection } =
    useContext(DrawerContext);
  const { isMobile } = useContext(MobileContext);
  useEffect(() => {
    const handleClick = (e) => {
      if (e.target.classList.contains("bg-opacity-30")) {
        setChildDrawerOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);
  if (!childDrawerSelection) return null;
  return (
    <div
      style={{
        zIndex: 9,
      }}
      className={`fixed top-0 right-0 left-0 h-full w-full bg-black bg-opacity-30 ${
        childDrawerOpen ? "block" : "hidden"
      }`}
    >
      <div
        className={`fixed h-full top-0 transition-all ${
          isMobile ? "w-full" : "w-1/3"
        } bg-gray-50 shadow-lg p-4 overflow-y-scroll right-0 `}
      >
        <div className="flex flex-row">
          <div className="flex justify-end p-4 absolute top-0 right-0">
            <button
              className="bg-gray-300 text-black rounded-full w-8 h-8 flex items-center justify-center"
              onClick={() => setChildDrawerOpen(false)}
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
