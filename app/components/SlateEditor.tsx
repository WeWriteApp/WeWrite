return (
  <div className="relative min-h-[300px] p-4 sm:p-6">
    <Slate
      editor={editor}
      value={value}
      onChange={onChange}
    >
      <Editable
        className="min-h-[300px] outline-none prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none"
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        placeholder="Start writing..."
        spellCheck
        autoFocus
      />
      <FloatingToolbar />
    </Slate>
  </div>
) 