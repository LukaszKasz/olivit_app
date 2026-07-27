import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mainProductsAPI } from '../api';

const DOCUMENT_SLOTS = 6;

const STATUS_META = {
    ordered_tests: {
        label: 'Badania zlecone',
        badgeClassName: 'bg-amber-100 text-amber-800',
    },
    to_pack: {
        label: 'Do spakowania',
        badgeClassName: 'bg-sky-100 text-sky-800',
    },
    to_clarify: {
        label: 'Do wyjaśnienia',
        badgeClassName: 'bg-rose-100 text-rose-800',
    },
    released: {
        label: 'Zwolnione',
        badgeClassName: 'bg-emerald-100 text-emerald-800',
    },
    archive: {
        label: 'Archiwum',
        badgeClassName: 'bg-slate-200 text-slate-800',
    },
};

const MOVE_OPTIONS = [
    { value: 'ordered_tests', label: 'Badania zlecone', path: '/main-products/ordered-tests' },
    { value: 'to_pack', label: 'Do spakowania', path: '/main-products/to-pack' },
    { value: 'released', label: 'Zwolnione', path: '/main-products/released' },
    { value: 'archive', label: 'Archiwum', path: '/main-products/archive' },
];

function MainProductOrderedTestsPage({
    title = 'Bulk / Baza produktów - Badania zlecone',
    description = 'Widok Badania zlecone w module Bulk / Baza produktów prezentuje listę produktów głównych, dla których został uruchomiony proces badań laboratoryjnych.',
    viewMode = 'ordered_tests',
}) {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [documentsDialog, setDocumentsDialog] = useState({
        open: false,
        mode: 'add',
        files: Array(DOCUMENT_SLOTS).fill(null),
        previewIndex: null,
        targetOrders: [],
    });
    const [clarifyDialog, setClarifyDialog] = useState({
        open: false,
        saving: false,
        order: null,
        note: '',
    });
    const [notePreviewDialog, setNotePreviewDialog] = useState({
        open: false,
        order: null,
    });
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [moveDialog, setMoveDialog] = useState({
        open: false,
        saving: false,
        orders: [],
        targetStatus: 'ordered_tests',
    });

    const loadOrders = async () => {
        const data = await mainProductsAPI.getOrderedTests();
        return Array.isArray(data) ? data : [];
    };

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                setOrders(await loadOrders());
                setError('');
            } catch (err) {
                setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać zleconych badań.');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        if (viewMode === 'all') {
            return orders;
        }

        return orders.filter((order) => (order.workflow_status || 'ordered_tests') === viewMode);
    }, [orders, viewMode]);

    useEffect(() => {
        const availableIds = new Set(orders.map((order) => order.id));
        setSelectedOrderIds((current) => current.filter((id) => availableIds.has(id)));
    }, [orders]);

    const isPlannedTestDateOverdue = (plannedTestDate) => {
        if (!plannedTestDate) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const normalizedPlannedDate = new Date(`${plannedTestDate}T00:00:00`);
        if (Number.isNaN(normalizedPlannedDate.getTime())) {
            return false;
        }

        return normalizedPlannedDate < today;
    };

    const replaceOrderInState = (updatedOrder) => {
        setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    };

    const replaceOrdersInState = (updatedOrders) => {
        const updatedById = new Map(updatedOrders.map((order) => [order.id, order]));
        setOrders((current) => current.map((order) => updatedById.get(order.id) || order));
    };

    const visibleOrderIds = filteredOrders.map((order) => order.id);
    const allVisibleSelected = visibleOrderIds.length > 0 && visibleOrderIds.every((id) => selectedOrderIds.includes(id));
    const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order.id));
    const selectedOrder = selectedOrderIds.length === 1
        ? selectedOrders[0] || null
        : null;
    const selectedStatuses = Array.from(new Set(selectedOrders.map((order) => order.workflow_status || 'ordered_tests')));
    const selectedStatus = selectedStatuses.length === 1 ? selectedStatuses[0] : null;
    const activeActionStatus = viewMode === 'all' ? selectedStatus : viewMode;

    const toggleOrderSelection = (orderId) => {
        setSelectedOrderIds((current) =>
            current.includes(orderId)
                ? current.filter((id) => id !== orderId)
                : [...current, orderId]
        );
    };

    const toggleAllVisibleOrders = () => {
        setSelectedOrderIds((current) =>
            allVisibleSelected
                ? current.filter((id) => !visibleOrderIds.includes(id))
                : Array.from(new Set([...current, ...visibleOrderIds]))
        );
    };

    const updateOrdersWorkflowStatus = async (targetOrders, workflowStatus, successMessage, navigatePath) => {
        try {
            const updatedOrders = await Promise.all(
                targetOrders.map((order) => mainProductsAPI.updateOrderedTest(order.id, { workflow_status: workflowStatus }))
            );
            replaceOrdersInState(updatedOrders);
            setSelectedOrderIds([]);
            setSuccess(successMessage);
            setError('');
            if (navigatePath) {
                navigate(navigatePath);
            }
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się przenieść pozycji.');
        }
    };

    const handleMoveToPack = async (order) => {
        updateOrdersWorkflowStatus(
            [order],
            'to_pack',
            `Przeniesiono ${order.project_number} do zakładki Do spakowania.`,
            '/main-products/to-pack'
        );
    };

    const handleMoveToReleased = async (order) => {
        updateOrdersWorkflowStatus(
            [order],
            'released',
            `Przeniesiono ${order.project_number} do zakładki Zwolnione.`,
            '/main-products/released'
        );
    };

    const openNotePreviewDialog = (order) => {
        setNotePreviewDialog({
            open: true,
            order,
        });
    };

    const closeNotePreviewDialog = () => {
        setNotePreviewDialog({
            open: false,
            order: null,
        });
    };

    const openClarifyDialog = (order) => {
        setClarifyDialog({
            open: true,
            saving: false,
            order,
            note: order.clarification_note || '',
        });
    };

    const closeClarifyDialog = () => {
        if (clarifyDialog.saving) {
            return;
        }

        setClarifyDialog({
            open: false,
            saving: false,
            order: null,
            note: '',
        });
    };

    const handleSaveClarification = async () => {
        if (!clarifyDialog.order) {
            return;
        }

        try {
            setClarifyDialog((current) => ({ ...current, saving: true }));
            const updatedOrder = await mainProductsAPI.updateOrderedTest(clarifyDialog.order.id, {
                workflow_status: 'to_clarify',
                clarification_note: clarifyDialog.note,
            });
            replaceOrderInState(updatedOrder);
            setSuccess(`Przeniesiono ${clarifyDialog.order.project_number} do zakładki Do wyjaśnienia.`);
            setError('');
            setClarifyDialog({
                open: false,
                saving: false,
                order: null,
                note: '',
            });
            navigate('/main-products/to-clarify');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się zapisać notatki i przenieść pozycji.');
            setClarifyDialog((current) => ({ ...current, saving: false }));
        }
    };

    const openMoveDialog = (targetOrders) => {
        const normalizedOrders = Array.isArray(targetOrders) ? targetOrders : [targetOrders];
        const currentStatus = normalizedOrders[0]?.workflow_status || 'ordered_tests';
        const defaultTarget = MOVE_OPTIONS.find((option) => option.value !== currentStatus);
        setMoveDialog({
            open: true,
            saving: false,
            orders: normalizedOrders,
            targetStatus: defaultTarget?.value || 'ordered_tests',
        });
    };

    const closeMoveDialog = () => {
        if (moveDialog.saving) {
            return;
        }

        setMoveDialog({
            open: false,
            saving: false,
            orders: [],
            targetStatus: 'ordered_tests',
        });
    };

    const handleMoveOrder = async () => {
        if (moveDialog.orders.length === 0) {
            return;
        }

        const selectedOption = MOVE_OPTIONS.find((option) => option.value === moveDialog.targetStatus);
        if (!selectedOption) {
            return;
        }

        try {
            setMoveDialog((current) => ({ ...current, saving: true }));
            const updatedOrders = await Promise.all(
                moveDialog.orders.map((order) => mainProductsAPI.updateOrderedTest(order.id, {
                    workflow_status: moveDialog.targetStatus,
                }))
            );
            replaceOrdersInState(updatedOrders);
            const message = moveDialog.orders.length === 1
                ? `Przeniesiono ${moveDialog.orders[0].project_number} do zakładki ${selectedOption.label}.`
                : `Przeniesiono ${moveDialog.orders.length} pozycji do zakładki ${selectedOption.label}.`;
            setSelectedOrderIds([]);
            setSuccess(message);
            setError('');
            setMoveDialog({
                open: false,
                saving: false,
                orders: [],
                targetStatus: 'ordered_tests',
            });
            navigate(selectedOption.path);
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się przenieść pozycji.');
            setMoveDialog((current) => ({ ...current, saving: false }));
        }
    };

    const openDocumentsDialog = (targetOrders, mode = 'add') => {
        const normalizedOrders = Array.isArray(targetOrders) ? targetOrders : [targetOrders];
        setDocumentsDialog({
            open: true,
            mode,
            files: Array(DOCUMENT_SLOTS).fill(null),
            previewIndex: null,
            targetOrders: normalizedOrders,
        });
    };

    const closeDocumentsDialog = () => {
        documentsDialog.files.forEach((file) => {
            if (file?.previewUrl) {
                URL.revokeObjectURL(file.previewUrl);
            }
        });

        setDocumentsDialog({
            open: false,
            mode: 'add',
            files: Array(DOCUMENT_SLOTS).fill(null),
            previewIndex: null,
            targetOrders: [],
        });
    };

    const updateDocumentSlot = (index, file) => {
        setDocumentsDialog((current) => {
            const nextFiles = [...current.files];
            if (nextFiles[index]?.previewUrl) {
                URL.revokeObjectURL(nextFiles[index].previewUrl);
            }
            nextFiles[index] = file
                ? {
                    file,
                    name: file.name,
                    previewUrl: URL.createObjectURL(file),
                }
                : null;

            return {
                ...current,
                files: nextFiles,
                previewIndex: file ? index : current.previewIndex === index ? null : current.previewIndex,
            };
        });
    };

    const handleSaveDocuments = () => {
        const selectedDocumentsCount = documentsDialog.files.filter(Boolean).length;
        const targetCount = documentsDialog.targetOrders.length;
        const targetLabel = targetCount === 1
            ? (documentsDialog.targetOrders[0]?.project_number || 'wybranej pozycji')
            : `${targetCount} zaznaczonych pozycji`;
        setSuccess(`Dodano ${selectedDocumentsCount} dokumentów do ${targetLabel}.`);
        setError('');
        closeDocumentsDialog();
    };

    const previewDocument = documentsDialog.previewIndex !== null
        ? documentsDialog.files[documentsDialog.previewIndex]
        : null;
    const isDocumentsPreviewMode = documentsDialog.mode === 'preview';

    const showClarificationColumn = viewMode === 'to_clarify' || viewMode === 'all';

    return (
        <div className="w-full">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-4xl">
                    <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm">
                        {description}
                    </div>
                </div>
                <div className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    Pozycji: <span className="font-semibold text-slate-900">{filteredOrders.length}</span>
                </div>
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

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                <span>Zaznaczone: <span className="font-semibold text-slate-900">{selectedOrderIds.length}</span></span>
                <div className="flex flex-wrap items-center gap-2">
                    {(activeActionStatus === 'ordered_tests') && (
                        <>
                            <button
                                type="button"
                                onClick={() => openDocumentsDialog(selectedOrders)}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={selectedOrderIds.length === 0}
                            >
                                Dokumenty
                            </button>
                            <button
                                type="button"
                                onClick={() => updateOrdersWorkflowStatus(selectedOrders, 'to_pack', `Przeniesiono ${selectedOrderIds.length} pozycji do zakładki Do spakowania.`, '/main-products/to-pack')}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={selectedOrderIds.length === 0}
                            >
                                Przekaż do spakowania
                            </button>
                            <button
                                type="button"
                                onClick={() => selectedOrder && openClarifyDialog(selectedOrder)}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!selectedOrder}
                            >
                                Do wyjaśnienia
                            </button>
                        </>
                    )}
                    {(activeActionStatus === 'to_pack') && (
                        <>
                            <button
                                type="button"
                                onClick={() => selectedOrder && openDocumentsDialog(selectedOrder, 'preview')}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!selectedOrder}
                            >
                                Pokaż dokumenty
                            </button>
                            <button
                                type="button"
                                onClick={() => updateOrdersWorkflowStatus(selectedOrders, 'released', `Przeniesiono ${selectedOrderIds.length} pozycji do zakładki Zwolnione.`, '/main-products/released')}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={selectedOrderIds.length === 0}
                            >
                                Przenieś do zwolnionych
                            </button>
                        </>
                    )}
                    {(activeActionStatus === 'to_clarify') && (
                        <>
                            <button
                                type="button"
                                onClick={() => selectedOrder && openDocumentsDialog(selectedOrder, 'preview')}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!selectedOrder}
                            >
                                Pokaż dokumenty
                            </button>
                            <button
                                type="button"
                                onClick={() => selectedOrder && openNotePreviewDialog(selectedOrder)}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!selectedOrder}
                            >
                                Pokaż notatkę
                            </button>
                            <button
                                type="button"
                                onClick={() => selectedOrder && openClarifyDialog(selectedOrder)}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!selectedOrder}
                            >
                                Edytuj notatkę
                            </button>
                            <button
                                type="button"
                                onClick={() => openMoveDialog(selectedOrders)}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={selectedOrderIds.length === 0 || !selectedStatus}
                            >
                                Przenieś do
                            </button>
                        </>
                    )}
                    {(activeActionStatus === 'released' || activeActionStatus === 'archive') && (
                        <button
                            type="button"
                            onClick={() => selectedOrder && openDocumentsDialog(selectedOrder, 'preview')}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!selectedOrder}
                        >
                            Pokaż dokumenty
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setSelectedOrderIds([])}
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={selectedOrderIds.length === 0}
                    >
                        Wyczyść zaznaczenie
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[calc(100vh-20rem)] overflow-auto">
                    <table className="min-w-[1440px] w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                                <th className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleAllVisibleOrders}
                                        aria-label="Zaznacz wszystkie widoczne badania"
                                    />
                                </th>
                                <th className="px-6 py-4">Numer projektu</th>
                                <th className="px-6 py-4">Numer Asana</th>
                                <th className="px-6 py-4">Numer PO</th>
                                <th className="px-6 py-4">Koszt badania</th>
                                <th className="px-6 py-4">Nazwa projektu / produktu</th>
                                <th className="px-6 py-4">Laboratorium</th>
                                <th className="px-6 py-4">Numer serii</th>
                                <th className="px-6 py-4">Koszt badań</th>
                                <th className="px-6 py-4">Data produkcji</th>
                                <th className="px-6 py-4">Data ważności</th>
                                <th className="px-6 py-4">Data realizacji badania</th>
                                <th className="px-6 py-4">Status</th>
                                {showClarificationColumn && <th className="px-6 py-4">Notatka</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={showClarificationColumn ? 14 : 13} className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie zleconych badań...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={showClarificationColumn ? 14 : 13} className="px-6 py-10 text-center text-slate-500">
                                        Brak pozycji w tym widoku.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const currentStatus = order.workflow_status || 'ordered_tests';
                                    const isOverdue = isPlannedTestDateOverdue(order.planned_test_date);
                                    const statusMeta = STATUS_META[currentStatus] || STATUS_META.ordered_tests;

                                    return (
                                        <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOrderIds.includes(order.id)}
                                                    onChange={() => toggleOrderSelection(order.id)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    aria-label={`Zaznacz badanie ${order.project_number}`}
                                                />
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                                                {order.project_number}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.asana_task_number || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.po_number || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.test_cost || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                {order.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                {order.laboratory_name || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.batch_number || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.test_cost || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.production_date || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.expiry_date || '—'}
                                            </td>
                                            <td className={`whitespace-nowrap px-6 py-4 ${isOverdue ? 'bg-red-200 font-semibold text-slate-900' : 'text-slate-700'}`}>
                                                {order.planned_test_date || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            {showClarificationColumn && (
                                                <td className="min-w-[18rem] px-6 py-4 text-slate-700">
                                                    {order.clarification_note || '—'}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {documentsDialog.open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 md:p-8">
                    <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-xl font-semibold text-slate-900">
                                {isDocumentsPreviewMode ? 'Pokaż dokumenty' : 'Dokumenty'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                {isDocumentsPreviewMode
                                    ? `Dokumenty przypisane do pozycji: ${documentsDialog.targetOrders[0]?.project_number || '—'}`
                                    : documentsDialog.targetOrders.length === 1
                                        ? `Dodaj do 6 dokumentów dla pozycji: ${documentsDialog.targetOrders[0]?.project_number || '—'}`
                                        : `Dodaj do 6 dokumentów dla zaznaczonych pozycji: ${documentsDialog.targetOrders.length}`}
                            </p>
                        </div>
                        <div className="grid gap-4 px-6 py-6">
                            {documentsDialog.files.map((file, index) => {
                                const inputId = `main-product-document-${index + 1}`;

                                return (
                                    <div key={inputId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    Dokument {index + 1}
                                                </div>
                                                <div className="mt-1 text-sm text-slate-600">
                                                    {file ? file.name : 'Nie wybrano pliku.'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id={inputId}
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(event) => updateDocumentSlot(index, event.target.files?.[0] || null)}
                                                />
                                                <label
                                                    htmlFor={inputId}
                                                    className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-white"
                                                >
                                                    Dodaj
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setDocumentsDialog((current) => ({ ...current, previewIndex: index }))}
                                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                                    disabled={!file}
                                                >
                                                    Podgląd
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateDocumentSlot(index, null)}
                                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                                    disabled={!file}
                                                >
                                                    Usuń
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {previewDocument && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">Podgląd PDF</div>
                                            <div className="text-sm text-slate-600">{previewDocument.name}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setDocumentsDialog((current) => ({ ...current, previewIndex: null }))}
                                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                        >
                                            Zamknij podgląd
                                        </button>
                                    </div>
                                    <iframe
                                        title={previewDocument.name}
                                        src={previewDocument.previewUrl}
                                        className="h-[28rem] w-full rounded-2xl border border-slate-200"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
                            <button
                                type="button"
                                onClick={closeDocumentsDialog}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveDocuments}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                            >
                                Zapisz
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {clarifyDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">Do wyjaśnienia</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {clarifyDialog.order?.project_number} / {clarifyDialog.order?.name}
                            </p>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="clarification-note">
                                Notatka
                            </label>
                            <textarea
                                id="clarification-note"
                                value={clarifyDialog.note}
                                onChange={(event) => setClarifyDialog((current) => ({ ...current, note: event.target.value }))}
                                rows={6}
                                placeholder="Wprowadź notatkę do wyjaśnienia"
                                className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeClarifyDialog}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                disabled={clarifyDialog.saving}
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveClarification}
                                disabled={clarifyDialog.saving}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {clarifyDialog.saving ? 'Zapisywanie...' : 'Zapisz i przenieś'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {notePreviewDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">Notatka</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {notePreviewDialog.order?.project_number} / {notePreviewDialog.order?.name}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                            {notePreviewDialog.order?.clarification_note || 'Brak notatki.'}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={closeNotePreviewDialog}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {moveDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">Przenieś do</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {moveDialog.orders.length === 1
                                    ? `${moveDialog.orders[0]?.project_number} / ${moveDialog.orders[0]?.name}`
                                    : `Zaznaczone pozycje: ${moveDialog.orders.length}`}
                            </p>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="move-target-status">
                                Status docelowy
                            </label>
                            <select
                                id="move-target-status"
                                value={moveDialog.targetStatus}
                                onChange={(event) => setMoveDialog((current) => ({ ...current, targetStatus: event.target.value }))}
                                className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                            >
                                {MOVE_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                        disabled={option.value === (moveDialog.orders[0]?.workflow_status || 'ordered_tests')}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeMoveDialog}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                disabled={moveDialog.saving}
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleMoveOrder}
                                disabled={moveDialog.saving}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {moveDialog.saving ? 'Przenoszenie...' : 'Przenieś'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MainProductOrderedTestsPage;
