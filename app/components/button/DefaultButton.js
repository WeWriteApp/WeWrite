const Button = (props) => {

  const { children, className, onClick, disabled } = props

  return (
    <button disabled={disabled} className={`${className} bg-blue-600 hover:scale-105 active:scale-100 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded ${
        disabled ? "cursor-not-allowed" : ""
      }`} onClick={onClick}>{children}</button>
  )
}

export default Button