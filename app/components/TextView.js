import { useEffect, useState } from "react";

const TextView = ({ content }) => {
  const [elements, setElements] = useState([]);

  useEffect(() => {
    if (!content) return;
    let els = content.children.map((child) => {
      return {
        type: child.type,
        children: child.children
      }
    });

    setElements(els);

    console.log(els);
  }, [content]);
  
  return (
    <>
      {
        elements.length > 0 && (
          <div>
            {elements.map((element, index) => (
              <Element key={index} {...element} />
            ))}
          </div>
        )
      }
    </>
  )
};

const Element = ({ type, children }) => {
  console.log(type, children);
  // if children has children, recursively render them
  if (children) {
    return (
      <div>
        {
        children && children.map((child, index) => {
          switch (child.type) {
            case "text":
              return <span key={index}>{child.text}</span>
            case "linebreak":
              return <br key={index} />
            default:
              return null;
          }
        })}
      </div>
    );
  }
}


export default TextView;
