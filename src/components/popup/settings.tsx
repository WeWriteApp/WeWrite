'use client'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faWarning, faMoon } from '@fortawesome/free-solid-svg-icons';
import Popup from "./simple"
import { useState } from "react";


interface PopupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPopup: React.FC<PopupDialogProps> = ({ isOpen, onClose }) => {

  const [hoverLogout, setHoverLogout] = useState(false)
  const [hoverTheme, setHoverTheme] = useState(false)
  const [hoverProfile, setHoverProfile] = useState(false)

  return (
    <Popup isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-1">
        <div className="flex gap-[10px] items-center p-2 cursor-pointer" onMouseEnter={() => setHoverProfile(true)} onMouseLeave={() => setHoverProfile(false)}>
          <FontAwesomeIcon icon={faGear}  className={` ${hoverProfile ? "text-white" : "text-white/55"}`} />
          <p  className={`${hoverProfile ?"text-white" : "text-white/55"}`} >Profile Settings</p>
        </div>
        <div className="flex gap-[10px] items-center p-2 cursor-pointer" onMouseEnter={() => setHoverTheme(true)} onMouseLeave={() => setHoverTheme(false)}>
          <FontAwesomeIcon icon={faMoon} className={`${hoverTheme ? "text-white" : "text-white/55"}`} />
          <p className={`${hoverTheme ? "text-white" : "text-white/55"}`} >Theme</p>
        </div>
        <div className="flex gap-[10px] items-center p-2 cursor-pointer" onMouseEnter={() => setHoverLogout(true)} onMouseLeave={() => setHoverLogout(false)}>
          <FontAwesomeIcon icon={faWarning} className={` ${hoverLogout ? "text-red-700" : "text-red-700/35"}`} />
          <p className={` ${hoverLogout ? "text-red-700" : "text-red-700/35"} `}>Log out</p>
        </div>
      </div>
    </Popup>
  )
}

export default SettingsPopup