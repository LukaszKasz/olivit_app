import { useEffect, useState } from 'react';
import { variantProductsAPI } from '../api';

const PAGE_SIZE = 50;
const LABORATORIES = ['Laboratorium A', 'Laboratorium B', 'Laboratorium C'];
const getVariantRowKey = (row) => `${(row.sku || '').trim()}::${(row.ean || '').trim()}`;

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
        testCost: '',
        poNumber: '',
        saving: false,
    });
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [bulkBatchDialog, setBulkBatchDialog] = useState({
        open: false,
        saving: false,
        laboratory: '',
        asanaTaskNumber: '',
        productionDate: '',
        expiryDate: '',
        plannedTestDate: '',
        testCost: '',
        poNumber: '',
        targetRow: null,
        relatedRows: [],
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
            testCost: '',
            poNumber: '',
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
            testCost: '',
            poNumber: '',
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
                    test_cost: orderDialog.testCost,
                    po_number: orderDialog.poNumber,
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
                    testCost: '',
                    poNumber: '',
                    saving: false,
                });
            } catch (err) {
                setError(err?.response?.data?.detail || err.message || 'Nie udało się zapisać zlecenia badania.');
                setOrderDialog((prev) => ({ ...prev, saving: false }));
            }
        };

        run();
    };

    const openBulkBatchDialog = () => {
        const run = async () => {
            const selectedProducts = products.filter((product) => selectedProductIds.includes(product.id));
            if (selectedProducts.length === 0) {
                return;
            }
            if (selectedProducts.length > 1) {
                setError('Do zlecenia badań zaznacz tylko jeden produkt.');
                setSuccess('');
                return;
            }

            const [selectedProduct] = selectedProducts;
            const selectedProjectNumber = (selectedProduct.project_number || '').trim();
            let relatedProducts = [];

            if (selectedProjectNumber) {
                try {
                    const response = await variantProductsAPI.getProducts(selectedProjectNumber, 1, 100);
                    const fetchedProducts = Array.isArray(response?.items) ? response.items : [];
                    relatedProducts = fetchedProducts.filter(
                        (product) => product.id !== selectedProduct.id && (product.project_number || '').trim() === selectedProjectNumber
                    );
                } catch {
                    relatedProducts = products.filter(
                        (product) => product.id !== selectedProduct.id && (product.project_number || '').trim() === selectedProjectNumber
                    );
                }
            }

            const selectedProductKey = getVariantRowKey(selectedProduct);
            const seenRelatedKeys = new Set([selectedProductKey]);
            const uniqueRelatedProducts = relatedProducts.filter((product) => {
                const productKey = getVariantRowKey(product);
                if (seenRelatedKeys.has(productKey)) {
                    return false;
                }
                seenRelatedKeys.add(productKey);
                return true;
            });

            setBulkBatchDialog({
                open: true,
                saving: false,
                laboratory: '',
                asanaTaskNumber: '',
                productionDate: '',
                expiryDate: '',
                plannedTestDate: '',
                testCost: '',
                poNumber: '',
                targetRow: {
                    id: selectedProduct.id,
                    projectNumber: selectedProduct.project_number || '',
                    sku: selectedProduct.sku,
                    name: selectedProduct.name,
                    ean: selectedProduct.ean,
                    batchNumber: '',
                },
                relatedRows: uniqueRelatedProducts.map((product) => ({
                    id: product.id,
                    projectNumber: product.project_number || '',
                    sku: product.sku,
                    name: product.name,
                    ean: product.ean,
                    batchNumber: '',
                })),
            });
            setError('');
            setSuccess('');
        };

        run();
    };

    const closeBulkBatchDialog = () => {
        if (bulkBatchDialog.saving) {
            return;
        }

        setBulkBatchDialog({
            open: false,
            saving: false,
            laboratory: '',
            asanaTaskNumber: '',
            productionDate: '',
            expiryDate: '',
            plannedTestDate: '',
            testCost: '',
            poNumber: '',
            targetRow: null,
            relatedRows: [],
        });
    };

    const updateBulkBatchNumber = (value) => {
        setBulkBatchDialog((current) => ({
            ...current,
            targetRow: current.targetRow
                ? { ...current.targetRow, batchNumber: value }
                : null,
        }));
    };

    const handleBulkBatchSave = async () => {
        if (!bulkBatchDialog.targetRow) {
            return;
        }

        const rowsToSave = [bulkBatchDialog.targetRow, ...bulkBatchDialog.relatedRows].filter((row, index, allRows) => (
            index === allRows.findIndex((candidate) => getVariantRowKey(candidate) === getVariantRowKey(row))
        ));
        const hasMissingBatchNumbers = rowsToSave.some((row) => !row.batchNumber.trim());

        if (hasMissingBatchNumbers) {
            setError('Uzupełnij numer serii dla wszystkich produktów przed zapisem.');
            setSuccess('');
            return;
        }

        try {
            setBulkBatchDialog((current) => ({ ...current, saving: true }));
            await variantProductsAPI.orderBatchTestsBulk({
                laboratory_name: bulkBatchDialog.laboratory,
                asana_task_number: bulkBatchDialog.asanaTaskNumber,
                production_date: bulkBatchDialog.productionDate,
                expiry_date: bulkBatchDialog.expiryDate,
                planned_test_date: bulkBatchDialog.plannedTestDate,
                test_cost: bulkBatchDialog.testCost,
                po_number: bulkBatchDialog.poNumber,
                items: rowsToSave.map((row) => ({
                    sku: row.sku,
                    name: row.name,
                    ean: row.ean,
                    batch_number: row.batchNumber,
                })),
            });

            setSuccess(`Zlecono badania dla ${bulkBatchDialog.targetRow.sku} i zapisano ${rowsToSave.length} produktów do kontroli produktu gotowego.`);
            setError('');
            setSelectedProductIds([]);
            setBulkBatchDialog({
                open: false,
                saving: false,
                laboratory: '',
                asanaTaskNumber: '',
                productionDate: '',
                expiryDate: '',
                plannedTestDate: '',
                testCost: '',
                poNumber: '',
                targetRow: null,
                relatedRows: [],
            });
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się zlecić badań dla zaznaczonych wariantów.');
            setBulkBatchDialog((current) => ({ ...current, saving: false }));
        }
    };

    const isBulkBatchSaveDisabled = !bulkBatchDialog.targetRow
        || !bulkBatchDialog.laboratory
        || !bulkBatchDialog.productionDate.trim()
        || !bulkBatchDialog.expiryDate.trim()
        || !bulkBatchDialog.plannedTestDate.trim()
        || !bulkBatchDialog.targetRow.batchNumber.trim()
        || bulkBatchDialog.relatedRows.some((row) => !row.batchNumber.trim())
        || bulkBatchDialog.saving;

    return (
        <div className="w-full">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Produkty spakowane / Warianty</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Lista wariantów produktów z numerem wariantu, nazwą i kodem EAN.
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    Pozycji: <span className="font-semibold text-slate-900">{total}</span>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                <span>Zaznaczone: <span className="font-semibold text-slate-900">{selectedProductIds.length}</span></span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={openBulkBatchDialog}
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={selectedProductIds.length === 0}
                    >
                        Zleć badania
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedProductIds([])}
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={selectedProductIds.length === 0}
                    >
                        Wyczyść zaznaczenie
                    </button>
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
                                <th className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleAllVisibleProducts}
                                        aria-label="Zaznacz wszystkie widoczne warianty"
                                    />
                                </th>
                                <th className="px-6 py-4">Numer projektu</th>
                                <th className="px-6 py-4">Numer wariantu</th>
                                <th className="px-6 py-4">Nazwa</th>
                                <th className="px-6 py-4">EAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie wariantów produktów...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
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
                                                aria-label={`Zaznacz wariant ${product.sku}`}
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                            {product.project_number || '—'}
                                        </td>
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

                        {orderDialog.mode === 'test-order' && (
                            <div className="mb-6 grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-test-cost">
                                        Koszt badania
                                    </label>
                                    <input
                                        id="variant-test-cost"
                                        type="text"
                                        value={orderDialog.testCost}
                                        onChange={(event) => setOrderDialog((prev) => ({ ...prev, testCost: event.target.value }))}
                                        placeholder="Np. 350 PLN"
                                        className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-po-number">
                                        Numer PO
                                    </label>
                                    <input
                                        id="variant-po-number"
                                        type="text"
                                        value={orderDialog.poNumber}
                                        onChange={(event) => setOrderDialog((prev) => ({ ...prev, poNumber: event.target.value }))}
                                        placeholder="Np. PO-12345"
                                        className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setOrderDialog({ open: false, mode: 'test-order', laboratory: '', product: null, batchNumber: '', testCost: '', poNumber: '', saving: false })}
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

            {bulkBatchDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-2xl font-semibold text-slate-900">Zleć badania</h2>
                        </div>

                        <div className="max-h-[65vh] overflow-auto px-6 py-5">
                            <div className="mb-6 grid gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="bulk-variant-laboratory">
                                        Laboratorium
                                    </label>
                                    <select
                                        id="bulk-variant-laboratory"
                                        value={bulkBatchDialog.laboratory}
                                        onChange={(event) => setBulkBatchDialog((current) => ({ ...current, laboratory: event.target.value }))}
                                        className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                    >
                                        <option value="">Wybierz laboratorium raz</option>
                                        {LABORATORIES.map((laboratory) => (
                                            <option key={laboratory} value={laboratory}>
                                                {laboratory}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                Numer projektu
                                            </div>
                                            <div className="mt-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900">
                                                {bulkBatchDialog.targetRow?.projectNumber || '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="bulk-variant-asana-task-number">
                                                Numer w Asana
                                            </label>
                                            <input
                                                id="bulk-variant-asana-task-number"
                                                type="text"
                                                value={bulkBatchDialog.asanaTaskNumber}
                                                onChange={(event) => setBulkBatchDialog((current) => ({ ...current, asanaTaskNumber: event.target.value }))}
                                                placeholder="Np. 1234567890"
                                                className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="bulk-variant-test-cost">
                                                Koszt badania
                                            </label>
                                            <input
                                                id="bulk-variant-test-cost"
                                                type="text"
                                                value={bulkBatchDialog.testCost}
                                                onChange={(event) => setBulkBatchDialog((current) => ({ ...current, testCost: event.target.value }))}
                                                placeholder="Np. 350 PLN"
                                                className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="bulk-variant-po-number">
                                                Numer PO
                                            </label>
                                            <input
                                                id="bulk-variant-po-number"
                                                type="text"
                                                value={bulkBatchDialog.poNumber}
                                                onChange={(event) => setBulkBatchDialog((current) => ({ ...current, poNumber: event.target.value }))}
                                                placeholder="Np. PO-12345"
                                                className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Daty
                                    </div>
                                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                                        <label className="block">
                                            <span className="text-sm font-medium text-slate-900">Data produkcji</span>
                                            <input
                                                type="date"
                                                value={bulkBatchDialog.productionDate}
                                                onChange={(event) => setBulkBatchDialog((current) => ({ ...current, productionDate: event.target.value }))}
                                                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                            <span className="mt-2 block text-xs leading-5 text-slate-500">
                                                Dotyczy daty produkcji danego produktu, nie terminu samego badania.
                                            </span>
                                        </label>
                                        <label className="block">
                                            <span className="text-sm font-medium text-slate-900">Data ważności</span>
                                            <input
                                                type="date"
                                                value={bulkBatchDialog.expiryDate}
                                                onChange={(event) => setBulkBatchDialog((current) => ({ ...current, expiryDate: event.target.value }))}
                                                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                            <span className="mt-2 block text-xs leading-5 text-slate-500">
                                                Dotyczy daty ważności produktu z tej serii.
                                            </span>
                                        </label>
                                        <label className="block">
                                            <span className="text-sm font-medium text-slate-900">Plan. realizacji</span>
                                            <input
                                                type="date"
                                                value={bulkBatchDialog.plannedTestDate}
                                                onChange={(event) => setBulkBatchDialog((current) => ({ ...current, plannedTestDate: event.target.value }))}
                                                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                            <span className="mt-2 block text-xs leading-5 text-slate-500">
                                                Dotyczy planowanej daty realizacji badania.
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="rounded-3xl border border-slate-200">
                                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Produkt do badań</h3>
                                    </div>
                                    {bulkBatchDialog.targetRow && (
                                        <div className="px-5 py-5">
                                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(220px,1fr)] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    <div>Numer wariantu</div>
                                                    <div>Nazwa</div>
                                                    <div>Numer serii</div>
                                                </div>
                                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(220px,1fr)] gap-3 px-4 py-3 text-sm text-slate-700">
                                                    <div className="font-semibold text-slate-900">{bulkBatchDialog.targetRow.sku}</div>
                                                    <div>{bulkBatchDialog.targetRow.name}</div>
                                                    <input
                                                        type="text"
                                                        value={bulkBatchDialog.targetRow.batchNumber}
                                                        onChange={(event) => updateBulkBatchNumber(event.target.value)}
                                                        placeholder="Wpisz serię"
                                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-3xl border border-slate-200">
                                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Produkty do kontroli Produktu gotowego</h3>
                                    </div>
                                    {bulkBatchDialog.relatedRows.length === 0 ? (
                                        <div className="px-5 py-8 text-sm text-slate-500">
                                            Brak innych widocznych wariantów z tym samym numerem projektu.
                                        </div>
                                    ) : (
                                        <div className="px-5 py-5">
                                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(220px,1fr)] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    <div>Numer wariantu</div>
                                                    <div>Nazwa</div>
                                                    <div>Numer serii</div>
                                                </div>
                                                <div className="divide-y divide-slate-200">
                                                    {bulkBatchDialog.relatedRows.map((row) => (
                                                        <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(220px,1fr)] gap-3 px-4 py-3 text-sm text-slate-700">
                                                            <div className="font-semibold text-slate-900">{row.sku}</div>
                                                            <div>{row.name}</div>
                                                            <input
                                                                type="text"
                                                                value={row.batchNumber}
                                                                onChange={(event) => setBulkBatchDialog((current) => ({
                                                                    ...current,
                                                                    relatedRows: current.relatedRows.map((relatedRow) => (
                                                                        relatedRow.id === row.id
                                                                            ? { ...relatedRow, batchNumber: event.target.value }
                                                                            : relatedRow
                                                                    )),
                                                                }))}
                                                                placeholder="Wpisz serię"
                                                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
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
        </div>
    );
}

export default VariantProductsPage;
