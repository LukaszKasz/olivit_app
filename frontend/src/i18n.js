import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    en: {
        translation: {
            // Common
            "welcome": "Welcome",
            "loading": "Loading...",
            "error": "Error",

            // Navigation
            "signIn": "Sign In",
            "signUp": "Sign Up",
            "logout": "Logout",

            // Login Page
            "login.title": "Welcome Back",
            "login.subtitle": "Sign in to your account",
            "login.username": "Username",
            "login.password": "Password",
            "login.usernamePlaceholder": "Enter your username",
            "login.passwordPlaceholder": "Enter your password",
            "login.button": "Sign In",
            "login.buttonLoading": "Signing in...",
            "login.noAccount": "Don't have an account?",
            "login.errorInvalid": "Login failed. Please check your credentials.",

            // Register Page
            "register.title": "Create Account",
            "register.subtitle": "Sign up to get started",
            "register.username": "Username",
            "register.email": "Email",
            "register.password": "Password",
            "register.confirmPassword": "Confirm Password",
            "register.usernamePlaceholder": "Choose a username",
            "register.emailPlaceholder": "your.email@example.com",
            "register.passwordPlaceholder": "At least 6 characters",
            "register.confirmPasswordPlaceholder": "Repeat your password",
            "register.button": "Sign Up",
            "register.buttonLoading": "Creating account...",
            "register.hasAccount": "Already have an account?",
            "register.errorPasswordMismatch": "Passwords do not match",
            "register.errorPasswordLength": "Password must be at least 6 characters long",
            "register.errorGeneric": "Registration failed. Please try again.",
            "register.successMessage": "Registration successful! Please log in.",

            // Dashboard
            "dashboard.title": "Dashboard",
            "dashboard.subtitle": "Welcome back to your account",
            "dashboard.userInfo": "User Information",
            "dashboard.userId": "User ID:",
            "dashboard.username": "Username:",
            "dashboard.email": "Email:",
            "dashboard.authSuccess": "Authentication Successful",
            "dashboard.authSuccessDesc": "You are successfully logged in with JWT token",
            "dashboard.pocFeatures": "POC Features",
            "dashboard.feature1": "User registration with email validation",
            "dashboard.feature2": "Secure login with JWT authentication",
            "dashboard.feature3": "Protected routes and user session management",
            "dashboard.feature4": "PostgreSQL database integration",
            "dashboard.feature5": "Docker containerization for all services",
            "dashboard.feature6": "Multi-language support (EN/PL)",
            "dashboard.errorLoading": "Failed to load user data",

            // Language Switcher
            "language.english": "English",
            "language.polish": "Polski",
        }
    },
    pl: {
        translation: {
            // Common
            "welcome": "Witaj",
            "loading": "Ładowanie...",
            "error": "Błąd",

            // Navigation
            "signIn": "Zaloguj się",
            "signUp": "Zarejestruj się",
            "logout": "Wyloguj",

            // Login Page
            "login.title": "Witaj ponownie",
            "login.subtitle": "Zaloguj się do swojego konta",
            "login.username": "Nazwa użytkownika",
            "login.password": "Hasło",
            "login.usernamePlaceholder": "Wprowadź nazwę użytkownika",
            "login.passwordPlaceholder": "Wprowadź hasło",
            "login.button": "Zaloguj się",
            "login.buttonLoading": "Logowanie...",
            "login.noAccount": "Nie masz konta?",
            "login.errorInvalid": "Logowanie nie powiodło się. Sprawdź swoje dane.",

            // Register Page
            "register.title": "Utwórz konto",
            "register.subtitle": "Zarejestruj się, aby rozpocząć",
            "register.username": "Nazwa użytkownika",
            "register.email": "Email",
            "register.password": "Hasło",
            "register.confirmPassword": "Potwierdź hasło",
            "register.usernamePlaceholder": "Wybierz nazwę użytkownika",
            "register.emailPlaceholder": "twoj.email@example.com",
            "register.passwordPlaceholder": "Minimum 6 znaków",
            "register.confirmPasswordPlaceholder": "Powtórz hasło",
            "register.button": "Zarejestruj się",
            "register.buttonLoading": "Tworzenie konta...",
            "register.hasAccount": "Masz już konto?",
            "register.errorPasswordMismatch": "Hasła nie są zgodne",
            "register.errorPasswordLength": "Hasło musi mieć co najmniej 6 znaków",
            "register.errorGeneric": "Rejestracja nie powiodła się. Spróbuj ponownie.",
            "register.successMessage": "Rejestracja udana! Zaloguj się.",

            // Dashboard
            "dashboard.title": "Panel",
            "dashboard.subtitle": "Witaj ponownie w swoim koncie",
            "dashboard.userInfo": "Informacje o użytkowniku",
            "dashboard.userId": "ID użytkownika:",
            "dashboard.username": "Nazwa użytkownika:",
            "dashboard.email": "Email:",
            "dashboard.authSuccess": "Uwierzytelnienie pomyślne",
            "dashboard.authSuccessDesc": "Jesteś zalogowany z tokenem JWT",
            "dashboard.pocFeatures": "Funkcje POC",
            "dashboard.feature1": "Rejestracja użytkowników z walidacją email",
            "dashboard.feature2": "Bezpieczne logowanie z uwierzytelnianiem JWT",
            "dashboard.feature3": "Chronione trasy i zarządzanie sesją użytkownika",
            "dashboard.feature4": "Integracja z bazą danych PostgreSQL",
            "dashboard.feature5": "Konteneryzacja Docker dla wszystkich serwisów",
            "dashboard.feature6": "Wsparcie wielojęzyczne (EN/PL)",
            "dashboard.errorLoading": "Nie udało się załadować danych użytkownika",

            // Language Switcher
            "language.english": "English",
            "language.polish": "Polski",
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        debug: false,
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    });

export default i18n;
