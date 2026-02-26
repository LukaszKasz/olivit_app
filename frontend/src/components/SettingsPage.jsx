import { useTranslation } from 'react-i18next';

function SettingsPage() {
    const { t } = useTranslation();

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">
                {t('sidebar.settings')}
            </h1>
            <div className="card">
                <p className="text-slate-500">{t('settings.empty')}</p>
            </div>
        </div>
    );
}

export default SettingsPage;
