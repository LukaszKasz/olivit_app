import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../api';
import LanguageSwitcher from './LanguageSwitcher';

function RegisterForm() {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError(t('register.errorPasswordMismatch'));
            return;
        }

        // Validate password length
        if (formData.password.length < 6) {
            setError(t('register.errorPasswordLength'));
            return;
        }

        setLoading(true);

        try {
            await authAPI.register(formData.username, formData.email, formData.password);
            navigate('/login', { state: { message: t('register.successMessage') } });
        } catch (err) {
            setError(
                err.response?.data?.detail || t('register.errorGeneric')
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="absolute top-4 right-4">
                <LanguageSwitcher />
            </div>

            <div className="card max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('register.title')}</h1>
                    <p className="text-slate-600">{t('register.subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                            {t('register.username')}
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            className="input-field"
                            placeholder={t('register.usernamePlaceholder')}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                            {t('register.email')}
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="input-field"
                            placeholder={t('register.emailPlaceholder')}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                            {t('register.password')}
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="input-field"
                            placeholder={t('register.passwordPlaceholder')}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                            {t('register.confirmPassword')}
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="input-field"
                            placeholder={t('register.confirmPasswordPlaceholder')}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full"
                    >
                        {loading ? t('register.buttonLoading') : t('register.button')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-slate-600">
                        {t('register.hasAccount')}{' '}
                        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
                            {t('signIn')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default RegisterForm;
