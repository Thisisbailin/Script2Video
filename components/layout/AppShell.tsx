import React from "react";

type Props = {
  header: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  isDarkMode?: boolean;
};

export const AppShell: React.FC<Props> = ({ header, sidebar, children, isDarkMode }) => {
  const hasSidebar = !!sidebar;
  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen flex flex-col`}>
      <div className="flex flex-col h-screen bg-dot-grid text-[var(--text-primary)] transition-colors duration-300">
        {header}
        <main className="flex-1 flex overflow-hidden relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 md:h-28 bg-gradient-to-b from-[var(--bg-panel)] via-[var(--bg-panel)]/85 to-transparent z-10" />
          {hasSidebar && sidebar}
          <section className="flex-1 overflow-hidden relative bg-dot-grid scroll-pt-24 md:scroll-pt-28">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
};
