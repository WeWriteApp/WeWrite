import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useContext } from 'react';
import { DataContext } from '../providers/DataProvider';
import { ReactSearchAutocomplete } from 'react-search-autocomplete';
import { INSERT_CUSTOM_LINK_COMMAND } from './CustomLinkPlugin';
import { AuthContext } from '../providers/AuthProvider';

export function LinkDropdownPlugin() {
  const [editor] = useLexicalComposerContext();
  const { pages } = useContext(DataContext);
  const { user } = useContext(AuthContext);

  console.log('LinkDropdownPlugin: Rendering with pages:', pages);
  console.log('LinkDropdownPlugin: Current user:', user);

  const filteredPages = pages.filter(page => {
    if (!user || !user.groups) return false;
    return user.groups.includes(page.groupId);
  });

  const handleSelect = (item) => {
    editor.dispatchCommand(INSERT_CUSTOM_LINK_COMMAND, {
      url: `/pages/${item.id}`,
      text: item.name
    });
  };

  return (
    <div className="absolute z-50 w-64 bg-white shadow-lg rounded-md">
      <ReactSearchAutocomplete
        items={filteredPages}
        onSelect={handleSelect}
        fuseOptions={{ minMatchCharLength: 2 }}
        placeholder="Search for a page..."
        styling={{
          zIndex: 50,
          borderRadius: '0.375rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}
      />
    </div>
  );
}
