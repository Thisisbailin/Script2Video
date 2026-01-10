import React from "react";

type Props = {
  header: React.ReactNode;
  banner?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  isDarkMode?: boolean;
};

export const AppShell: React.FC<Props> = ({ header, banner, sidebar, children, isDarkMode }) => {
  const hasSidebar = !!sidebar;
  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen flex flex-col`}>
      <div className="flex flex-col h-screen bg-dot-grid text-[var(--text-primary)] transition-colors duration-300">
        {header}
        {banner}
        <main className="flex-1 flex overflow-hidden relative">
          {hasSidebar && sidebar}
          <section className="flex-1 overflow-hidden relative bg-dot-grid scroll-pt-24 md:scroll-pt-28">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
};
