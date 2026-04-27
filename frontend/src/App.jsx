import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AppLayout from './components/AppLayout';
import MainProductsPage from './components/MainProductsPage';
import MainProductOrderedTestsPage from './components/MainProductOrderedTestsPage';
import MenuPlaceholderPage from './components/MenuPlaceholderPage';
import SettingsPage from './components/SettingsPage';
import VariantProductsPage from './components/VariantProductsPage';
import VariantProductBatchOrderedTestsPage from './components/VariantProductBatchOrderedTestsPage';
import VariantProductFinishedProductControlPage from './components/VariantProductFinishedProductControlPage';
import { tokenManager } from './api';
import { getAppBasePath } from './appBase';

function ProtectedRoute({ children }) {
    return tokenManager.isAuthenticated() ? children : <Navigate to="/login" />;
}

function App() {
    const basename = getAppBasePath();

    return (
        <Router basename={basename === '/' ? undefined : basename}>
            <Routes>
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm />} />
                <Route
                    element={
                        <ProtectedRoute>
                            <AppLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="/main-products" element={<MainProductsPage />} />
                    <Route path="/main-products/ordered-tests" element={<MainProductOrderedTestsPage />} />
                    <Route path="/main-products/archive" element={<MenuPlaceholderPage title="Produkty główne / Archiwum" />} />
                    <Route path="/product-variants" element={<VariantProductsPage />} />
                    <Route path="/product-variants/batches/ordered-tests" element={<VariantProductBatchOrderedTestsPage />} />
                    <Route path="/product-variants/finished-product-control" element={<VariantProductFinishedProductControlPage />} />
                    <Route
                        path="/product-variants/batches/archive"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Warianty produktów / Partie / Archiwum"
                                description="Dane pobierane z tabeli archiwum partii wariantów w bazie PostgreSQL."
                                archiveMode
                            />
                        }
                    />
                    <Route path="/settings" element={<SettingsPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
