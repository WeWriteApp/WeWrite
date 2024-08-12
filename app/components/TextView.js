import { useEffect, useState } from "react";

const TextView = ({ content }) => {
  const elements = JSON.parse(content);
  
  
  return (
    <div className="page-content">
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
      <a href={node.url} key={node.url} className="bg-blue-500 text-white px-4 py-2 rounded-full">
        {node.children.map((child, index) => renderNode(child, index))}
      </a>
    );
  };

  // General render function for all nodes
  const renderNode = (node, index) => {
    switch (node.type) {
      case 'link':
        return renderLink(node);
      case 'paragraph':
        return (
          <p key={index}>
            {node.children.map((child, idx) => renderNode(child, idx))}
            <br /> {/* Optional: Adding line breaks for each paragraph */}
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
