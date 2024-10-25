
import { useState, useEffect } from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure } from "@nextui-org/react";
import { RadioGroup, Radio } from "@nextui-org/react";
import { Input } from "@nextui-org/input";

const SelectAmountModal = (props) => {

  const { isOpen, onOpen, onOpenChange, action } = props

  const [selected, setSelected] = useState(1);
  const [enable, setEnable] = useState(false)
  const [customAmount, setCustomAmount] = useState("")

  useEffect(() => {
    setEnable(selected === 99)
  }, [selected])

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent className="bg-dark">
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 bg-dark text-white">Deposit</ModalHeader>
            <ModalBody className="bg-transparent w-full">
              <RadioGroup
                label="Select deposit amount"
                value={selected}
                color="primary"
                className="w-full flex flex-col"
                onValueChange={setSelected}
                classNames={{
                  label: "text-white",
                  base: "text-white w-full",
                  wrapper: "text-white w-full"
                }}
              >
                <Radio className="text-white" value={10}>
                  <span className="text-white ">$10 / Month</span>
                </Radio>
                <Radio className="text-white" value={50}><span className="text-white w-full">$50 / Month</span></Radio>
                <Radio className="text-white" value={100}><span className="text-white">$100 / Month</span></Radio>
                <Radio className="text-white" value={300}><span className="text-white">$300 / Month</span></Radio>
                <Radio className="text-white" value={99}><span className="text-white">Custoom</span></Radio>
              </RadioGroup>
              <Input
                value={customAmount}
                onValueChange={setCustomAmount}
                disabled={!enable}
                type="url"
                className={`${enable ? "" : "hidden"}`}
                placeholder="500"
                labelPlacement="outside"
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">$</span>
                  </div>
                }
                endContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">/Month</span>
                  </div>
                }
                classNames={{
                  label: "text-white",
                  base: "text-white",
                  wrapper: "text-white"
                }}
              />
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onPress={() => { onClose(); action(selected === 99 ? customAmount : selected) }}>
                Deposit
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

export default SelectAmountModal