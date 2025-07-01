"use client";

import Button from "./Button";

const Header = () => {
  return (
    <header className="py-4 top-0 w-full z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold text-foreground">WeWrite</div>
        <nav className="space-x-6">
          <a
            href="#"
            className="text-foreground hover:text-muted-foreground border-theme-strong px-2 py-1 rounded-full"
          >
            Home
          </a>
          <a href="#" className="text-foreground hover:text-muted-foreground">
            Features
          </a>
          <a href="#" className="text-foreground hover:text-muted-foreground">
            How it works
          </a>
          <a href="#" className="text-foreground hover:text-muted-foreground">
            Contributing
          </a>
        </nav>
        <div>
          <Button href="/auth/register" text="Get Started" />
        </div>
      </div>
    </header>
  );
};

export default Header;