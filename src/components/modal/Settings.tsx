"use client";

import React, { useContext, useState } from "react";
import { Modal, Button, Radio, ModalHeader, ModalBody, RadioGroup, ModalFooter, ModalContent } from "@nextui-org/react";
import { AppContext } from "@/providers/AppProvider";

// Define props for the SettingsModal


// SettingsModal component
const SettingsModal: React.FC = () => {

  const { openSetting, setOpenSetting } = useContext(AppContext)

  const [showThemeOptions, setShowThemeOptions] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>("light");

  // Handlers for navigation within modal
  const handleBackToMain = () => setShowThemeOptions(false);
  const handleOpenThemeOptions = () => setShowThemeOptions(true);

  return (
    <Modal isOpen={openSetting} onOpenChange={setOpenSetting}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Modal Title</ModalHeader>
            <ModalBody>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Nullam pulvinar risus non risus hendrerit venenatis.
                Pellentesque sit amet hendrerit risus, sed porttitor quam.
              </p>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Nullam pulvinar risus non risus hendrerit venenatis.
                Pellentesque sit amet hendrerit risus, sed porttitor quam.
              </p>
              <p>
                Magna exercitation reprehenderit magna aute tempor cupidatat consequat elit
                dolor adipisicing. Mollit dolor eiusmod sunt ex incididunt cillum quis.
                Velit duis sit officia eiusmod Lorem aliqua enim laboris do dolor eiusmod.
                Et mollit incididunt nisi consectetur esse laborum eiusmod pariatur
                proident Lorem eiusmod et. Culpa deserunt nostrud ad veniam.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onPress={onClose}>
                Action
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
    // <Modal isOpen={openSetting} onClose={() => setOpenSetting(false)}>
    //   <ModalHeader>
    //     <h3>{showThemeOptions ? "Select Theme" : "Settings"}</h3>
    //   </ModalHeader>

    //   <ModalBody>
    //     {showThemeOptions ? (
    //       // Theme options view
    //       <div>
    //         <Button onClick={handleBackToMain}>
    //           ← Back
    //         </Button>
    //         <RadioGroup
    //           label="Theme"
    //           value={selectedTheme}
    //           onValueChange={setSelectedTheme}
    //         >
    //           <Radio value="light">Light</Radio>
    //           <Radio value="dark">Dark</Radio>
    //           <Radio value="paper">Paper</Radio>
    //         </RadioGroup>
    //       </div>
    //     ) : (
    //       // Main settings view
    //       <div>
    //         <Button onClick={() => alert("Option 1 clicked")}>
    //           Option 1
    //         </Button>
    //         <Button onClick={handleOpenThemeOptions}>
    //           Theme
    //         </Button>
    //         <Button onClick={() => alert("Option 3 clicked")}>
    //           Option 3
    //         </Button>
    //       </div>
    //     )}
    //   </ModalBody>

    //   <ModalFooter>
    //     <Button onClick={() => setOpenSetting(false)}>
    //       Close
    //     </Button>
    //   </ModalFooter>
    // </Modal>
  );
};

export default SettingsModal;
