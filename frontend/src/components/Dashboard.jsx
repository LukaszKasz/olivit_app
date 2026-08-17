import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mainProductsAPI, variantProductsAPI } from '../api';

const EMPTY_DATA = {
    mainProducts: [],
    mainOrders: [],
    variantProductsTotal: 0,
    batchOrders: [],
    finishedControls: [],
};

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function countBy(items, field, fallback) {
    return items.reduce((result, item) => {
        const key = item[field] || fallback;
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}

function GaugeCard({ title, value, total, color, description, href, inverse = false }) {
    const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
    const statusText = total > 0 ? `${percentage}%` : 'brak danych';

    return (
        <Link
            to={href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
        >
            <div className="flex min-h-[3rem] items-start justify-between gap-3">
                <h2 className="text-sm font-semibold leading-5 text-slate-800">{title}</h2>
                <span className="text-slate-300 transition group-hover:text-slate-500" aria-hidden="true">→</span>
            </div>

            <div className="relative mx-auto mt-3 h-28 max-w-[220px]">
                <svg className="h-full w-full" viewBox="0 0 200 112" role="img" aria-label={`${title}: ${value} z ${total}`}>
                    <path
                        d="M 18 100 A 82 82 0 0 1 182 100"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="18"
                        strokeLinecap="round"
                        pathLength="100"
                    />
                    <path
                        d="M 18 100 A 82 82 0 0 1 182 100"
                        fill="none"
                        stroke={color}
                        strokeWidth="18"
                        strokeLinecap="round"
                        pathLength="100"
                        strokeDasharray={`${percentage} 100`}
                        className="transition-all duration-700"
                    />
                </svg>
                <div className="absolute inset-x-0 bottom-0 text-center">
                    <p className="text-3xl font-bold tabular-nums text-slate-900">{value}</p>
                    <p className="text-xs font-medium text-slate-500">z {total} · {statusText}</p>
                </div>
            </div>

            <p className={`mt-4 text-center text-xs leading-5 ${inverse ? 'text-rose-600' : 'text-slate-500'}`}>
                {description}
            </p>
        </Link>
    );
}

function SummaryCard({ label, value, href, accentClass }) {
    return (
        <Link to={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <div className="flex items-center gap-4">
                <span className={`h-10 w-1.5 rounded-full ${accentClass}`} />
                <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                </div>
            </div>
        </Link>
    );
}

function Dashboard() {
    const [data, setData] = useState(EMPTY_DATA);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError('');

        const requests = [
            mainProductsAPI.getProducts(),
            mainProductsAPI.getOrderedTests(),
            variantProductsAPI.getProducts('', 1, 1),
            variantProductsAPI.getOrderedBatchTests(),
            variantProductsAPI.getReleasedBatchTests(),
            variantProductsAPI.getClarificationBatchTests(),
            variantProductsAPI.getArchivedBatchTests(),
            variantProductsAPI.getFinishedProductControls(),
        ];
        const results = await Promise.allSettled(requests);
        const failedCount = results.filter((result) => result.status === 'rejected').length;
        const valueAt = (index, fallback) => results[index].status === 'fulfilled' ? results[index].value : fallback;

        setData({
            mainProducts: asArray(valueAt(0, [])),
            mainOrders: asArray(valueAt(1, [])),
            variantProductsTotal: Number(valueAt(2, {})?.total) || 0,
            batchOrders: [3, 4, 5, 6].flatMap((index) => asArray(valueAt(index, []))),
            finishedControls: asArray(valueAt(7, [])),
        });
        setLastUpdated(new Date());
        setError(failedCount > 0
            ? `Nie udało się odświeżyć ${failedCount} z 8 źródeł. Pozostałe wskaźniki są aktualne.`
            : '');
        setLoading(false);
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const metrics = useMemo(() => {
        const mainStatuses = countBy(data.mainOrders, 'workflow_status', 'ordered_tests');
        const batchStatuses = countBy(data.batchOrders, 'workflow_status', 'ordered_tests');
        const controlStatuses = countBy(data.finishedControls, 'label_status', 'current');

        return {
            mainStatuses,
            batchStatuses,
            controlStatuses,
            mainTotal: data.mainOrders.length,
            batchTotal: data.batchOrders.length,
            controlTotal: data.finishedControls.length,
        };
    }, [data]);

    const gauges = [
        {
            title: 'Bulk gotowe do spakowania',
            value: metrics.mainStatuses.to_pack || 0,
            total: metrics.mainTotal,
            color: '#0ea5e9',
            description: 'Pozycje w statusie „Do spakowania”',
            href: '/main-products/to-pack',
        },
        {
            title: 'Bulk zwolnione',
            value: metrics.mainStatuses.released || 0,
            total: metrics.mainTotal,
            color: '#10b981',
            description: 'Udział zwolnionych zleceń Bulk',
            href: '/main-products/released',
        },
        {
            title: 'Partie do wyjaśnienia',
            value: metrics.batchStatuses.to_clarify || 0,
            total: metrics.batchTotal,
            color: '#f43f5e',
            description: 'Partie wymagające dodatkowej weryfikacji',
            href: '/product-variants/batches/to-clarify',
            inverse: true,
        },
        {
            title: 'Partie do zwolnienia',
            value: metrics.batchStatuses.released || 0,
            total: metrics.batchTotal,
            color: '#14b8a6',
            description: 'Partie z zakończonym etapem badań',
            href: '/product-variants/batches/released',
        },
        {
            title: 'Kontrole poprawne',
            value: metrics.controlStatuses.correct || 0,
            total: metrics.controlTotal,
            color: '#22c55e',
            description: 'Poprawne kontrole produktu gotowego',
            href: '/product-variants/finished-product-control/correct',
        },
        {
            title: 'Kontrole do wyjaśnienia',
            value: metrics.controlStatuses.incorrect || 0,
            total: metrics.controlTotal,
            color: '#e11d48',
            description: 'Kontrole z wykrytymi niezgodnościami',
            href: '/product-variants/finished-product-control/incorrect',
            inverse: true,
        },
    ];

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-600">Panel jakości</p>
                    <h1 className="mt-1 text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        KPI obliczone na podstawie aktualnych danych z tabel operacyjnych.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-slate-500">
                            Aktualizacja: {lastUpdated.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button type="button" onClick={loadDashboard} disabled={loading} className="btn-secondary px-4 py-2 text-sm">
                        {loading ? 'Odświeżanie…' : 'Odśwież'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {error}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Produkty Bulk" value={data.mainProducts.length} href="/main-products" accentClass="bg-sky-500" />
                <SummaryCard label="Zlecenia Bulk" value={metrics.mainTotal} href="/main-products/all" accentClass="bg-indigo-500" />
                <SummaryCard label="Warianty produktów" value={data.variantProductsTotal} href="/product-variants" accentClass="bg-violet-500" />
                <SummaryCard label="Partie produktów" value={metrics.batchTotal} href="/product-variants/batches/all" accentClass="bg-emerald-500" />
            </div>

            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Kluczowe wskaźniki</h2>
                    <span className="text-xs text-slate-500">Kliknij KPI, aby przejść do tabeli</span>
                </div>
                <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'animate-pulse opacity-60' : ''}`}>
                    {gauges.map((gauge) => <GaugeCard key={gauge.title} {...gauge} />)}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
