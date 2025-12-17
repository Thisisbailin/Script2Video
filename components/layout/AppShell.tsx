import React from "react";

type Props = {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  isDarkMode?: boolean;
};

export const AppShell: React.FC<Props> = ({ header, sidebar, children, isDarkMode }) => {
  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen flex flex-col`}>
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        {header}
        <main className="flex-1 flex overflow-hidden">
          {sidebar}
          <section className="flex-1 overflow-hidden relative bg-white dark:bg-gray-950">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
};
