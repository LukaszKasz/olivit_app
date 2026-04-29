import { useEffect, useState } from 'react';
import { diagnosticsAPI } from '../api';

function formatDiagnosticsError(err) {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;

    if (status === 404) {
        return 'Endpoint diagnostyki nie istnieje po stronie serwera (404). Najczęściej oznacza to starszy backend na serwerze albo brak przekierowania `/api/system/diagnostics` w reverse proxy.';
    }

    return detail || err.message || 'Nie udało się pobrać diagnostyki systemu.';
}

function StatusBadge({ status }) {
    const normalized = (status || '').toLowerCase();
    const className = normalized === 'ok' || normalized === 'healthy'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : 'bg-red-100 text-red-700 border-red-200';

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${className}`}>
            {status || 'unknown'}
        </span>
    );
}

function MetricCard({ label, value, hint }) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
            {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
        </div>
    );
}

function DiagnosticsPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [diagnostics, setDiagnostics] = useState(null);

    const loadDiagnostics = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError('');

        try {
            const data = await diagnosticsAPI.getSystemDiagnostics();
            setDiagnostics(data);
        } catch (err) {
            setError(formatDiagnosticsError(err));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadDiagnostics();
    }, []);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Diagnostyka systemu</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Podgląd stanu backendu, bazy danych i ostatnich logów aplikacji z poziomu panelu.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => loadDiagnostics(true)}
                    disabled={refreshing}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {refreshing ? 'Odświeżanie...' : 'Odśwież'}
                </button>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <p className="font-semibold">Nie udało się pobrać diagnostyki</p>
                    <p className="mt-1">{error}</p>
                    <p className="mt-2 break-all text-red-800/80">
                        Oczekiwany endpoint: {diagnosticsAPI.getDiagnosticsUrl()}
                    </p>
                </div>
            )}

            {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
                    Ładowanie diagnostyki...
                </div>
            ) : diagnostics ? (
                <div className="space-y-6">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard label="Backend" value={<StatusBadge status={diagnostics.backend_status} />} hint={`Sprawdzone: ${diagnostics.checked_at || '-'}`} />
                        <MetricCard label="Baza danych" value={<StatusBadge status={diagnostics.database?.status} />} hint={diagnostics.database?.url || '-'} />
                        <MetricCard
                            label="Produkty główne"
                            value={diagnostics.products?.main_products_count ?? 0}
                            hint={(diagnostics.products?.main_products_count ?? 0) === 0 ? 'Brak rekordów w tabeli main_products.' : 'Dane dostępne w bazie.'}
                        />
                        <MetricCard
                            label="Warianty produktów"
                            value={diagnostics.products?.variant_products_count ?? 0}
                            hint={(diagnostics.products?.variant_products_count ?? 0) === 0 ? 'Brak rekordów w tabeli variant_products.' : 'Dane dostępne w bazie.'}
                        />
                    </section>

                    <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">Szczegóły połączeń</h2>
                            <dl className="mt-5 space-y-4 text-sm">
                                <div className="grid gap-1 border-b border-slate-100 pb-4">
                                    <dt className="font-semibold text-slate-700">Frontend łączy się z API</dt>
                                    <dd className="break-all text-slate-600">{diagnosticsAPI.getApiBaseUrl()}</dd>
                                </div>
                                <div className="grid gap-1 border-b border-slate-100 pb-4">
                                    <dt className="font-semibold text-slate-700">Baza danych</dt>
                                    <dd className="break-all text-slate-600">{diagnostics.database?.url || '-'}</dd>
                                </div>
                                <div className="grid gap-1 border-b border-slate-100 pb-4">
                                    <dt className="font-semibold text-slate-700">Zalogowany użytkownik</dt>
                                    <dd className="text-slate-600">{diagnostics.auth?.current_user || '-'}</dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="font-semibold text-slate-700">Liczba użytkowników</dt>
                                    <dd className="text-slate-600">{diagnostics.products?.users_count ?? 0}</dd>
                                </div>
                            </dl>

                            {diagnostics.database?.error ? (
                                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    <p className="font-semibold">Błąd połączenia z bazą</p>
                                    <p className="mt-1 break-all">{diagnostics.database.error}</p>
                                </div>
                            ) : null}
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">Ocena sytuacji</h2>
                            <div className="mt-5 space-y-3 text-sm text-slate-600">
                                <p>
                                    Jeśli backend jest `ok`, baza jest `ok`, a licznik produktów wynosi `0`, problemem są najpewniej brakujące dane w bazie lub zły import.
                                </p>
                                <p>
                                    Jeśli frontend nie może pobrać diagnostyki albo log pokazuje błędy `5xx`, problem jest po stronie backendu lub reverse proxy.
                                </p>
                                <p>
                                    Jeśli na tej stronie wszystko jest `ok`, ale lista produktów nadal jest pusta, warto porównać logi requestów dla `/api/main-products` z momentem odświeżenia listy.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">Ostatnie logi aplikacji</h2>
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                            {Array.isArray(diagnostics.recent_logs) && diagnostics.recent_logs.length > 0 ? (
                                <div className="max-h-[520px] overflow-auto">
                                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold">Czas</th>
                                                <th className="px-4 py-3 font-semibold">Poziom</th>
                                                <th className="px-4 py-3 font-semibold">Logger</th>
                                                <th className="px-4 py-3 font-semibold">Komunikat</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                            {diagnostics.recent_logs.map((entry, index) => (
                                                <tr key={`${entry.timestamp}-${index}`}>
                                                    <td className="px-4 py-3 whitespace-nowrap align-top text-slate-500">{entry.timestamp}</td>
                                                    <td className="px-4 py-3 align-top">
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            entry.level === 'WARNING' || entry.level === 'ERROR'
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {entry.level}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-slate-500">{entry.logger}</td>
                                                    <td className="px-4 py-3 align-top break-all">{entry.message}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-4 py-6 text-sm text-slate-500">
                                    Brak wpisów w buforze logów.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            ) : null}
        </div>
    );
}

export default DiagnosticsPage;
