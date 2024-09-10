"use client";
import { AuthContext } from "../providers/AuthProvider";
import { useState, useEffect, useContext } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { PortfolioContext } from "../providers/PortfolioProvider";
import { useRouter } from "next/navigation";
import { DrawerContext } from "../providers/DrawerProvider";
import Image from "next/image";
import { useTheme } from "../providers/ThemeProvider";
import ThemeSwitcher from "./ThemeSwitcher";

export default function Header() {
  const { totalSubscriptionsCost, remainingBalance } =
    useContext(PortfolioContext);
  const { selected, setSelected } = useContext(DrawerContext);
  const { user, loading } = useContext(AuthContext);
  const { theme } = useTheme();
  return (
    <header
      className="top-0 left-0 w-full bg-background text-black px-2 text-center"
      style={{ zIndex: 5 }}
      data-theme={theme}
    >
      <div className="flex justify-between">
        <div className="flex items-center space-x-2">
          <Link href={"/pages"} className="text-xl">
            <Image src="/white.svg" alt="logo" width={32} height={32} />
          </Link>
        </div>
        <div className="flex justify-between">
          <h1 className="text-xl"></h1>
          <NavIcons />
          <div className="flex items-center space-x-4 ml-4">
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}

const NavIcons = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useContext(AuthContext);
  const router = useRouter();
  let navigation = [
    {
      name: "New Page",
      icon: () => {
        return (
          <div className="flex items-center space-x-2 border rounded-lg border-gray-500 px-4 py-2 hover:bg-gray-300 bg-background text-button-text transition-all">
            <span>Add Page </span>
            <Icon icon={"akar-icons:plus"} className="h-4 w-4 text-gray-500" />
          </div>
        );
      },
      onClick: () => {
        router.push("/new");
      },
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

      {user &&
        navigation.map((nav, index) => (
          <button
            href={nav.link}
            key={index}
            className="p-1"
            data-tooltip-id={nav.name}
            data-tooltip-content={nav.name}
            onClick={nav.onClick}
          >
            <nav.icon />
            {/* <Tooltip id={nav.name} /> */}
          </button>
        ))}
        {
          !user && (
            <Link href="/auth/login"  className="flex items-center space-x-2 border rounded-lg border-gray-500 px-4 py-2 hover:bg-gray-300 bg-white transition-all mt-4">
                <span>Login </span>
            </Link>
          )
        }
    </div>
  );
};

