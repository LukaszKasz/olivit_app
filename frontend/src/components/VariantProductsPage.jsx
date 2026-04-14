import { useEffect, useState } from 'react';
import { variantProductsAPI } from '../api';

const PAGE_SIZE = 50;
const LABORATORIES = ['Laboratorium A', 'Laboratorium B', 'Laboratorium C'];

function VariantProductsPage() {
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        product: null,
        submenuOpen: false,
    });
    const [orderDialog, setOrderDialog] = useState({
        open: false,
        mode: 'test-order',
        laboratory: '',
        product: null,
        batchNumber: '',
        saving: false,
    });

    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            try {
                setLoading(true);
                const data = await variantProductsAPI.getProducts(query, page, PAGE_SIZE);
                setProducts(Array.isArray(data?.items) ? data.items : []);
                setTotal(Number.isFinite(data?.total) ? data.total : 0);
                setError('');
            } catch (err) {
                setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać wariantów produktów.');
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [query, page]);

    useEffect(() => {
        setPage(1);
    }, [query]);

    useEffect(() => {
        if (!contextMenu.visible) {
            return undefined;
        }

        const closeContextMenu = () => {
            setContextMenu((prev) => ({ ...prev, visible: false, submenuOpen: false }));
        };

        window.addEventListener('click', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);

        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, [contextMenu.visible]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

    const handleContextMenu = (event, product) => {
        event.preventDefault();
        setContextMenu({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            product,
            submenuOpen: false,
        });
    };

    const handleLaboratoryAction = (laboratory) => {
        if (!contextMenu.product) {
            return;
        }

        setOrderDialog({
            open: true,
            mode: 'test-order',
            laboratory,
            product: contextMenu.product,
            batchNumber: '',
            saving: false,
        });
        setContextMenu((prev) => ({ ...prev, visible: false, submenuOpen: false }));
    };

    const handleBatchOnlyAction = () => {
        if (!contextMenu.product) {
            return;
        }

        setOrderDialog({
            open: true,
            mode: 'batch-only',
            laboratory: '',
            product: contextMenu.product,
            batchNumber: '',
            saving: false,
        });
        setContextMenu((prev) => ({ ...prev, visible: false, submenuOpen: false }));
    };

    const handleOrderSave = () => {
        const run = async () => {
            if (!orderDialog.product) {
                return;
            }

            try {
                setOrderDialog((prev) => ({ ...prev, saving: true }));
                await variantProductsAPI.orderBatchTests({
                    sku: orderDialog.product.sku,
                    name: orderDialog.product.name,
                    ean: orderDialog.product.ean,
                    laboratory_name: orderDialog.laboratory || undefined,
                    batch_number: orderDialog.batchNumber,
                });
                setSuccess(
                    orderDialog.mode === 'test-order'
                        ? `Zlecono badania dla ${orderDialog.product.sku} w ${orderDialog.laboratory}, seria: ${orderDialog.batchNumber}.`
                        : `Dodano serię ${orderDialog.batchNumber} dla ${orderDialog.product.sku}.`
                );
                setError('');
                setOrderDialog({
                    open: false,
                    mode: 'test-order',
                    laboratory: '',
                    product: null,
                    batchNumber: '',
                    saving: false,
                });
            } catch (err) {
                setError(err?.response?.data?.detail || err.message || 'Nie udało się zapisać zlecenia badania.');
                setOrderDialog((prev) => ({ ...prev, saving: false }));
            }
        };

        run();
    };

    return (
        <div className="w-full">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Warianty produktów</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Lista wariantów produktów z numerem wariantu, nazwą i kodem EAN.
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    Pozycji: <span className="font-semibold text-slate-900">{total}</span>
                </div>
            </div>

            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-products-search">
                    Wyszukiwanie
                </label>
                <input
                    id="variant-products-search"
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Szukaj po numerze wariantu, nazwie lub EAN"
                    className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                />
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Numer wariantu</th>
                                <th className="px-6 py-4">Nazwa</th>
                                <th className="px-6 py-4">EAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="3" className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie wariantów produktów...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="3" className="px-6 py-10 text-center text-slate-500">
                                        Brak wyników dla podanego wyszukiwania.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr
                                        key={product.id}
                                        className="border-t border-slate-100 hover:bg-slate-50/80"
                                        onContextMenu={(event) => handleContextMenu(event, product)}
                                    >
                                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                                            {product.sku}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                            {product.name}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                            {product.ean}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                    <div>
                        Wyświetlane {from}-{to} z {total}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            disabled={page === 1 || loading}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Poprzednia
                        </button>
                        <span className="min-w-24 text-center text-slate-700">
                            Strona {page} z {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            disabled={page >= totalPages || loading}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Następna
                        </button>
                    </div>
                </div>
            </div>

            {contextMenu.visible && (
                <div
                    className="absolute z-50 min-w-[240px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        onMouseEnter={() => setContextMenu((prev) => ({ ...prev, submenuOpen: true }))}
                    >
                        <span>Zleć badania</span>
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    {contextMenu.submenuOpen && (
                        <div
                            className="absolute left-full top-2 ml-2 min-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                            onMouseLeave={() => setContextMenu((prev) => ({ ...prev, submenuOpen: false }))}
                        >
                            {LABORATORIES.map((laboratory) => (
                                <button
                                    key={laboratory}
                                    type="button"
                                    className="block w-full rounded-xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                                    onClick={() => handleLaboratoryAction(laboratory)}
                                >
                                    {laboratory}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        className="mt-1 block w-full rounded-xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                        onClick={handleBatchOnlyAction}
                    >
                        Dodaj serię
                    </button>
                </div>
            )}

            {orderDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">
                                {orderDialog.mode === 'test-order' ? 'Zleć badania' : 'Dodaj serię'}
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {orderDialog.product?.sku}
                                {orderDialog.mode === 'test-order' ? ` / ${orderDialog.laboratory}` : ''}
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-batch-number">
                                Numer serii
                            </label>
                            <input
                                id="variant-batch-number"
                                type="text"
                                value={orderDialog.batchNumber}
                                onChange={(event) => setOrderDialog((prev) => ({ ...prev, batchNumber: event.target.value }))}
                                placeholder="Wprowadź numer serii"
                                className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setOrderDialog({ open: false, mode: 'test-order', laboratory: '', product: null, batchNumber: '', saving: false })}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                disabled={orderDialog.saving}
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleOrderSave}
                                disabled={orderDialog.saving || !orderDialog.batchNumber.trim()}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {orderDialog.saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VariantProductsPage;
