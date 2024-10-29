import { Navbar as NUINavbar, NavbarBrand, NavbarContent, NavbarItem, Link, Button, NavbarMenu, NavbarMenuItem, NavbarMenuToggle } from "@nextui-org/react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import Logo from "../Logo";
import Image from "next/image";


const menuItems = [
  {
    label: "Activity",
    path: ""
  },
  {
    label: "Today's note",
    path: ""
  },
  {
    label: "My profile",
    path: ""
  },
  {
    label: "Log Out",
    path: ""
  },
];

const Navbar = () => {
  return (
    <NUINavbar shouldHideOnScroll className="flex" classNames={{ wrapper: "max-w-screen-2xl" }}>
      <NavbarContent justify="start">
        <NavbarMenuToggle className="sm:hidden" />
        <NavbarBrand className="flex gap-[10px]">
          <Logo />
          <p className="font-bold text-inherit">WeWrite</p>
        </NavbarBrand>
      </NavbarContent>
      <NavbarContent className="hidden sm:flex gap-3" justify="center">
        <NavbarItem className="flex items-center gap-[10px] px-[10px] py-[8px]">
          <Image
            alt={'search'}
            height={20}
            width={20}
            src={'/icons/ico-search.svg'}
          />
          <Link color="foreground" href="#">
            Search
          </Link>
        </NavbarItem>
        <NavbarItem className="flex items-center gap-[10px] px-[10px] py-[8px]">
          <Image
            alt={'search'}
            height={20}
            width={20}
            src={'/icons/ico-activity.svg'}
          />
          <Link href="#" color="foreground" >
            Activity
          </Link>
        </NavbarItem>
        <NavbarItem className="flex items-center gap-[10px] px-[10px] py-[8px]">
          <Image
            alt={'search'}
            height={20}
            width={20}
            src={'/icons/ico-calendar.svg'}
          />
          <Link color="foreground" href="#">
            Today's note
          </Link>
        </NavbarItem>
        <NavbarItem className="flex items-center gap-[10px] px-[10px] py-[8px] border bg-white/10 hover:bg-white/15 hover:scale-101 active:scale-99 rounded-xl font-medium cursor-pointer">
          <FontAwesomeIcon icon={faPlus} />
          <Link color="foreground" href="#">
            New page
          </Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarItem className="sm:hidden flex items-center gap-[10px] px-[10px] py-[8px] border bg-white/10 hover:bg-white/15 hover:scale-101 active:scale-99 rounded-xl font-medium cursor-pointer">
        <FontAwesomeIcon icon={faPlus} />
        <Link color="foreground" href="#">
          New page
        </Link>
      </NavbarItem>
      <NavbarMenu>
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item}-${index}`}>
            <Link
              className="w-full"
              color={
                index === 2 ? "warning" : index === menuItems.length - 1 ? "danger" : "foreground"
              }
              href="#"
              size="lg"
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </NUINavbar>
  );
}

export default Navbar