import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { integrationSettingsAPI } from '../api';

function SettingsPage() {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [form, setForm] = useState({
        prestashop: {
            base_url: '',
            api_key: '',
        },
        woocommerce: {
            base_url: '',
            consumer_key: '',
            consumer_secret: '',
            verify_ssl: false,
        },
        baselinker: {
            base_url: '',
            api_key: '',
        },
        shopify: {
            base_url: '',
            access_token: '',
            api_key: '',
            api_secret: '',
            verify_ssl: true,
        },
        magento: {
            base_url: '',
            consumer_key: '',
            consumer_secret: '',
            access_token: '',
            access_token_secret: '',
            verify_ssl: true,
        },
    });

    const updateField = (section, field, value) => {
        setForm((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };

    const loadSettings = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const data = await integrationSettingsAPI.getSettings();
            setForm(data);
        } catch (err) {
            setError(err?.response?.data?.detail || t('settings.errorLoad'));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                prestashop: {
                    base_url: form.prestashop.base_url,
                    api_key: form.prestashop.api_key,
                },
                woocommerce: {
                    base_url: form.woocommerce.base_url,
                    consumer_key: form.woocommerce.consumer_key,
                    consumer_secret: form.woocommerce.consumer_secret,
                    verify_ssl: form.woocommerce.verify_ssl,
                },
                baselinker: {
                    base_url: form.baselinker.base_url,
                    api_key: form.baselinker.api_key,
                },
                shopify: {
                    base_url: form.shopify.base_url,
                    access_token: form.shopify.access_token,
                    api_key: form.shopify.api_key,
                    api_secret: form.shopify.api_secret,
                    verify_ssl: form.shopify.verify_ssl,
                },
                magento: {
                    base_url: form.magento.base_url,
                    consumer_key: form.magento.consumer_key,
                    consumer_secret: form.magento.consumer_secret,
                    access_token: form.magento.access_token,
                    access_token_secret: form.magento.access_token_secret,
                    verify_ssl: form.magento.verify_ssl,
                },
            };

            const updated = await integrationSettingsAPI.updateSettings(payload);
            setForm(updated);
            setSuccess(t('settings.saved'));
        } catch (err) {
            setError(err?.response?.data?.detail || t('settings.errorSave'));
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('sidebar.settings')}</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                    {success}
                </div>
            )}

            {loading ? (
                <div className="card">
                    <p className="text-slate-500">{t('loading')}</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <section className="card">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">PrestaShop</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.baseUrl')}</label>
                                <input
                                    className="input-field"
                                    value={form.prestashop.base_url}
                                    onChange={(e) => updateField('prestashop', 'base_url', e.target.value)}
                                    placeholder="https://example.com/api"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.apiKey')}</label>
                                <input
                                    className="input-field"
                                    value={form.prestashop.api_key}
                                    onChange={(e) => updateField('prestashop', 'api_key', e.target.value)}
                                    placeholder="API key"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">WooCommerce</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.baseUrl')}</label>
                                <input
                                    className="input-field"
                                    value={form.woocommerce.base_url}
                                    onChange={(e) => updateField('woocommerce', 'base_url', e.target.value)}
                                    placeholder="https://example.com/wp-json/wc/v3"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.consumerKey')}</label>
                                <input
                                    className="input-field"
                                    value={form.woocommerce.consumer_key}
                                    onChange={(e) => updateField('woocommerce', 'consumer_key', e.target.value)}
                                    placeholder="ck_..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.consumerSecret')}</label>
                                <input
                                    className="input-field"
                                    value={form.woocommerce.consumer_secret}
                                    onChange={(e) => updateField('woocommerce', 'consumer_secret', e.target.value)}
                                    placeholder="cs_..."
                                />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-3">
                                <input
                                    id="woo_verify_ssl"
                                    type="checkbox"
                                    checked={form.woocommerce.verify_ssl}
                                    onChange={(e) => updateField('woocommerce', 'verify_ssl', e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="woo_verify_ssl" className="text-sm text-slate-700">
                                    {t('settings.verifySsl')}
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Baselinker</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.baseUrl')}</label>
                                <input
                                    className="input-field"
                                    value={form.baselinker.base_url}
                                    onChange={(e) => updateField('baselinker', 'base_url', e.target.value)}
                                    placeholder="https://api.baselinker.com/connector.php"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.apiKey')}</label>
                                <input
                                    className="input-field"
                                    value={form.baselinker.api_key}
                                    onChange={(e) => updateField('baselinker', 'api_key', e.target.value)}
                                    placeholder="Baselinker API key"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Shopify</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.baseUrl')}</label>
                                <input
                                    className="input-field"
                                    value={form.shopify.base_url}
                                    onChange={(e) => updateField('shopify', 'base_url', e.target.value)}
                                    placeholder="https://your-store.myshopify.com/admin/api/2025-01"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.accessToken')}</label>
                                <input
                                    className="input-field"
                                    value={form.shopify.access_token}
                                    onChange={(e) => updateField('shopify', 'access_token', e.target.value)}
                                    placeholder="shpat_..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.clientId')}</label>
                                <input
                                    className="input-field"
                                    value={form.shopify.api_key}
                                    onChange={(e) => updateField('shopify', 'api_key', e.target.value)}
                                    placeholder="Shopify app client id"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.clientSecret')}</label>
                                <input
                                    className="input-field"
                                    value={form.shopify.api_secret}
                                    onChange={(e) => updateField('shopify', 'api_secret', e.target.value)}
                                    placeholder="Shopify app client secret"
                                />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-3">
                                <input
                                    id="shopify_verify_ssl"
                                    type="checkbox"
                                    checked={form.shopify.verify_ssl}
                                    onChange={(e) => updateField('shopify', 'verify_ssl', e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="shopify_verify_ssl" className="text-sm text-slate-700">
                                    {t('settings.verifySsl')}
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Magento</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.baseUrl')}</label>
                                <input
                                    className="input-field"
                                    value={form.magento.base_url}
                                    onChange={(e) => updateField('magento', 'base_url', e.target.value)}
                                    placeholder="https://example.com/rest"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.consumerKey')}</label>
                                <input
                                    className="input-field"
                                    value={form.magento.consumer_key}
                                    onChange={(e) => updateField('magento', 'consumer_key', e.target.value)}
                                    placeholder="Magento Consumer Key"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.consumerSecret')}</label>
                                <input
                                    className="input-field"
                                    value={form.magento.consumer_secret}
                                    onChange={(e) => updateField('magento', 'consumer_secret', e.target.value)}
                                    placeholder="Magento Consumer Secret"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.accessToken')}</label>
                                <input
                                    className="input-field"
                                    value={form.magento.access_token}
                                    onChange={(e) => updateField('magento', 'access_token', e.target.value)}
                                    placeholder="Magento admin integration token"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.accessTokenSecret')}</label>
                                <input
                                    className="input-field"
                                    value={form.magento.access_token_secret}
                                    onChange={(e) => updateField('magento', 'access_token_secret', e.target.value)}
                                    placeholder="Magento Access Token Secret"
                                />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-3">
                                <input
                                    id="magento_verify_ssl"
                                    type="checkbox"
                                    checked={form.magento.verify_ssl}
                                    onChange={(e) => updateField('magento', 'verify_ssl', e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="magento_verify_ssl" className="text-sm text-slate-700">
                                    {t('settings.verifySsl')}
                                </label>
                            </div>
                        </div>
                    </section>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                            {saving ? t('settings.saving') : t('settings.save')}
                        </button>
                        <button type="button" className="btn-secondary" onClick={loadSettings} disabled={saving}>
                            {t('settings.reload')}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default SettingsPage;
