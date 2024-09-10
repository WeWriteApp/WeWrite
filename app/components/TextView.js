import { useEffect, useState } from "react";

const TextView = ({ content }) => {

  const [elements, setElements] = useState(null);

  useEffect(() => {
    if (content) {
      setElements(JSON.parse(content))
      // console.log("content",JSON.parse(content))
    }
  }, [content]);
  
  if (!elements) {
    return null;
  }
  return (
    <div className="page-content fade-in">
      <RenderContent content={elements} />
    </div>
  )
};

const RenderContent = ({ content }) => {
  // Render function for text nodes
  const renderText = (node) => {
    return node.text ? node.text : null;
  };

  // Render function for link nodes
  const renderLink = (node) => {
    return (
      <a href={node.url} key={node.url} className="bg-blue-500 text-white px-4 py-2 rounded-full whitespace-nowrap">
        {node.children.map((child, index) => renderNode(child, index))}
      </a>
    );
  };

  // General render function for all nodes
  const renderNode = (node, index) => {
    let count = 0;
    switch (node.type) {
      case 'link':
        return renderLink(node);
      case 'paragraph':
        return (
          <p key={index} className="text-text">
            <span className="border border-text rounded-full px-2 py-1 mr-2 bg-background text-text text-xs">
            {index + 1}
            </span>
              {node.children.map((child, idx) => renderNode(child, idx))}
          </p>
        );
      default:
        return <span key={index}>{renderText(node)}</span>;
    }
  };
  if (!content || content.length === 0) {
    return null;
  }

  if (content.children ) {
    return content.children.map((child, index) => renderNode(child, index));
  }
  if (!content.children) {
    return content.map((child, index) => renderNode(child, index));
  }
};



export default TextView;
