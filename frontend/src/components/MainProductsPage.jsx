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
        mode: 'test-order',
        laboratory: '',
        product: null,
        batchNumber: '',
        saving: false,
    });
    const [detailsDialog, setDetailsDialog] = useState({
        open: false,
        loading: false,
        product: null,
        items: [],
    });
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [bulkBatchDialog, setBulkBatchDialog] = useState({
        open: false,
        saving: false,
        rows: [],
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

    const handleLaboratoryAction = (laboratory, product = contextMenu.product) => {
        if (!product) {
            return;
        }

        setOrderDialog({
            open: true,
            mode: 'test-order',
            laboratory,
            product,
            batchNumber: '',
            saving: false,
        });
        setContextMenu((prev) => ({ ...prev, visible: false, submenuOpen: false }));
    };

    const handleBatchOnlyAction = (product = contextMenu.product) => {
        if (!product) {
            return;
        }

        setOrderDialog({
            open: true,
            mode: 'batch-only',
            laboratory: '',
            product,
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
                    laboratory_name: orderDialog.laboratory || undefined,
                    batch_number: orderDialog.batchNumber,
                });
                setSuccess(
                    orderDialog.mode === 'test-order'
                        ? `Zlecono badania dla ${orderDialog.product.project_number} w ${orderDialog.laboratory}, seria: ${orderDialog.batchNumber}.`
                        : `Dodano serię ${orderDialog.batchNumber} dla ${orderDialog.product.project_number}.`
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

    const handleDetailsAction = async () => {
        if (!contextMenu.product) {
            return;
        }

        const product = contextMenu.product;
        setContextMenu((prev) => ({ ...prev, visible: false, submenuOpen: false }));
        setDetailsDialog({
            open: true,
            loading: true,
            product,
            items: [],
        });

        try {
            const items = await mainProductsAPI.getDetails(product.id);
            setDetailsDialog({
                open: true,
                loading: false,
                product,
                items: Array.isArray(items) ? items : [],
            });
            setError('');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać szczegółów produktu.');
            setDetailsDialog({
                open: false,
                loading: false,
                product: null,
                items: [],
            });
        }
    };

    const handleDetailsButtonClick = async (product) => {
        setDetailsDialog({
            open: true,
            loading: true,
            product,
            items: [],
        });

        try {
            const items = await mainProductsAPI.getDetails(product.id);
            setDetailsDialog({
                open: true,
                loading: false,
                product,
                items: Array.isArray(items) ? items : [],
            });
            setError('');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać szczegółów produktu.');
            setDetailsDialog({
                open: false,
                loading: false,
                product: null,
                items: [],
            });
        }
    };

    const handleAddBatchButtonClick = (product) => {
        handleBatchOnlyAction(product);
    };

    const visibleProductIds = products.map((product) => product.id);
    const allVisibleSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedProductIds.includes(id));

    const toggleProductSelection = (productId) => {
        setSelectedProductIds((current) =>
            current.includes(productId)
                ? current.filter((id) => id !== productId)
                : [...current, productId]
        );
    };

    const toggleAllVisibleProducts = () => {
        setSelectedProductIds((current) =>
            allVisibleSelected
                ? current.filter((id) => !visibleProductIds.includes(id))
                : Array.from(new Set([...current, ...visibleProductIds]))
        );
    };

    const openBulkBatchDialog = () => {
        const selectedProducts = products.filter((product) => selectedProductIds.includes(product.id));
        if (selectedProducts.length === 0) {
            return;
        }

        setBulkBatchDialog({
            open: true,
            saving: false,
            rows: selectedProducts.map((product) => ({
                id: product.id,
                project_number: product.project_number,
                name: product.name,
                batchNumber: '',
            })),
        });
    };

    const closeBulkBatchDialog = () => {
        if (bulkBatchDialog.saving) {
            return;
        }

        setBulkBatchDialog({
            open: false,
            saving: false,
            rows: [],
        });
    };

    const updateBulkBatchNumber = (productId, value) => {
        setBulkBatchDialog((current) => ({
            ...current,
            rows: current.rows.map((row) =>
                row.id === productId
                    ? { ...row, batchNumber: value }
                    : row
            ),
        }));
    };

    const handleBulkBatchSave = async () => {
        try {
            setBulkBatchDialog((current) => ({ ...current, saving: true }));
            await Promise.all(
                bulkBatchDialog.rows.map((row) =>
                    mainProductsAPI.orderTests({
                        project_number: row.project_number,
                        name: row.name,
                        batch_number: row.batchNumber,
                    })
                )
            );

            setSuccess(`Dodano serie dla ${bulkBatchDialog.rows.length} zaznaczonych produktów głównych.`);
            setError('');
            setSelectedProductIds([]);
            setBulkBatchDialog({
                open: false,
                saving: false,
                rows: [],
            });
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się dodać serii dla zaznaczonych produktów głównych.');
            setBulkBatchDialog((current) => ({ ...current, saving: false }));
        }
    };

    const isBulkBatchSaveDisabled = bulkBatchDialog.rows.length === 0
        || bulkBatchDialog.rows.some((row) => !row.batchNumber.trim())
        || bulkBatchDialog.saving;

    const groupedDetails = detailsDialog.items.reduce((groups, item) => {
        const key = `${item.parameter_type_pl}|||${item.parameter_type_en}`;
        const existingGroup = groups.find((group) => group.key === key);

        if (existingGroup) {
            existingGroup.items.push(item);
            return groups;
        }

        groups.push({
            key,
            parameterTypePl: item.parameter_type_pl,
            parameterTypeEn: item.parameter_type_en,
            items: [item],
        });
        return groups;
    }, []);

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

            <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                <span>Zaznaczone: <span className="font-semibold text-slate-900">{selectedProductIds.length}</span></span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={openBulkBatchDialog}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={selectedProductIds.length === 0}
                    >
                        Dodaj serię
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedProductIds([])}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={selectedProductIds.length === 0}
                    >
                        Wyczyść zaznaczenie
                    </button>
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
                                <th className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleAllVisibleProducts}
                                        aria-label="Zaznacz wszystkie widoczne produkty główne"
                                    />
                                </th>
                                <th className="px-6 py-4">Numer projektu</th>
                                <th className="px-6 py-4">Nazwa</th>
                                <th className="px-6 py-4 text-right">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie produktów...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
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
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedProductIds.includes(product.id)}
                                                onChange={() => toggleProductSelection(product.id)}
                                                onClick={(event) => event.stopPropagation()}
                                                aria-label={`Zaznacz produkt ${product.project_number}`}
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                                            {product.project_number}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                            {product.name}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDetailsButtonClick(product)}
                                                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    Szczegóły
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleLaboratoryAction('', product)}
                                                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    Zleć badania
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddBatchButtonClick(product)}
                                                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    Dodaj serię
                                                </button>
                                            </div>
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
                        className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        onClick={handleDetailsAction}
                    >
                        Szczegóły
                    </button>

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
                            <h2 className="text-2xl font-semibold text-slate-900">
                                {orderDialog.mode === 'test-order' ? 'Zleć badania' : 'Dodaj serię'}
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {orderDialog.product?.project_number}
                                {orderDialog.mode === 'test-order' && orderDialog.laboratory ? ` / ${orderDialog.laboratory}` : ''}
                            </p>
                        </div>

                        {orderDialog.mode === 'test-order' && (
                            <div className="mb-6">
                                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="laboratory">
                                    Laboratorium
                                </label>
                                <select
                                    id="laboratory"
                                    value={orderDialog.laboratory}
                                    onChange={(event) => setOrderDialog((prev) => ({ ...prev, laboratory: event.target.value }))}
                                    className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                                >
                                    <option value="">Wybierz laboratorium</option>
                                    {LABORATORIES.map((laboratory) => (
                                        <option key={laboratory} value={laboratory}>
                                            {laboratory}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                onClick={() => setOrderDialog({ open: false, mode: 'test-order', laboratory: '', product: null, batchNumber: '', saving: false })}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                disabled={orderDialog.saving}
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleOrderSave}
                                disabled={orderDialog.saving || !orderDialog.batchNumber.trim() || (orderDialog.mode === 'test-order' && !orderDialog.laboratory.trim())}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {orderDialog.saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {bulkBatchDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-2xl font-semibold text-slate-900">Dodaj serię</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Uzupełnij numer serii dla zaznaczonych produktów głównych.
                            </p>
                        </div>

                        <div className="max-h-[65vh] overflow-auto px-6 py-5">
                            <div className="overflow-hidden rounded-3xl border border-slate-200">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                                        <tr>
                                            <th className="px-4 py-4">Numer projektu</th>
                                            <th className="px-4 py-4">Nazwa</th>
                                            <th className="px-4 py-4">Numer serii</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkBatchDialog.rows.map((row) => (
                                            <tr key={row.id} className="border-t border-slate-100">
                                                <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-900">{row.project_number}</td>
                                                <td className="px-4 py-4 text-slate-700">{row.name}</td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="text"
                                                        value={row.batchNumber}
                                                        onChange={(event) => updateBulkBatchNumber(row.id, event.target.value)}
                                                        placeholder="Wpisz serię"
                                                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
                            <button
                                type="button"
                                onClick={closeBulkBatchDialog}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                disabled={bulkBatchDialog.saving}
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkBatchSave}
                                disabled={isBulkBatchSaveDisabled}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {bulkBatchDialog.saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {detailsDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                            <div>
                                <h2 className="text-2xl font-semibold text-slate-900">Szczegóły</h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    {detailsDialog.product?.project_number} / {detailsDialog.product?.name}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailsDialog({ open: false, loading: false, product: null, items: [] })}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                                Zamknij
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-auto p-6">
                            {detailsDialog.loading ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                    Ładowanie szczegółów...
                                </div>
                            ) : detailsDialog.items.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                    Brak szczegółów dla tego produktu.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {groupedDetails.map((group) => (
                                        <section key={group.key} className="overflow-hidden rounded-3xl border border-slate-200">
                                            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                                                <h3 className="text-base font-semibold text-slate-900">{group.parameterTypePl}</h3>
                                                <p className="mt-1 text-sm text-slate-600">{group.parameterTypeEn}</p>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[980px] text-left text-sm">
                                                    <thead className="bg-white text-xs uppercase tracking-[0.18em] text-slate-500">
                                                        <tr>
                                                            <th className="px-4 py-4">Parametr PL</th>
                                                            <th className="px-4 py-4">Parametr EN</th>
                                                            <th className="px-4 py-4">Wymaganie PL</th>
                                                            <th className="px-4 py-4">Wymaganie EN</th>
                                                            <th className="px-4 py-4">Metoda PL</th>
                                                            <th className="px-4 py-4">Metoda EN</th>
                                                            <th className="px-4 py-4">Potwierdzenie PL</th>
                                                            <th className="px-4 py-4">Potwierdzenie EN</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.items.map((item) => (
                                                            <tr key={item.id} className="border-t border-slate-100 align-top">
                                                                <td className="px-4 py-4 font-medium text-slate-900">{item.parameter_name_pl}</td>
                                                                <td className="px-4 py-4 font-medium text-slate-900">{item.parameter_name_en}</td>
                                                                <td className="px-4 py-4 text-slate-700">{item.requirement_pl}</td>
                                                                <td className="px-4 py-4 text-slate-700">{item.requirement_en}</td>
                                                                <td className="px-4 py-4 text-slate-700">{item.method_pl}</td>
                                                                <td className="px-4 py-4 text-slate-700">{item.method_en}</td>
                                                                <td className="px-4 py-4 text-slate-700">{item.confirmation_pl || '-'}</td>
                                                                <td className="px-4 py-4 text-slate-700">{item.confirmation_en || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MainProductsPage;
