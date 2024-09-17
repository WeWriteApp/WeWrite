"use client";
import { PillLink } from "./PillLink";

const GroupPages = ({ pages }) => {
  return (
    <div className="mt-4">
      <h2
        className="text-lg font-semibold"
      >Pages</h2>
      <ul className="space-x-1 flex flex-wrap">
        {
          Object.entries(pages).map(([pageId, page]) => (
            <li
              key={pageId}
              
            >
              <PillLink 
              groupId={page.groupId}
              href={`/pages/${pageId}`} 
              isPublic={page.isPublic}>{page.title}</PillLink>
            </li>
          ))
        }
      </ul>
    </div>
  );
}

export default GroupPages;