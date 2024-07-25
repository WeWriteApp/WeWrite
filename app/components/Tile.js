import React from 'react';

const Tile = ({
  children,
  title
}) => {
  return (
    <div className="bg-white shadow-md rounded-md p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export default Tile;