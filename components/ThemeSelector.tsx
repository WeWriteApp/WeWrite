<div className="fixed top-0 left-0 bottom-0 w-[280px] bg-background/95 backdrop-blur-md border-r z-[1000] transition-transform duration-300 ease-in-out shadow-xl h-[100vh] overflow-y-auto translate-x-0">
  <div className="flex flex-col h-full p-6">
    <div>
      <h2 className="text-lg font-medium text-foreground mb-2">Theme</h2>
      <div className="space-y-2">
        <label className="flex items-center p-2 rounded-md hover:bg-accent/50 cursor-pointer">
          <input
            type="radio"
            name="theme"
            value="light"
            checked={theme === 'light'}
            onChange={() => setTheme('light')}
            className="mr-2"
          />
          <Sun className="h-4 w-4 mr-2 text-foreground" />
          <span className="text-foreground">Light</span>
        </label>
        
        <label className="flex items-center p-2 rounded-md hover:bg-accent/50 cursor-pointer">
          <input
            type="radio"
            name="theme"
            value="dark"
            checked={theme === 'dark'}
            onChange={() => setTheme('dark')}
            className="mr-2"
          />
          <Moon className="h-4 w-4 mr-2 text-foreground" />
          <span className="text-foreground">Dark</span>
        </label>
        
        <label className="flex items-center p-2 rounded-md hover:bg-accent/50 cursor-pointer">
          <input
            type="radio"
            name="theme"
            value="system"
            checked={theme === 'system'}
            onChange={() => setTheme('system')}
            className="mr-2"
          />
          <Monitor className="h-4 w-4 mr-2 text-foreground" />
          <span className="text-foreground">System</span>
        </label>
      </div>
    </div>

    <div className="mt-6">
      <h2 className="text-lg font-medium text-foreground mb-2">Your Pages</h2>
      <div className="space-y-1">
        {pages.map((page) => (
          <a
            key={page.id}
            href={`/pages/${page.id}`}
            className="block px-3 py-2 rounded-md text-foreground hover:bg-accent/50"
          >
            {page.title}
          </a>
        ))}
      </div>
      
      <button 
        onClick={handleNewPage}
        className="mt-2 flex items-center justify-center w-full py-2 px-4 bg-primary text-primary-foreground rounded-md"
      >
        New page
      </button>
    </div>

    <div className="mt-auto pt-6 border-t border-border">
      <a
        href="/account"
        className="flex items-center px-3 py-2 rounded-md text-foreground hover:bg-accent/50"
      >
        <UserIcon className="h-4 w-4 mr-2" />
        Account
      </a>
      
      <button
        onClick={handleLogout}
        className="flex items-center px-3 py-2 rounded-md text-foreground hover:bg-accent/50 w-full text-left"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Log out
      </button>
    </div>
  </div>
</div> 