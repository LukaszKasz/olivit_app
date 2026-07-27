import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AppLayout from './components/AppLayout';
import MainProductsPage from './components/MainProductsPage';
import MainProductOrderedTestsPage from './components/MainProductOrderedTestsPage';
import MenuPlaceholderPage from './components/MenuPlaceholderPage';
import SettingsPage from './components/SettingsPage';
import TableCleanupPage from './components/TableCleanupPage';
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
                                title="Bulk / Baza produktów - Wszystkie"
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
                                title="Bulk / Baza produktów - Zwolnione"
                                description="Widok prezentuje zwolnione produkty główne."
                                viewMode="archive"
                            />
                        }
                    />
                    <Route path="/product-variants" element={<VariantProductsPage />} />
                    <Route
                        path="/product-variants/batches/all"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Produkty spakowane / Warianty - Wszystkie"
                                description="Widok prezentuje wszystkie partie wariantów ze wszystkich statusów badań."
                                viewMode="all"
                            />
                        }
                    />
                    <Route path="/product-variants/batches/ordered-tests" element={<VariantProductBatchOrderedTestsPage />} />
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
                                title="Produkty spakowane / Warianty - Zwolniono"
                                description="Widok prezentuje partie wariantów, które zostały zwolnione."
                                viewMode="released"
                            />
                        }
                    />
                    <Route
                        path="/product-variants/finished-product-control/all"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Kontrola produktu gotowego - Wszystkie"
                                description="Widok prezentuje wszystkie wpisy kontroli produktu gotowego ze wszystkich statusów."
                                enableFinishedProductControl
                                finishedProductControlFilter="all"
                                allowCreateFinishedProductControl={false}
                            />
                        }
                    />
                    <Route
                        path="/product-variants/finished-product-control"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Kontrola produktu gotowego - Bieżące"
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
                                title="Kontrola produktu gotowego - Do wyjaśnienia"
                                description="Widok kontroli produktu gotowego z wykrytymi niezgodnościami."
                                enableFinishedProductControl
                                finishedProductControlFilter="incorrect"
                                allowCreateFinishedProductControl={false}
                            />
                        }
                    />
                    <Route
                        path="/product-variants/finished-product-control/archive"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Kontrola produktu gotowego - Archiwum"
                                description="Archiwalna lista kontroli produktu gotowego."
                                enableFinishedProductControl
                                finishedProductControlFilter="archived"
                                allowCreateFinishedProductControl={false}
                            />
                        }
                    />
                    <Route
                        path="/product-variants/finished-product-control/correct"
                        element={
                            <VariantProductBatchOrderedTestsPage
                                title="Kontrola produktu gotowego - Poprawne"
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
                                title="Produkty spakowane / Warianty - Zwolnione warunkowo"
                                description="Widok prezentuje partie wariantów zwolnione warunkowo."
                                archiveMode
                                archiveFilter="conditional_release"
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
                                archiveFilter="history"
                            />
                        }
                    />
                    <Route
                        path="/product-variants/batches/conditional-release"
                        element={<MenuPlaceholderPage title="Produkty spakowane / Warianty - Zwolnione warunkowo" />}
                    />
                    <Route
                        path="/product-variants/batches/release"
                        element={<MenuPlaceholderPage title="Produkty spakowane / Warianty - Do zwolnienia" />}
                    />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/table-cleanup" element={<TableCleanupPage />} />
                    <Route path="/brd" element={<BrdPage />} />
                    <Route path="/asana" element={<AsanaPage />} />
                    <Route path="/diagnostics" element={<DiagnosticsPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
