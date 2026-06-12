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
    archive: {
        label: 'Archiwum',
        badgeClassName: 'bg-slate-200 text-slate-800',
    },
};

const MOVE_OPTIONS = [
    { value: 'ordered_tests', label: 'Badania zlecone', path: '/main-products/ordered-tests' },
    { value: 'to_pack', label: 'Do spakowania', path: '/main-products/to-pack' },
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
    const [moveDialog, setMoveDialog] = useState({
        open: false,
        saving: false,
        order: null,
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

    const filteredOrders = useMemo(
        () => orders.filter((order) => (order.workflow_status || 'ordered_tests') === viewMode),
        [orders, viewMode]
    );

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

    const handleMoveToPack = async (order) => {
        try {
            const updatedOrder = await mainProductsAPI.updateOrderedTest(order.id, {
                workflow_status: 'to_pack',
            });
            replaceOrderInState(updatedOrder);
            setSuccess(`Przeniesiono ${order.project_number} do zakładki Do spakowania.`);
            setError('');
            navigate('/main-products/to-pack');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się przenieść pozycji do Do spakowania.');
        }
    };

    const handleMoveToArchive = async (order) => {
        try {
            const updatedOrder = await mainProductsAPI.updateOrderedTest(order.id, {
                workflow_status: 'archive',
            });
            replaceOrderInState(updatedOrder);
            setSuccess(`Przeniesiono ${order.project_number} do zakładki Archiwum.`);
            setError('');
            navigate('/main-products/archive');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się przenieść pozycji do Archiwum.');
        }
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

    const openMoveDialog = (order) => {
        const defaultTarget = MOVE_OPTIONS.find((option) => option.value !== (order.workflow_status || 'ordered_tests'));
        setMoveDialog({
            open: true,
            saving: false,
            order,
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
            order: null,
            targetStatus: 'ordered_tests',
        });
    };

    const handleMoveOrder = async () => {
        if (!moveDialog.order) {
            return;
        }

        const selectedOption = MOVE_OPTIONS.find((option) => option.value === moveDialog.targetStatus);
        if (!selectedOption) {
            return;
        }

        try {
            setMoveDialog((current) => ({ ...current, saving: true }));
            const updatedOrder = await mainProductsAPI.updateOrderedTest(moveDialog.order.id, {
                workflow_status: moveDialog.targetStatus,
            });
            replaceOrderInState(updatedOrder);
            setSuccess(`Przeniesiono ${moveDialog.order.project_number} do zakładki ${selectedOption.label}.`);
            setError('');
            setMoveDialog({
                open: false,
                saving: false,
                order: null,
                targetStatus: 'ordered_tests',
            });
            navigate(selectedOption.path);
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się przenieść pozycji.');
            setMoveDialog((current) => ({ ...current, saving: false }));
        }
    };

    const openDocumentsDialog = (order, mode = 'add') => {
        setDocumentsDialog({
            open: true,
            mode,
            files: Array(DOCUMENT_SLOTS).fill(null),
            previewIndex: null,
            targetOrders: [order],
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
        const targetProject = documentsDialog.targetOrders[0]?.project_number || 'wybranej pozycji';
        setSuccess(`Dodano ${selectedDocumentsCount} dokumentów do ${targetProject}.`);
        setError('');
        closeDocumentsDialog();
    };

    const previewDocument = documentsDialog.previewIndex !== null
        ? documentsDialog.files[documentsDialog.previewIndex]
        : null;
    const isDocumentsPreviewMode = documentsDialog.mode === 'preview';

    const showClarificationColumn = viewMode === 'to_clarify';

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

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-[1440px] w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Numer projektu</th>
                                <th className="px-6 py-4">Numer Asana</th>
                                <th className="px-6 py-4">Nazwa projektu / produktu</th>
                                <th className="px-6 py-4">Laboratorium</th>
                                <th className="px-6 py-4">Numer serii</th>
                                <th className="px-6 py-4">Data produkcji</th>
                                <th className="px-6 py-4">Data ważności</th>
                                <th className="px-6 py-4">Data realizacji badania</th>
                                <th className="px-6 py-4">Status</th>
                                {showClarificationColumn && <th className="px-6 py-4">Notatka</th>}
                                <th className="px-6 py-4 text-right">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={showClarificationColumn ? 11 : 10} className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie zleconych badań...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={showClarificationColumn ? 11 : 10} className="px-6 py-10 text-center text-slate-500">
                                        Brak pozycji w tym widoku.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const isOverdue = isPlannedTestDateOverdue(order.planned_test_date);
                                    const statusMeta = STATUS_META[order.workflow_status || 'ordered_tests'] || STATUS_META.ordered_tests;

                                    return (
                                        <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                            <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                                                {order.project_number}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                                {order.asana_task_number || '—'}
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
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2 whitespace-nowrap">
                                                    {viewMode === 'to_clarify' ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openDocumentsDialog(order, 'preview')}
                                                                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                Pokaż dokumenty
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openNotePreviewDialog(order)}
                                                                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                Pokaż notatkę
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openClarifyDialog(order)}
                                                                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                Edytuj notatkę
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openMoveDialog(order)}
                                                                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                Przenieś do
                                                            </button>
                                                        </>
                                                    ) : viewMode === 'to_pack' ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openDocumentsDialog(order, 'preview')}
                                                                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                Pokaż dokumenty
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveToArchive(order)}
                                                                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                            >
                                                                Przenieś do archiwum
                                                            </button>
                                                        </>
                                                    ) : viewMode === 'archive' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openDocumentsDialog(order, 'preview')}
                                                            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            Pokaż dokumenty
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => openDocumentsDialog(order)}
                                                            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            Dodaj dokumenty
                                                        </button>
                                                    )}
                                                    {viewMode === 'ordered_tests' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveToPack(order)}
                                                            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            Przekaż do spakowania
                                                        </button>
                                                    )}
                                                    {viewMode === 'ordered_tests' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openClarifyDialog(order)}
                                                            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            Do wyjaśnienia
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
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
                                {isDocumentsPreviewMode ? 'Pokaż dokumenty' : 'Dodaj dokumenty'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                {isDocumentsPreviewMode
                                    ? `Dokumenty przypisane do pozycji: ${documentsDialog.targetOrders[0]?.project_number || '—'}`
                                    : `Dodaj do 6 dokumentów dla pozycji: ${documentsDialog.targetOrders[0]?.project_number || '—'}`}
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
                                {moveDialog.order?.project_number} / {moveDialog.order?.name}
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
                                        disabled={option.value === (moveDialog.order?.workflow_status || 'ordered_tests')}
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
