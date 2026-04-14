import { useEffect, useState } from 'react';
import { mainProductsAPI } from '../api';

const LABORATORIES = ['Laboratorium A', 'Laboratorium B', 'Laboratorium C'];

function MainProductsPage() {
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        product: null,
        submenuOpen: false,
    });
    const [success, setSuccess] = useState('');
    const [orderDialog, setOrderDialog] = useState({
        open: false,
        laboratory: '',
        product: null,
        batchNumber: '',
        saving: false,
    });

    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            try {
                setLoading(true);
                const data = await mainProductsAPI.getProducts(query);
                if (!controller.signal.aborted) {
                    setProducts(Array.isArray(data) ? data : []);
                    setError('');
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać produktów.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }, 250);

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
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
            laboratory,
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
                await mainProductsAPI.orderTests({
                    project_number: orderDialog.product.project_number,
                    name: orderDialog.product.name,
                    laboratory_name: orderDialog.laboratory,
                    batch_number: orderDialog.batchNumber,
                });
                setSuccess(`Zlecono badania dla ${orderDialog.product.project_number} w ${orderDialog.laboratory}, seria: ${orderDialog.batchNumber}.`);
                setError('');
                setOrderDialog({
                    open: false,
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
        <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Produkty główne</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Lista produktów głównych z numerem projektu i nazwą.
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    Pozycji: <span className="font-semibold text-slate-900">{products.length}</span>
                </div>
            </div>

            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="main-products-search">
                    Wyszukiwanie
                </label>
                <input
                    id="main-products-search"
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Szukaj po numerze projektu lub nazwie"
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
                                <th className="px-6 py-4">Numer projektu</th>
                                <th className="px-6 py-4">Nazwa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="2" className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie produktów...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="2" className="px-6 py-10 text-center text-slate-500">
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
                                            {product.project_number}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                            {product.name}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
                </div>
            )}

            {orderDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">Zleć badania</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {orderDialog.product?.project_number} / {orderDialog.laboratory}
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="batch-number">
                                Numer serii
                            </label>
                            <input
                                id="batch-number"
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
                                onClick={() => setOrderDialog({ open: false, laboratory: '', product: null, batchNumber: '', saving: false })}
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

export default MainProductsPage;
