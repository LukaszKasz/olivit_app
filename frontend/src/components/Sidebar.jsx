import { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { databaseTransferAPI, tokenManager } from '../api';

function Sidebar({ collapsed, onToggle }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [transferStatus, setTransferStatus] = useState('');
    const [transferBusy, setTransferBusy] = useState(false);

    const handleLogout = () => {
        tokenManager.removeToken();
        navigate('/login');
    };

    const getExportFilename = (headers) => {
        const disposition = headers?.['content-disposition'];
        const match = disposition?.match(/filename="?([^"]+)"?/i);
        return match?.[1] || `olivit-database-export-${new Date().toISOString().slice(0, 10)}.json`;
    };

    const handleExportDatabase = async () => {
        setTransferBusy(true);
        setTransferStatus('');
        try {
            const response = await databaseTransferAPI.exportDatabase();
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = getExportFilename(response.headers);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setTransferStatus('Eksport gotowy.');
        } catch (error) {
            setTransferStatus(error.response?.data?.detail || 'Nie udało się wyeksportować bazy.');
        } finally {
            setTransferBusy(false);
        }
    };

    const handleImportButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportDatabase = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        const confirmed = window.confirm(
            'Import zastąpi aktualną zawartość wszystkich tabel danymi z pliku. Kontynuować?'
        );
        if (!confirmed) return;

        setTransferBusy(true);
        setTransferStatus('');
        try {
            await databaseTransferAPI.importDatabase(file);
            setTransferStatus('Import zakończony.');
        } catch (error) {
            setTransferStatus(error.response?.data?.detail || 'Nie udało się zaimportować bazy.');
        } finally {
            setTransferBusy(false);
        }
    };

    const navLinkClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
        ${isActive
            ? 'bg-primary-600 text-white shadow-md'
            : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'}`;

    const productMenuItems = [
        { to: '/main-products', label: 'Produkty główne' },
        { to: '/main-products/ordered-tests', label: 'Produkty główne / Badania zlecone' },
        { to: '/main-products/archive', label: 'Produkty główne / Archiwum' },
        { to: '/product-variants', label: 'Warianty produktów' },
        { to: '/product-variants/batches/ordered-tests', label: 'Warianty produktów / Partie / Badania zlecone' },
        { to: '/product-variants/finished-product-control', label: 'Warianty produktów / Kontrola produktu gotowego' },
        { to: '/product-variants/batches/archive', label: 'Warianty produktów / Partie / Archiwum' },
    ];

    return (
        <aside
            className={`fixed top-0 left-0 h-screen bg-slate-900 flex flex-col z-50 transition-all duration-300 shadow-xl
                ${collapsed ? 'w-[72px]' : 'w-64'}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
                {!collapsed && (
                    <span className="text-lg font-bold text-white tracking-wide">
                        Olivit zarządzanie jakością
                    </span>
                )}
                <button
                    onClick={onToggle}
                    className={`p-2 rounded-lg text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors ${collapsed ? 'mx-auto' : ''}`}
                    aria-label="Toggle sidebar"
                >
                    <svg className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* Top navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {productMenuItems.map((item) => (
                    <NavLink key={item.to} to={item.to} end className={navLinkClass} title={item.label}>
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                        {!collapsed && <span className="leading-5">{item.label}</span>}
                    </NavLink>
                ))}

                <NavLink to="/settings" end className={navLinkClass} title={t('sidebar.settings')}>
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {!collapsed && <span className="whitespace-nowrap">{t('sidebar.settings')}</span>}
                </NavLink>
            </nav>

            {/* Bottom actions */}
            <div className="px-3 py-4 border-t border-slate-700/50 space-y-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportDatabase}
                />
                <button
                    onClick={handleExportDatabase}
                    disabled={transferBusy}
                    title="Eksport bazy danych"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all duration-200 disabled:opacity-60 disabled:cursor-wait"
                >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    </svg>
                    {!collapsed && <span className="whitespace-nowrap">Eksport bazy</span>}
                </button>
                <button
                    onClick={handleImportButtonClick}
                    disabled={transferBusy}
                    title="Import bazy danych"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-slate-300 hover:bg-sky-500/20 hover:text-sky-300 transition-all duration-200 disabled:opacity-60 disabled:cursor-wait"
                >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21V9m0 0l-4 4m4-4l4 4M4 7V5a2 2 0 012-2h12a2 2 0 012 2v2" />
                    </svg>
                    {!collapsed && <span className="whitespace-nowrap">Import bazy</span>}
                </button>
                {!collapsed && transferStatus && (
                    <p className="px-4 text-xs leading-5 text-slate-400">{transferStatus}</p>
                )}
                <button
                    onClick={handleLogout}
                    title={t('sidebar.logout')}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
                >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {!collapsed && <span className="whitespace-nowrap">{t('sidebar.logout')}</span>}
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;
