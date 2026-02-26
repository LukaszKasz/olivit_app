import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import LanguageSwitcher from './LanguageSwitcher';

function AppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
            <div
                className="transition-all duration-300"
                style={{ marginLeft: sidebarCollapsed ? '72px' : '256px' }}
            >
                <header className="sticky top-0 z-10 flex items-center justify-end h-16 px-6 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
                    <LanguageSwitcher />
                </header>
                <main className="p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default AppLayout;
