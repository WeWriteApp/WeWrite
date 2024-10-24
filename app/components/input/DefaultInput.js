const Input = (props) => {

  const { value, setValue, label = "input", placeholder = "input", className = { holder: "", input: "", label: "" }, type = "text" } = props

  return (
    <div className={`${className.holder} flex flex-col items-center`}>
      <label className={`${className.holder}`}>{label}</label>
      <input value={value} onChange={(e) => setValue(e.target.value)} className={`${className.input}`} placeholder={placeholder} type={type} />
    </div>
  )
}

export default Input