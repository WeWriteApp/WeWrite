
import React, { useEffect, useRef } from "react";

interface PopupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: any;
}

const Popup: React.FC<PopupDialogProps> = ({ isOpen, onClose, children }) => {

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`absolute top-14 right-10 p-2 border-white/15 border bg-white/30 rounded-xl backdrop-blur-xl ${!isOpen ? "hidden" : ""} `} ref={modalRef} >
      {children}
    </div>
  )
}

export default Popup