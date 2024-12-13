import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useContext } from 'react';
import { DataContext } from '../providers/DataProvider';
import { ReactSearchAutocomplete } from 'react-search-autocomplete';
import { INSERT_CUSTOM_LINK_COMMAND } from './CustomLinkPlugin';

export function LinkDropdownPlugin() {
  const [editor] = useLexicalComposerContext();
  const { pages } = useContext(DataContext);

  const handleSelect = (item) => {
    editor.dispatchCommand(INSERT_CUSTOM_LINK_COMMAND, {
      url: `/pages/${item.id}`,
      text: item.name
    });
  };

  return (
    <div className="absolute z-50 w-64 bg-white shadow-lg rounded-md">
      <ReactSearchAutocomplete
        items={pages}
        onSelect={handleSelect}
        fuseOptions={{ minMatchCharLength: 2 }}
        placeholder="Search for a page..."
      />
    </div>
  );
}
