import { Fragment, useEffect, useState } from 'react';
import { variantProductsAPI } from '../api';

const MATERIAL_TYPES = ['Etykieta+opakowanie', 'Kartonik'];
const YES_NO = ['Tak', 'Nie'];
const YES_NO_NA = ['Tak', 'Nie', 'Nie dotyczy'];

function createInitialForm(order = null) {
    const today = new Date().toISOString().slice(0, 10);

    return {
        ordered_test_id: order?.id || null,
        sku: order?.sku || '',
        name: order?.name || '',
        ean: order?.ean || '',
        printed_material_type: order?.printed_material_type || 'Etykieta+opakowanie',
        product_name: order?.product_name || order?.name || '',
        product_project_number: order?.product_project_number || '',
        product_ean_number: order?.ean || '',
        product_batch_number: order?.product_batch_number || order?.batch_number || '',
        product_expiry_date: order?.product_expiry_date || '',
        control_date: order?.control_date || today,
        market_label_version: order?.market_label_version || '',
        active_substances_match_pds: order?.active_substances_match_pds || 'Tak',
        label_version_matches_used_version: order?.label_version_matches_used_version || 'Tak',
        has_printing_errors: order?.has_printing_errors || 'Nie',
        has_graphic_design_errors: order?.has_graphic_design_errors || 'Nie',
        print_correctness: order?.print_correctness || 'Tak',
        has_labeling_errors: order?.has_labeling_errors || 'Nie',
        cap_is_correct: order?.cap_is_correct || 'Tak',
        induction_seal_weld_correct: order?.induction_seal_weld_correct || 'Tak',
        induction_seal_opening_correct: order?.induction_seal_opening_correct || 'Tak',
        package_is_dirty: order?.package_is_dirty || 'Nie',
        package_is_damaged: order?.package_is_damaged || 'Nie',
        qr_code_is_active: order?.qr_code_is_active || 'Tak',
        package_contents_match_card: order?.package_contents_match_card || 'Tak',
        product_verified: order?.product_verified || 'Tak',
        comment: order?.comment || '',
    };
}

function FormField({ label, required = false, children }) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
                {label}
                {required ? ' *' : ''}
            </span>
            {children}
        </label>
    );
}

function SelectField({ label, value, onChange, options }) {
    return (
        <FormField label={label} required>
            <select
                value={value}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </FormField>
    );
}

function TwoLineNameCell({ children }) {
    return (
        <div
            className="w-[22rem] min-w-[22rem] overflow-hidden text-slate-700"
            style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
            }}
            title={children || ''}
        >
            {children}
        </div>
    );
}

function VariantProductBatchOrderedTestsPage({
    title = 'Warianty produktów / Partie / Badania zlecone',
    description = 'Dane pobierane z tabeli zleconych badań partii wariantów w bazie PostgreSQL.',
    enableFinishedProductControl = false,
    archiveMode = false,
}) {
    const [rows, setRows] = useState([]);
    const [pickerRows, setPickerRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [dialogError, setDialogError] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        row: null,
    });
    const [dialog, setDialog] = useState({
        open: false,
        saving: false,
        form: createInitialForm(),
    });
    const [selectedRowIds, setSelectedRowIds] = useState([]);
    const [coaDialog, setCoaDialog] = useState({
        open: false,
        loading: false,
        saving: false,
        projectNumber: '',
        details: [],
        selectedDetailIds: [],
    });
    const [documentsDialog, setDocumentsDialog] = useState({
        open: false,
        files: Array(6).fill(null),
        previewIndex: null,
    });

    useEffect(() => {
        const loadRows = async () => {
            try {
                setLoading(true);
                const data = enableFinishedProductControl
                    ? await variantProductsAPI.getFinishedProductControls()
                    : archiveMode
                        ? await variantProductsAPI.getArchivedBatchTests()
                        : await variantProductsAPI.getOrderedBatchTests();
                setRows(Array.isArray(data) ? data : []);
                setError('');
            } catch (err) {
                setError(
                    err?.response?.data?.detail
                    || err.message
                    || (enableFinishedProductControl
                        ? 'Nie udało się pobrać kontroli produktu gotowego.'
                        : 'Nie udało się pobrać zleconych badań partii.')
                );
            } finally {
                setLoading(false);
            }
        };

        loadRows();
    }, [archiveMode, enableFinishedProductControl]);

    useEffect(() => {
        if (!contextMenu.visible) {
            return undefined;
        }

        const closeContextMenu = () => {
            setContextMenu({ visible: false, x: 0, y: 0, row: null });
        };

        window.addEventListener('click', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);

        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, [contextMenu.visible]);

    const handleContextMenu = (event, row) => {
        if (!enableFinishedProductControl) {
            return;
        }

        event.preventDefault();
        setContextMenu({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            row,
        });
    };

    const openDialog = (sourceRow = contextMenu.row) => {
        if (!sourceRow) {
            return;
        }

        setDialog({
            open: true,
            saving: false,
            form: createInitialForm(sourceRow),
        });
        setDialogError('');
        setContextMenu({ visible: false, x: 0, y: 0, row: null });
        setPickerOpen(false);
    };

    const openPicker = async () => {
        try {
            setPickerOpen(true);
            setPickerLoading(true);
            const data = await variantProductsAPI.getOrderedBatchTests();
            setPickerRows(Array.isArray(data) ? data : []);
            setPickerQuery('');
            setError('');
        } catch (err) {
            setPickerOpen(false);
            setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać zleconych badań partii.');
        } finally {
            setPickerLoading(false);
        }
    };

    const closePicker = () => {
        setPickerOpen(false);
        setPickerQuery('');
    };

    const closeDialog = () => {
        if (dialog.saving) {
            return;
        }

        setDialog({
            open: false,
            saving: false,
            form: createInitialForm(),
        });
        setDialogError('');
    };

    const updateField = (field, value) => {
        setDialog((prev) => ({
            ...prev,
            form: {
                ...prev.form,
                [field]: value,
            },
        }));
    };

    const handleSave = async () => {
        try {
            setDialog((prev) => ({ ...prev, saving: true }));
            await variantProductsAPI.createFinishedProductControl(dialog.form);
            const updatedRows = await variantProductsAPI.getOrderedBatchTests();
            setRows(Array.isArray(updatedRows) ? updatedRows : []);
            setSuccess(`Zapisano kontrolę produktu gotowego dla ${dialog.form.sku}, seria: ${dialog.form.product_batch_number}.`);
            setError('');
            setDialogError('');
            setDialog({
                open: false,
                saving: false,
                form: createInitialForm(),
            });
        } catch (err) {
            setDialogError(err?.response?.data?.detail || err.message || 'Nie udało się zapisać kontroli produktu gotowego.');
            setDialog((prev) => ({ ...prev, saving: false }));
        }
    };

    const filteredPickerRows = pickerRows.filter((row) => {
        const value = pickerQuery.trim().toLowerCase();
        if (!value) {
            return true;
        }

        return [row.sku, row.name, row.ean, row.batch_number].some((field) =>
            String(field || '').toLowerCase().includes(value)
        );
    });

    const filteredRows = rows.filter((row) => {
        const value = searchQuery.trim().toLowerCase();
        if (!value) {
            return true;
        }

        return [row.sku, row.name, row.ean, row.batch_number].some((field) =>
            String(field || '').toLowerCase().includes(value)
        );
    });
    const groupedCoaDetails = coaDialog.details.reduce((groups, detail) => {
        const key = `${detail.parameter_type_en} / ${detail.parameter_type_pl}`;
        const existingGroup = groups.find((group) => group.label === key);

        if (existingGroup) {
            existingGroup.items.push(detail);
            return groups;
        }

        groups.push({
            label: key,
            items: [detail],
        });
        return groups;
    }, []);
    const visibleRowIds = filteredRows.map((row) => row.id);
    const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedRowIds.includes(id));

    const toggleRowSelection = (rowId) => {
        setSelectedRowIds((current) =>
            current.includes(rowId)
                ? current.filter((id) => id !== rowId)
                : [...current, rowId]
        );
    };

    const toggleAllVisibleRows = () => {
        setSelectedRowIds((current) =>
            allVisibleSelected
                ? current.filter((id) => !visibleRowIds.includes(id))
                : Array.from(new Set([...current, ...visibleRowIds]))
        );
    };

    const handleArchiveSelected = async () => {
        try {
            await variantProductsAPI.archiveBatchTests(selectedRowIds);
            const updatedRows = await variantProductsAPI.getOrderedBatchTests();
            setRows(Array.isArray(updatedRows) ? updatedRows : []);
            setSelectedRowIds([]);
            setSuccess(`Przeniesiono do archiwum ${selectedRowIds.length} pozycji.`);
            setError('');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się przenieść pozycji do archiwum.');
        }
    };

    const handleGenerateCoA = async () => {
        const selectedRows = rows.filter((row) => selectedRowIds.includes(row.id));
        const projectNumbers = Array.from(new Set(selectedRows.map((row) => row.project_number).filter(Boolean)));

        if (projectNumbers.length !== 1) {
            setError('Zaznaczone pozycje do CoA muszą mieć ten sam numer projektu.');
            return;
        }

        try {
            setCoaDialog({
                open: true,
                loading: true,
                saving: false,
                projectNumber: projectNumbers[0],
                details: [],
                selectedDetailIds: [],
            });
            const details = await variantProductsAPI.getProjectDetails(projectNumbers[0]);
            setCoaDialog({
                open: true,
                loading: false,
                saving: false,
                projectNumber: projectNumbers[0],
                details: Array.isArray(details) ? details : [],
                selectedDetailIds: Array.isArray(details) ? details.map((detail) => detail.id) : [],
            });
            setError('');
        } catch (err) {
            setCoaDialog({
                open: false,
                loading: false,
                saving: false,
                projectNumber: '',
                details: [],
                selectedDetailIds: [],
            });
            setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać informacji szczegółowych do CoA.');
        }
    };

    const closeCoaDialog = () => {
        if (coaDialog.saving) {
            return;
        }
        setCoaDialog({
            open: false,
            loading: false,
            saving: false,
            projectNumber: '',
            details: [],
            selectedDetailIds: [],
        });
    };

    const toggleCoaDetail = (detailId) => {
        setCoaDialog((current) => ({
            ...current,
            selectedDetailIds: current.selectedDetailIds.includes(detailId)
                ? current.selectedDetailIds.filter((id) => id !== detailId)
                : [...current.selectedDetailIds, detailId],
        }));
    };

    const toggleAllCoaDetails = () => {
        setCoaDialog((current) => ({
            ...current,
            selectedDetailIds: current.selectedDetailIds.length === current.details.length
                ? []
                : current.details.map((detail) => detail.id),
        }));
    };

    const handleConfirmGenerateCoA = async () => {
        try {
            setCoaDialog((current) => ({ ...current, saving: true }));
            const response = await variantProductsAPI.generateBatchCoA({
                ids: selectedRowIds,
                detail_ids: coaDialog.selectedDetailIds,
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const disposition = response.headers['content-disposition'] || '';
            const fileNameMatch = disposition.match(/filename="([^"]+)"/);
            link.href = downloadUrl;
            link.download = fileNameMatch?.[1] || 'certificate_of_analysis.pdf';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
            closeCoaDialog();
            setError('');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się wygenerować CoA.');
            setCoaDialog((current) => ({ ...current, saving: false }));
        }
    };

    const openDocumentsDialog = () => {
        setDocumentsDialog((current) => ({
            ...current,
            open: true,
        }));
    };

    const closeDocumentsDialog = () => {
        documentsDialog.files.forEach((file) => {
            if (file?.previewUrl) {
                URL.revokeObjectURL(file.previewUrl);
            }
        });
        setDocumentsDialog((current) => ({
            ...current,
            open: false,
            files: Array(6).fill(null),
            previewIndex: null,
        }));
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
        setSuccess(`Dodano ${selectedDocumentsCount} dokumentów do zaznaczonych pozycji.`);
        setError('');
        closeDocumentsDialog();
    };

    const previewDocument = documentsDialog.previewIndex !== null
        ? documentsDialog.files[documentsDialog.previewIndex]
        : null;

    return (
        <div className="w-full">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
                    <p className="mt-2 text-sm text-slate-600">{description}</p>
                </div>
                <div className="flex items-center gap-3">
                    {enableFinishedProductControl && (
                        <button
                            type="button"
                            onClick={openPicker}
                            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                            Dodaj kontrolę
                        </button>
                    )}
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                        Pozycji: <span className="font-semibold text-slate-900">{rows.length}</span>
                    </div>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                <span>Zaznaczone: <span className="font-semibold text-slate-900">{selectedRowIds.length}</span></span>
                <div className="flex items-center gap-2">
                    {!enableFinishedProductControl && !archiveMode && (
                        <button
                            type="button"
                            onClick={handleGenerateCoA}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length === 0}
                        >
                            Generuj CoA
                        </button>
                    )}
                    {!enableFinishedProductControl && !archiveMode && (
                        <button
                            type="button"
                            onClick={openDocumentsDialog}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length === 0}
                        >
                            Dodaj dokumenty
                        </button>
                    )}
                    {!enableFinishedProductControl && !archiveMode && (
                        <button
                            type="button"
                            onClick={handleArchiveSelected}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length === 0}
                        >
                            Przenieś do archiwum
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setSelectedRowIds([])}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={selectedRowIds.length === 0}
                    >
                        Wyczyść zaznaczenie
                    </button>
                </div>
            </div>

            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-product-batch-tests-search">
                    Wyszukiwanie
                </label>
                <input
                    id="variant-product-batch-tests-search"
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Szukaj po numerze wariantu, nazwie, numerze serii lub EAN"
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
                            {enableFinishedProductControl ? (
                                <tr>
                                    <th className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            onChange={toggleAllVisibleRows}
                                            aria-label="Zaznacz wszystkie widoczne wiersze"
                                        />
                                    </th>
                                    <th className="px-6 py-4">Numer projektu</th>
                                    <th className="px-6 py-4">Numer wariantu</th>
                                    <th className="w-[22rem] min-w-[22rem] px-6 py-4">Nazwa</th>
                                    <th className="px-6 py-4">EAN</th>
                                    <th className="px-6 py-4">Materiał</th>
                                    <th className="px-6 py-4">Nr projektowy</th>
                                    <th className="px-6 py-4">Nr serii</th>
                                    <th className="px-6 py-4">Data ważności</th>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4">Wersja rynku</th>
                                    <th className="px-6 py-4">Zweryfikowano</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            onChange={toggleAllVisibleRows}
                                            aria-label="Zaznacz wszystkie widoczne wiersze"
                                        />
                                    </th>
                                    <th className="px-6 py-4">Numer projektu</th>
                                    <th className="px-6 py-4">Numer wariantu</th>
                                    <th className="w-[22rem] min-w-[22rem] px-6 py-4">Nazwa</th>
                                    <th className="px-6 py-4">EAN</th>
                                    <th className="px-6 py-4">Numer serii</th>
                                    <th className="px-6 py-4">Data dodania serii</th>
                                    <th className="px-6 py-4">Data zlecenia</th>
                                    <th className="px-6 py-4">Laboratorium</th>
                                    <th className="px-6 py-4">Materiał</th>
                                    <th className="px-6 py-4">Nazwa produktu</th>
                                    <th className="px-6 py-4">Nr projektowy</th>
                                    <th className="px-6 py-4">EAN produktu</th>
                                    <th className="px-6 py-4">Seria produktu</th>
                                    <th className="px-6 py-4">Data ważności</th>
                                    <th className="px-6 py-4">Data kontroli</th>
                                    <th className="px-6 py-4">Wersja rynku</th>
                                    <th className="px-6 py-4">Substancje vs PDS</th>
                                    <th className="px-6 py-4">Wersja etykiety zgodna</th>
                                    <th className="px-6 py-4">Błędy drukarskie</th>
                                    <th className="px-6 py-4">Błędy graficzne</th>
                                    <th className="px-6 py-4">Poprawność nadruku</th>
                                    <th className="px-6 py-4">Błędy oklejenia</th>
                                    <th className="px-6 py-4">Nakrętka</th>
                                    <th className="px-6 py-4">Wkładka zgrzew</th>
                                    <th className="px-6 py-4">Wkładka otwieranie</th>
                                    <th className="px-6 py-4">Zabrudzenie</th>
                                    <th className="px-6 py-4">Uszkodzenie</th>
                                    <th className="px-6 py-4">Kod QR</th>
                                    <th className="px-6 py-4">Zawartość zgodna</th>
                                    <th className="px-6 py-4">Zweryfikowano</th>
                                    <th className="px-6 py-4">Komentarz</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={enableFinishedProductControl ? 12 : 32} className="px-6 py-10 text-center text-slate-500">
                                        {enableFinishedProductControl ? 'Ładowanie kontroli produktu gotowego...' : 'Ładowanie zleconych badań partii...'}
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={enableFinishedProductControl ? 12 : 32} className="px-6 py-10 text-center text-slate-500">
                                        Brak wyników dla podanego wyszukiwania.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="border-t border-slate-100 hover:bg-slate-50/80"
                                        onContextMenu={(event) => handleContextMenu(event, row)}
                                    >
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedRowIds.includes(row.id)}
                                                onChange={() => toggleRowSelection(row.id)}
                                                onClick={(event) => event.stopPropagation()}
                                                aria-label={`Zaznacz wiersz ${row.sku}`}
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                            {row.project_number || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                                            {row.sku}
                                        </td>
                                        {enableFinishedProductControl ? (
                                            <>
                                                <td className="w-[22rem] min-w-[22rem] px-6 py-4"><TwoLineNameCell>{row.name}</TwoLineNameCell></td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.ean}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.printed_material_type}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_project_number}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_batch_number}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_expiry_date}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.control_date}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.market_label_version}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_verified}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="w-[22rem] min-w-[22rem] px-6 py-4"><TwoLineNameCell>{row.name}</TwoLineNameCell></td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.ean}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.batch_number}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.batch_added_at ? new Date(row.batch_added_at).toLocaleString('pl-PL') : '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.ordered_at ? new Date(row.ordered_at).toLocaleString('pl-PL') : '—'}</td>
                                                <td className="px-6 py-4 text-slate-700">{row.laboratory_name || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.printed_material_type || '—'}</td>
                                                <td className="px-6 py-4 text-slate-700">{row.product_name || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_project_number || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_ean_number || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_batch_number || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_expiry_date || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.control_date || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.market_label_version || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.active_substances_match_pds || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.label_version_matches_used_version || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.has_printing_errors || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.has_graphic_design_errors || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.print_correctness || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.has_labeling_errors || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.cap_is_correct || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.induction_seal_weld_correct || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.induction_seal_opening_correct || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.package_is_dirty || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.package_is_damaged || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.qr_code_is_active || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.package_contents_match_card || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_verified || '—'}</td>
                                                <td className="px-6 py-4 text-slate-700">{row.comment || '—'}</td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {pickerOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 md:p-8">
                    <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-xl font-semibold text-slate-900">Wybierz pozycję do kontroli</h2>
                        </div>
                        <div className="px-6 py-5">
                            <input
                                type="text"
                                value={pickerQuery}
                                onChange={(event) => setPickerQuery(event.target.value)}
                                placeholder="Szukaj po numerze wariantu, nazwie, EAN lub numerze serii"
                                className="mb-4 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                            />
                            <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4">Numer wariantu</th>
                                            <th className="px-6 py-4">Nazwa</th>
                                            <th className="px-6 py-4">EAN</th>
                                            <th className="px-6 py-4">Numer serii</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pickerLoading ? (
                                            <tr className="border-t border-slate-100">
                                                <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                                                    Ładowanie danych...
                                                </td>
                                            </tr>
                                        ) : filteredPickerRows.length === 0 ? (
                                            <tr className="border-t border-slate-100">
                                                <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                                                    Brak wyników.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPickerRows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    onClick={() => openDialog(row)}
                                                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                                                >
                                                    <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">{row.sku}</td>
                                                    <td className="w-[22rem] min-w-[22rem] px-6 py-4"><TwoLineNameCell>{row.name}</TwoLineNameCell></td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.ean}</td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.batch_number}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="flex justify-end border-t border-slate-200 px-6 py-5">
                            <button
                                type="button"
                                onClick={closePicker}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {contextMenu.visible && (
                <div
                    className="absolute z-40 min-w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        type="button"
                        onClick={openDialog}
                        className="w-full rounded-xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                        Dodaj kontrolę produktu gotowego
                    </button>
                </div>
            )}

            {dialog.open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 md:p-8">
                    <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-xl font-semibold text-slate-900">Kontrola produktu gotowego</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Wariant: {dialog.form.sku} | {dialog.form.name}
                            </p>
                        </div>
                        <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
                            <SelectField label="Rodzaj materiału zadrukowanego" value={dialog.form.printed_material_type} onChange={(event) => updateField('printed_material_type', event.target.value)} options={MATERIAL_TYPES} />
                            <FormField label="Nazwa produktu" required>
                                <input type="text" value={dialog.form.product_name} onChange={(event) => updateField('product_name', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <FormField label="Numer projektowy produktu" required>
                                <input type="text" value={dialog.form.product_project_number} onChange={(event) => updateField('product_project_number', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <FormField label="Numer EAN produktu" required>
                                <input type="text" value={dialog.form.product_ean_number} onChange={(event) => updateField('product_ean_number', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <FormField label="Numer serii produktu" required>
                                <input type="text" value={dialog.form.product_batch_number} onChange={(event) => updateField('product_batch_number', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <FormField label="Data ważności produktu" required>
                                <input type="date" value={dialog.form.product_expiry_date} onChange={(event) => updateField('product_expiry_date', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <FormField label="Data" required>
                                <input type="date" value={dialog.form.control_date} onChange={(event) => updateField('control_date', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <FormField label="Numer wersji etykiety / kartonika obecny na rynku" required>
                                <input type="text" value={dialog.form.market_label_version} onChange={(event) => updateField('market_label_version', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <SelectField label="Czy zawartość substancji aktywnych na etykiecie jest zgodna ze specyfikacją analityczną w PDS?" value={dialog.form.active_substances_match_pds} onChange={(event) => updateField('active_substances_match_pds', event.target.value)} options={YES_NO_NA} />
                            <SelectField label="Aktualna wersja etykiety/kartonika jest zgodna z użytą wersją etykiety/kartonika" value={dialog.form.label_version_matches_used_version} onChange={(event) => updateField('label_version_matches_used_version', event.target.value)} options={YES_NO} />
                            <SelectField label="Czy na opakowaniu znajdują się błędy drukarskie? (np. pogrubienie)" value={dialog.form.has_printing_errors} onChange={(event) => updateField('has_printing_errors', event.target.value)} options={YES_NO} />
                            <SelectField label="Czy na opakowaniu znajdują się błędy w projekcie graficznym?" value={dialog.form.has_graphic_design_errors} onChange={(event) => updateField('has_graphic_design_errors', event.target.value)} options={YES_NO} />
                            <SelectField label="Poprawność nadruku (TP/partia; np. ścieranie się)" value={dialog.form.print_correctness} onChange={(event) => updateField('print_correctness', event.target.value)} options={YES_NO} />
                            <SelectField label="Czy opakowanie posiada błędy w sposobie oklejenia (krzywa etykieta, zagięcia, ślady kleju)?" value={dialog.form.has_labeling_errors} onChange={(event) => updateField('has_labeling_errors', event.target.value)} options={YES_NO} />
                            <SelectField label="Nakrętka: czy jest prawidłowa (np. bez marmurku)" value={dialog.form.cap_is_correct} onChange={(event) => updateField('cap_is_correct', event.target.value)} options={YES_NO_NA} />
                            <SelectField label="Wkładka indukcyjna: poprawność zgrzewu" value={dialog.form.induction_seal_weld_correct} onChange={(event) => updateField('induction_seal_weld_correct', event.target.value)} options={YES_NO_NA} />
                            <SelectField label="Wkładka indukcyjna: poprawność otwierania" value={dialog.form.induction_seal_opening_correct} onChange={(event) => updateField('induction_seal_opening_correct', event.target.value)} options={YES_NO_NA} />
                            <SelectField label="Czy opakowanie jest zabrudzone?" value={dialog.form.package_is_dirty} onChange={(event) => updateField('package_is_dirty', event.target.value)} options={YES_NO} />
                            <SelectField label="Czy opakowanie jest uszkodzone (np. wgniecenie, pęknięcie)" value={dialog.form.package_is_damaged} onChange={(event) => updateField('package_is_damaged', event.target.value)} options={YES_NO} />
                            <SelectField label="Czy kod QR jest aktywny?" value={dialog.form.qr_code_is_active} onChange={(event) => updateField('qr_code_is_active', event.target.value)} options={YES_NO_NA} />
                            <SelectField label="Zawartość opakowania zgodna z Kartą Produktu (w tym miarka przy proszkach)" value={dialog.form.package_contents_match_card} onChange={(event) => updateField('package_contents_match_card', event.target.value)} options={YES_NO} />
                            <SelectField label="Poprawność produktu została zweryfikowana" value={dialog.form.product_verified} onChange={(event) => updateField('product_verified', event.target.value)} options={YES_NO} />
                            <div className="md:col-span-2">
                                <FormField label="Komentarz">
                                    <textarea value={dialog.form.comment} onChange={(event) => updateField('comment', event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                                </FormField>
                            </div>
                        </div>
                        {dialogError && (
                            <div className="px-6 pb-2">
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {dialogError}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
                            <button type="button" onClick={closeDialog} disabled={dialog.saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                                Anuluj
                            </button>
                            <button type="button" onClick={handleSave} disabled={dialog.saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                                {dialog.saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {coaDialog.open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 md:p-8">
                    <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-xl font-semibold text-slate-900">Generuj CoA</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Wybierz informacje szczegółowe dla projektu {coaDialog.projectNumber}.
                            </p>
                        </div>
                        <div className="px-6 py-5">
                            {coaDialog.loading ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                    Ładowanie informacji szczegółowych...
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                        <span>Zaznaczone informacje: <span className="font-semibold text-slate-900">{coaDialog.selectedDetailIds.length}</span></span>
                                        <button
                                            type="button"
                                            onClick={toggleAllCoaDetails}
                                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-white"
                                        >
                                            {coaDialog.selectedDetailIds.length === coaDialog.details.length ? 'Odznacz wszystko' : 'Zaznacz wszystko'}
                                        </button>
                                    </div>
                                    <div className="max-h-[60vh] overflow-auto rounded-2xl border border-slate-200">
                                        {coaDialog.details.length === 0 ? (
                                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                                                Brak informacji szczegółowych dla wybranego numeru projektu.
                                            </div>
                                        ) : (
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-4"></th>
                                                        <th className="px-4 py-4">Parametr</th>
                                                        <th className="px-4 py-4">Wymaganie</th>
                                                        <th className="px-4 py-4">Metoda</th>
                                                        <th className="px-4 py-4">Potwierdzenie</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupedCoaDetails.map((group) => (
                                                        group.items.map((detail, index) => (
                                                            index === 0 ? (
                                                                <Fragment key={`group-${group.label}-${detail.id}`}>
                                                                    <tr key={`group-${group.label}`} className="border-t border-slate-200 bg-amber-100/80">
                                                                        <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-amber-950">
                                                                            {group.label}
                                                                        </td>
                                                                    </tr>
                                                                    <tr key={detail.id} className="border-t border-slate-100">
                                                                        <td className="px-4 py-4">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={coaDialog.selectedDetailIds.includes(detail.id)}
                                                                                onChange={() => toggleCoaDetail(detail.id)}
                                                                                aria-label={`Zaznacz parametr ${detail.parameter_name_en}`}
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-4 text-slate-700">{detail.parameter_name_en} / {detail.parameter_name_pl}</td>
                                                                        <td className="px-4 py-4 text-slate-700">{detail.requirement_en} / {detail.requirement_pl}</td>
                                                                        <td className="px-4 py-4 text-slate-700">{detail.method_en} / {detail.method_pl}</td>
                                                                        <td className="px-4 py-4 text-slate-700">{detail.confirmation_en || ''} / {detail.confirmation_pl || ''}</td>
                                                                    </tr>
                                                                </Fragment>
                                                            ) : (
                                                                <tr key={detail.id} className="border-t border-slate-100">
                                                                    <td className="px-4 py-4">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={coaDialog.selectedDetailIds.includes(detail.id)}
                                                                            onChange={() => toggleCoaDetail(detail.id)}
                                                                            aria-label={`Zaznacz parametr ${detail.parameter_name_en}`}
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-4 text-slate-700">{detail.parameter_name_en} / {detail.parameter_name_pl}</td>
                                                                    <td className="px-4 py-4 text-slate-700">{detail.requirement_en} / {detail.requirement_pl}</td>
                                                                    <td className="px-4 py-4 text-slate-700">{detail.method_en} / {detail.method_pl}</td>
                                                                    <td className="px-4 py-4 text-slate-700">{detail.confirmation_en || ''} / {detail.confirmation_pl || ''}</td>
                                                                </tr>
                                                            )
                                                        ))
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
                            <button
                                type="button"
                                onClick={closeCoaDialog}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                disabled={coaDialog.saving}
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmGenerateCoA}
                                disabled={coaDialog.loading || coaDialog.saving || coaDialog.selectedDetailIds.length === 0}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {coaDialog.saving ? 'Generowanie...' : 'Generuj PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {documentsDialog.open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 md:p-8">
                    <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-xl font-semibold text-slate-900">Dodaj dokumenty</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Dodaj do 6 dokumentów dla zaznaczonych pozycji: {selectedRowIds.length}
                            </p>
                        </div>
                        <div className="grid gap-4 px-6 py-6">
                            {documentsDialog.files.map((file, index) => {
                                const inputId = `batch-document-${index + 1}`;

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
                                        src={previewDocument.previewUrl}
                                        title={previewDocument.name}
                                        className="h-[70vh] w-full rounded-2xl border border-slate-200"
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
        </div>
    );
}

export default VariantProductBatchOrderedTestsPage;
