import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-1 border border-slate-200">
            <button
                onClick={() => changeLanguage('en')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${i18n.language === 'en'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
            >
                EN
            </button>
            <button
                onClick={() => changeLanguage('pl')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${i18n.language === 'pl'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
            >
                PL
            </button>
        </div>
    );
}

export default LanguageSwitcher;
