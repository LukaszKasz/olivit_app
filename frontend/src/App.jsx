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
import DiagnosticsPage from './components/DiagnosticsPage';
import AsanaPage from './components/AsanaPage';
import BrdPage from './components/BrdPage';
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
                    <Route
                        path="/main-products"
                        element={<MainProductsPage title="Bulk / Baza produktów" />}
                    />
                    <Route
                        path="/main-products/all"
                        element={
                            <MainProductOrderedTestsPage
                                title="Bull - baza produktów - Wszystkie"
                                description="Widok prezentuje wszystkie pozycje produktów głównych wraz z ich aktualnym statusem."
                                viewMode="all"
                            />
                        }
                    />
                    <Route
                        path="/main-products/to-pack"
                        element={
                            <MainProductOrderedTestsPage
                                title="Bulk / Baza produktów - Do spakowania"
                                description="Widok prezentuje produkty główne przekazane do dalszej obsługi i pakowania."
                                viewMode="to_pack"
                            />
                        }
                    />
                    <Route path="/main-products/ordered-tests" element={<MainProductOrderedTestsPage />} />
                    <Route
                        path="/main-products/to-clarify"
                        element={
                            <MainProductOrderedTestsPage
                                title="Bulk / Baza produktów - Do wyjaśnienia"
                                description="Widok prezentuje produkty główne wymagające dodatkowego wyjaśnienia wraz z notatkami."
                                viewMode="to_clarify"
                            />
                        }
                    />
                    <Route
                        path="/main-products/released"
                        element={
                            <MainProductOrderedTestsPage
                                title="Bulk / Baza produktów - Zwolnione"
                                description="Widok prezentuje zwolnione produkty główne."
                                viewMode="released"
                            />
                        }
                    />
                    <Route
                        path="/main-products/archive"
                        element={
                            <MainProductOrderedTestsPage
                                title="Bulk / Baza produktów - Archiwum"
                                description="Widok prezentuje zarchiwizowane produkty główne."
                                viewMode="archive"
                            />
                        }
                    />
                    <Route path="/product-variants" element={<VariantProductsPage />} />
                    <Route path="/product-variants/batches/ordered-tests" element={<VariantProductBatchOrderedTestsPage />} />
                    <Route
                        path="/product-variants/batches/all"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Wszystkie"
                                description="Widok prezentuje wszystkie pozycje wariantów wraz z ich aktualnym statusem."
                                viewMode="all"
                            />
                        }
                    />
                    <Route
                        path="/product-variants/batches/to-clarify"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Do wyjaśnienia"
                                description="Widok prezentuje partie wariantów wymagające dodatkowego wyjaśnienia wraz z notatkami."
                                viewMode="to_clarify"
                            />
                        }
                    />
                    <Route
                        path="/product-variants/batches/released"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Do zwolnienia"
                                description="Widok prezentuje partie wariantów oczekujące na zwolnienie."
                                viewMode="released"
                            />
                        }
                    />
                    <Route
                        path="/product-variants/finished-product-control"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Kontrola produktu gotowego - Bieżące"
                                description="Bieżąca lista zapisanych kontroli produktu gotowego."
                                enableFinishedProductControl
                                finishedProductControlFilter="current"
                            />
                        }
                    />
                    <Route
                        path="/product-variants/finished-product-control/incorrect"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Kontrola produktu gotowego - Błędne"
                                description="Widok kontroli produktu gotowego z wykrytymi niezgodnościami."
                                enableFinishedProductControl
                                finishedProductControlFilter="incorrect"
                                allowCreateFinishedProductControl={false}
                            />
                        }
                    />
                    <Route
                        path="/product-variants/finished-product-control/correct"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Kontrola produktu gotowego - Poprawne"
                                description="Widok kontroli produktu gotowego bez wykrytych niezgodności."
                                enableFinishedProductControl
                                finishedProductControlFilter="correct"
                                allowCreateFinishedProductControl={false}
                            />
                        }
                    />
                    <Route
                        path="/product-variants/batches/archive"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Do zwolnienia warunkowe"
                                description="Widok prezentuje partie wariantów oczekujące na zwolnienie warunkowe."
                                archiveMode
                            />
                        }
                    />
                    <Route
                        path="/product-variants/batches/archive-history"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Archiwum"
                                description="Widok archiwalnych pozycji dla wariantów produktów."
                                archiveMode
                            />
                        }
                    />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/brd" element={<BrdPage />} />
                    <Route path="/asana" element={<AsanaPage />} />
                    <Route path="/diagnostics" element={<DiagnosticsPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
