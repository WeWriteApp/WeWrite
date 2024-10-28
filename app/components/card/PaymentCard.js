'use client'

import { useContext, useEffect, useState } from "react"
import Input from "../input/DefaultInput"
import Button from "../button/DefaultButton"
import { updateData } from "../../firebase/rtdb"
import { AuthContext } from "../../providers/AuthProvider"
import { DataContext } from "../../providers/DataProvider"

const PaymentCard = (props) => {
  const { setLoading } = useContext(DataContext);
  const { className } = props
  const { user } = useContext(AuthContext);
  const [cardNumber, setCardNumber] = useState("")
  const [EXPDate, setEXPDate] = useState("")
  const [CVC, setCVC] = useState("")


  // Function to format the card number with spaces
  const formatCardNumber = (value) => {
    // Remove all spaces first
    const cleaned = value.replace(/\D/g, '').replace(/\s+/g, '');

    // Add space every 4 characters
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleChange = (e) => {
    const inputValue = e.target.value;
    const formattedCardNumber = formatCardNumber(inputValue);
    setCardNumber(formattedCardNumber);
  };

  const handleChangeEXPDate = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
    if (value.length > 4) {
      value = value.slice(0, 4); // Restrict to MMYY
    }

    if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`; // Insert slash
    }

    setEXPDate(value);
  }

  const handleChangeCVC = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
    if (value.length > 3) {
      value = value.slice(0, 3); // Restrict to MMYY
    }

    setCVC(value)
  }

  const saveChange = async () => {

    if (!user) {
      console.log("User not authenticated");
      return;
    }
    setLoading(true)
    console.log("user", user)

    const paymentMethod = {
      type: "card",
      cardNumber: cardNumber,
      expDate: EXPDate,
      cvc: CVC,
      verified: false
    }

    const result = await updateData(`users/${user.uid}`, { paymentMethod })
    console.log("save result", result)
    setLoading(false)

  };


  useEffect(() => {
    if (user) {
      const paymentMethod = user.paymentMethod
      setCardNumber(paymentMethod.cardNumber)
      setCVC(paymentMethod.cvc)
      setEXPDate(paymentMethod.expDate)
    }
  }, [user])

  return (
    <div className={`${className} rounded-lg border-white border sm:w-fit p-4`}>
      <div className="flex flex-col items-end max-w-xl gap-2">
        <div className="flex flex-col gap-1 w-full">
          <label htmlFor="cardNumber">Card Number:</label>
          <input
            id="cardNumber"
            type="text"
            autoComplete="off"
            value={cardNumber}
            onChange={handleChange}
            maxLength="19" // Max length for a 16-digit card number with spaces
            placeholder="1234 5678 9012 3456"
            className="text-white bg-black border outline-none px-2 py-1 rounded-md"
          />
        </div>
        <div className="flex flex-row w-full gap-1">
          <div className="flex w-full flex-col">
            <label htmlFor="expdate">Expire Date:</label>
            <input
              id="expdate"
              type="text"
              autoComplete="off"
              value={EXPDate}
              onChange={handleChangeEXPDate}
              maxLength={5} // Max length for a 16-digit card expire with / 
              placeholder="MM/YY"
              className="text-white min-w-0 w-full bg-black border mt-1 outline-none px-2 py-1 rounded-md"
              style={{
                minWidth: "0px"
              }}
            />
          </div>
          <div className="flex w-full flex-col">
            <label htmlFor="cvc">CVC:</label>
            <input
              id="cvc"
              type="text"
              autoComplete="off"
              value={CVC}
              onChange={handleChangeCVC}
              placeholder="CVC"
              className="text-white min-w-0 w-full bg-black border mt-1 outline-none px-2 py-1 rounded-md"
              maxLength={3}
            />
          </div>
        </div>
        <Button onClick={saveChange} className="mt-2">Save</Button>
      </div>
    </div>
  )
}

export default PaymentCard