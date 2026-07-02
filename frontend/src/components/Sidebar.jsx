import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tokenManager } from '../api';

function Sidebar({ collapsed, onToggle }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleLogout = () => {
        tokenManager.removeToken();
        navigate('/login');
    };

    const navLinkClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
        ${isActive
            ? 'bg-primary-600 text-white shadow-md'
            : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'}`;

    const productMenuSections = [
        {
            title: 'Bull - baza produktów',
            groups: [
                {
                    items: [
                        { to: '/main-products', label: 'Produkty' },
                        { to: '/main-products/ordered-tests', label: 'Badania zlecone' },
                        { to: '/main-products/to-clarify', label: 'Do wyjaśnienia' },
                        { to: '/main-products/to-pack', label: 'Do spakowania' },
                        { to: '/main-products/archive', label: 'Archiwum' },
                    ],
                },
            ],
        },
        {
            title: 'Produkty spakowane',
            groups: [
                {
                    items: [
                        { to: '/product-variants', label: 'Produkty spakowane' },
                        { to: '/product-variants/batches/ordered-tests', label: 'Badania zlecone' },
                        { to: '/product-variants/batches/to-clarify', label: 'Do wyjaśnienia' },
                        { to: '/product-variants/batches/archive', label: 'Badania ukończone' },
                    ],
                },
                {
                    title: 'Kontrola produktu gotowego',
                    items: [
                        { to: '/product-variants/finished-product-control', label: 'Bieżące' },
                        { to: '/product-variants/finished-product-control/incorrect', label: 'Błędne' },
                        { to: '/product-variants/finished-product-control/correct', label: 'Poprawne' },
                    ],
                },
            ],
        },
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
                {productMenuSections.map((section, sectionIndex) => (
                    <div key={section.groups[0].items[0].to} className={sectionIndex > 0 ? 'mt-3 border-t border-slate-700/50 pt-3' : ''}>
                        {!collapsed && section.title ? (
                            <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {section.title}
                            </p>
                        ) : null}
                        {section.groups.map((group) => (
                            <div key={group.title || group.items[0].to} className={!collapsed && group.title ? 'mt-2' : ''}>
                                {!collapsed && group.title ? (
                                    <p className="px-4 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                        {group.title}
                                    </p>
                                ) : null}
                                {group.items.map((item) => (
                                    <NavLink key={item.to} to={item.to} end className={navLinkClass} title={item.label}>
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                                        </svg>
                                        {!collapsed && <span className="leading-5">{item.label}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}

                <div className="mt-3 border-t border-slate-700/50 pt-3">
                    <NavLink to="/settings" end className={navLinkClass} title={t('sidebar.settings')}>
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {!collapsed && <span className="whitespace-nowrap">{t('sidebar.settings')}</span>}
                    </NavLink>
                </div>

                <NavLink to="/brd" end className={navLinkClass} title="BRD">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {!collapsed && <span className="whitespace-nowrap">BRD</span>}
                </NavLink>

                <NavLink to="/asana" end className={navLinkClass} title="Asana">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM6.5 17a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 17a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    </svg>
                    {!collapsed && <span className="whitespace-nowrap">Asana</span>}
                </NavLink>

                <NavLink to="/diagnostics" end className={navLinkClass} title="Diagnostyka">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m3 6V7m3 10v-4m4 8H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z" />
                    </svg>
                    {!collapsed && <span className="whitespace-nowrap">Diagnostyka</span>}
                </NavLink>
            </nav>

            {/* Bottom - Logout */}
            <div className="px-3 py-4 border-t border-slate-700/50">
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
