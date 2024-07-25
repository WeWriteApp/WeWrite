"use client";
import { AuthContext } from "../providers/AuthProvider";
import { useState, useEffect, useContext } from "react";
import { Icon } from "@iconify/react";
import { Tooltip } from "react-tooltip";
import Link from "next/link";
import { PortfolioContext } from "../providers/PortfolioProvider";
import { useRouter } from "next/navigation";
import { DrawerContext } from "../providers/DrawerProvider";
import SubscriptionsTable from "./SubscriptionsTable";
import AccountWidget from "./AccountWidget";

export default function Header() {
  const { totalSubscriptionsCost, remainingBalance } =
    useContext(PortfolioContext);
    const {selected, setSelected} = useContext(DrawerContext);
  const { user, loading } = useContext(AuthContext);
  return (
    <header
      className="top-0 left-0 w-full bg-gray-800 text-white p-4 text-center"
      style={{ zIndex: 5 }}
    >
      <div className="flex justify-between">
        <div className="flex items-center space-x-2">
          <Icon icon="bx:bx-menu" className="h-5 w-5 text-gray-500" />
          <Link href={"/pages"} className="text-xl">
            WeWrite
          </Link>
        </div>
        <div className="flex justify-center w-50">{/* <GlobalSearch /> */}</div>
        <div className="flex justify-between">
          <h1 className="text-xl"></h1>
          <NavIcons />
          <VerticalDivider />
          <div className="flex items-center space-x-4 ml-4">
            <button onClick={() => setSelected(<AccountWidget />)}>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm">Balance:</span>
                <span className="text-sm font-semibold">
                  {remainingBalance}
                </span>
              </div>
              <div className="h-6 w-6 rounded-full bg-gray-500"></div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

const NavIcons = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { selected, setSelected } = useContext(DrawerContext);
  const router = useRouter();
  let navigation = [
    {
      name: "New Page",
      icon: "material-symbols:add",
      onClick: () => {
        router.push("/new");
      }
    },
    {
      name: "Messages",
      icon: "bx:bx-message",
      onClick: () => {
        console.log("Messages");
      },
    },
    {
      name: "Notifications",
      icon: "bx:bx-bell",
      onClick: () => {
        console.log("Notifications");
      }
    },
    {
      name: "Subscriptions",
      icon: "bx:bx-bookmark",
      onClick: () => {
        setSelected(<SubscriptionsTable />);
      }
    },
    {
      name: "Settings",
      icon: "bx:bx-cog",
      onClick: () => {
        router.push("/settings");
      }
    },
  ];

  // check if mobile to hide the icons
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsMobile(true);
    }

    // check for resize
    window.addEventListener("resize", () => {
      if (window.innerWidth < 768) {
        setIsMobile(true);
      }
    });

    return () => {
      window.removeEventListener("resize", () => {
        if (window.innerWidth < 768) {
          setIsMobile(true);
        }
      });
    };
  }, []);
  return (
    <div className="flex space-x-4">
      {isMobile && (
        <button className="p-1">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16m-7 6h7"
            ></path>
          </svg>
        </button>
      )}

      {navigation.map((nav, index) => (
        <button
          href={nav.link}
          key={index}
          className="p-1"
          data-tooltip-id={nav.name}
          data-tooltip-content={nav.name}
          onClick={nav.onClick}
        >
          <Icon icon={nav.icon} />
          <Tooltip id={nav.name} />
        </button>
      ))}
      <VerticalDivider />
    </div>
  );
};

const VerticalDivider = () => {
  return <div className="border-l border-gray-600 h-6 mt-1"></div>;
};
