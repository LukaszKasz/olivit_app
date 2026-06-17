import { Fragment, useEffect, useState } from 'react';
import { variantProductsAPI } from '../api';

const MATERIAL_TYPES = ['Etykieta+opakowanie', 'Kartonik'];
const YES_NO = ['Tak', 'Nie'];
const YES_NO_NA = ['Tak', 'Nie', 'Nie dotyczy'];
const TEST_STATUS_META = {
    ordered_tests: { label: 'Badania zlecone', className: 'bg-amber-100 text-amber-800' },
    to_clarify: { label: 'Do wyjaśnienia', className: 'bg-rose-100 text-rose-800' },
    archive: { label: 'Badania ukończone', className: 'bg-slate-200 text-slate-800' },
};
const LABEL_STATUS_META = {
    current: { label: 'Bieżące', className: 'bg-sky-100 text-sky-800' },
    incorrect: { label: 'Błędne', className: 'bg-rose-100 text-rose-800' },
    correct: { label: 'Poprawne', className: 'bg-emerald-100 text-emerald-800' },
};

function buildDefaultCoaConclusion(projectNumber) {
    return `The product meets the requirements of the product specification in accordance with the product sheet ${projectNumber}.\nProdukt spełnia wymagania specyfikacji produktu zgodnie z kartą produktu ${projectNumber}.`;
}

const CONTROL_QUESTION_FIELDS = [
    {
        field: 'active_substances_match_pds',
        noteField: 'active_substances_match_pds_note',
        label: 'Czy zawartość substancji aktywnych na etykiecie jest zgodna ze specyfikacją analityczną w PDS?',
        options: YES_NO_NA,
    },
    {
        field: 'label_version_matches_used_version',
        noteField: 'label_version_matches_used_version_note',
        label: 'Aktualna wersja etykiety/kartonika jest zgodna z użytą wersją etykiety/kartonika',
        options: YES_NO,
    },
    {
        field: 'has_printing_errors',
        noteField: 'has_printing_errors_note',
        label: 'Czy na opakowaniu znajdują się błędy drukarskie? (np. pogrubienie)',
        options: YES_NO,
    },
    {
        field: 'has_graphic_design_errors',
        noteField: 'has_graphic_design_errors_note',
        label: 'Czy na opakowaniu znajdują się błędy w projekcie graficznym?',
        options: YES_NO,
    },
    {
        field: 'print_correctness',
        noteField: 'print_correctness_note',
        label: 'Poprawność nadruku (TP/partia; np. ścieranie się)',
        options: YES_NO,
    },
    {
        field: 'has_labeling_errors',
        noteField: 'has_labeling_errors_note',
        label: 'Czy opakowanie posiada błędy w sposobie oklejenia (krzywa etykieta, zagięcia, ślady kleju)?',
        options: YES_NO,
    },
    {
        field: 'cap_is_correct',
        noteField: 'cap_is_correct_note',
        label: 'Nakrętka: czy jest prawidłowa (np. bez marmurku)',
        options: YES_NO_NA,
    },
    {
        field: 'induction_seal_weld_correct',
        noteField: 'induction_seal_weld_correct_note',
        label: 'Wkładka indukcyjna: poprawność zgrzewu',
        options: YES_NO_NA,
    },
    {
        field: 'induction_seal_opening_correct',
        noteField: 'induction_seal_opening_correct_note',
        label: 'Wkładka indukcyjna: poprawność otwierania',
        options: YES_NO_NA,
    },
    {
        field: 'package_is_dirty',
        noteField: 'package_is_dirty_note',
        label: 'Czy opakowanie jest zabrudzone?',
        options: YES_NO,
    },
    {
        field: 'package_is_damaged',
        noteField: 'package_is_damaged_note',
        label: 'Czy opakowanie jest uszkodzone (np. wgniecenie, pęknięcie)',
        options: YES_NO,
    },
    {
        field: 'qr_code_is_active',
        noteField: 'qr_code_is_active_note',
        label: 'Czy kod QR jest aktywny?',
        options: YES_NO_NA,
    },
    {
        field: 'package_contents_match_card',
        noteField: 'package_contents_match_card_note',
        label: 'Zawartość opakowania zgodna z Kartą Produktu (w tym miarka przy proszkach)',
        options: YES_NO,
    },
    {
        field: 'product_verified',
        noteField: 'product_verified_note',
        label: 'Poprawność produktu została zweryfikowana',
        options: YES_NO,
    },
];

function createInitialForm(order = null) {
    return {
        ordered_test_id: order?.test_order_id || order?.id || null,
        sku: order?.sku || '',
        name: order?.name || '',
        ean: order?.ean || '',
        printed_material_type: '',
        product_name: order?.product_name || order?.name || '',
        product_project_number: order?.product_project_number || order?.project_number || '',
        product_ean_number: '',
        product_batch_number: '',
        product_expiry_date: '',
        control_date: '',
        market_label_version: '',
        active_substances_match_pds: '',
        active_substances_match_pds_note: '',
        label_version_matches_used_version: '',
        label_version_matches_used_version_note: '',
        has_printing_errors: '',
        has_printing_errors_note: '',
        has_graphic_design_errors: '',
        has_graphic_design_errors_note: '',
        print_correctness: '',
        print_correctness_note: '',
        has_labeling_errors: '',
        has_labeling_errors_note: '',
        cap_is_correct: '',
        cap_is_correct_note: '',
        induction_seal_weld_correct: '',
        induction_seal_weld_correct_note: '',
        induction_seal_opening_correct: '',
        induction_seal_opening_correct_note: '',
        package_is_dirty: '',
        package_is_dirty_note: '',
        package_is_damaged: '',
        package_is_damaged_note: '',
        qr_code_is_active: '',
        qr_code_is_active_note: '',
        package_contents_match_card: '',
        package_contents_match_card_note: '',
        product_verified: '',
        product_verified_note: '',
        comment: '',
    };
}

function FormField({ label, required = false, children }) {
    return (
        <label className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 md:grid-cols-[minmax(280px,420px)_1fr] md:items-start">
            <span className="text-sm font-medium text-slate-700">
                {label}
                {required ? ' *' : ''}
            </span>
            <div>{children}</div>
        </label>
    );
}

function SelectField({ label, value, onChange, options }) {
    return (
        <FormField label={label} required>
            <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                {options.map((option) => (
                    <label key={option} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-900">
                        <input
                            type="radio"
                            value={option}
                            checked={value === option}
                            onChange={onChange}
                            className="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span>{option}</span>
                    </label>
                ))}
            </div>
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

function renderFinishedControlValue(value, highlightNegative = false) {
    const displayValue = value || '—';
    const isNegative = highlightNegative && value === 'Nie';

    if (!isNegative) {
        return displayValue;
    }

    return (
        <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
            {displayValue}
        </span>
    );
}

function isAffirmative(value) {
    return value === 'Tak' || value === 'Nie dotyczy';
}

function hasFinishedProductControlIssues(row) {
    return [
        !isAffirmative(row.active_substances_match_pds),
        row.label_version_matches_used_version !== 'Tak',
        row.has_printing_errors !== 'Nie',
        row.has_graphic_design_errors !== 'Nie',
        row.print_correctness !== 'Tak',
        row.has_labeling_errors !== 'Nie',
        !isAffirmative(row.cap_is_correct),
        !isAffirmative(row.induction_seal_weld_correct),
        !isAffirmative(row.induction_seal_opening_correct),
        row.package_is_dirty !== 'Nie',
        row.package_is_damaged !== 'Nie',
        !isAffirmative(row.qr_code_is_active),
        row.package_contents_match_card !== 'Tak',
        row.product_verified !== 'Tak',
    ].some(Boolean);
}

function VariantProductBatchOrderedTestsPage({
    title = 'Produkty spakowane / Warianty - Badania zlecone',
    description = 'Dane pobierane z tabeli zleconych badań partii wariantów w bazie PostgreSQL.',
    enableFinishedProductControl = false,
    archiveMode = false,
    viewMode = 'ordered_tests',
    finishedProductControlFilter = 'all',
    allowCreateFinishedProductControl = true,
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
    const [statusDecisionDialog, setStatusDecisionDialog] = useState({
        open: false,
        labelStatus: '',
    });
    const [commentPreviewDialog, setCommentPreviewDialog] = useState({
        open: false,
        row: null,
    });
    const [selectedRowIds, setSelectedRowIds] = useState([]);
    const [coaDialog, setCoaDialog] = useState({
        open: false,
        loading: false,
        saving: false,
        projectNumber: '',
        details: [],
        selectedDetailIds: [],
        linkedDocumentNames: [],
        selectedLinkedDocumentNames: [],
        conclusionText: '',
    });
    const [documentsDialog, setDocumentsDialog] = useState({
        open: false,
        saving: false,
        existingDocumentNames: [],
        files: Array(6).fill(null),
        previewIndex: null,
    });
    const [moveDialog, setMoveDialog] = useState({
        open: false,
        saving: false,
        targetStatus: 'archive',
        note: '',
    });
    const highlightNegativeFinishedControlValues = enableFinishedProductControl && finishedProductControlFilter === 'incorrect';

    const loadRows = async () => {
        const data = enableFinishedProductControl
            ? await variantProductsAPI.getFinishedProductControls()
            : archiveMode
                ? await variantProductsAPI.getArchivedBatchTests()
                : viewMode === 'to_clarify'
                    ? await variantProductsAPI.getClarificationBatchTests()
                    : await variantProductsAPI.getOrderedBatchTests();
        return Array.isArray(data) ? data : [];
    };

    useEffect(() => {
        const fetchRows = async () => {
            try {
                setLoading(true);
                setRows(await loadRows());
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

        fetchRows();
    }, [archiveMode, enableFinishedProductControl, viewMode]);

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
        setStatusDecisionDialog({
            open: false,
            labelStatus: '',
        });
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
    const isControlFormValid = () => {
        const requiredFields = [
            'printed_material_type',
            'product_name',
            'product_project_number',
            'product_ean_number',
            'product_batch_number',
            'product_expiry_date',
            'control_date',
            'market_label_version',
            ...CONTROL_QUESTION_FIELDS.map((field) => field.field),
        ];

        if (requiredFields.some((field) => !String(dialog.form[field] || '').trim())) {
            return false;
        }

        return CONTROL_QUESTION_FIELDS.every(({ field, noteField }) => (
            dialog.form[field] !== 'Nie' || String(dialog.form[noteField] || '').trim()
        ));
    };

    const handleSave = async () => {
        setStatusDecisionDialog({
            open: true,
            labelStatus: '',
        });
    };

    const closeStatusDecisionDialog = () => {
        if (dialog.saving) {
            return;
        }

        setStatusDecisionDialog({
            open: false,
            labelStatus: '',
        });
    };

    const openCommentPreviewDialog = (row) => {
        setCommentPreviewDialog({
            open: true,
            row,
        });
    };

    const closeCommentPreviewDialog = () => {
        setCommentPreviewDialog({
            open: false,
            row: null,
        });
    };

    const openSelectedCommentPreviewDialog = () => {
        if (selectedRowIds.length !== 1) {
            return;
        }

        const selectedRow = rows.find((row) => row.id === selectedRowIds[0]);
        if (!selectedRow) {
            return;
        }

        openCommentPreviewDialog(selectedRow);
    };

    const handleConfirmSave = async () => {
        try {
            setDialog((prev) => ({ ...prev, saving: true }));
            const savedControl = await variantProductsAPI.createFinishedProductControl({
                ...dialog.form,
                label_status: statusDecisionDialog.labelStatus,
            });
            if (enableFinishedProductControl && finishedProductControlFilter === 'current') {
                setRows((current) => current.filter((row) => row.id !== savedControl.id));
            } else {
                setRows(await loadRows());
            }
            setSelectedRowIds([]);
            setSuccess(`Zapisano kontrolę produktu gotowego dla ${dialog.form.sku} i przeniesiono do zakładki ${statusDecisionDialog.labelStatus === 'incorrect' ? 'Błędne' : 'Poprawne'}.`);
            setError('');
            setDialogError('');
            setDialog({
                open: false,
                saving: false,
                form: createInitialForm(),
            });
            setStatusDecisionDialog({
                open: false,
                labelStatus: '',
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
        if (enableFinishedProductControl) {
            const labelStatus = row.label_status || 'current';

            if (finishedProductControlFilter === 'current' && labelStatus !== 'current') {
                return false;
            }

            if (finishedProductControlFilter === 'correct' && labelStatus !== 'correct') {
                return false;
            }

            if (finishedProductControlFilter === 'incorrect' && labelStatus !== 'incorrect') {
                return false;
            }
        }

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
    const displayCount = filteredRows.length;

    const toggleRowSelection = (rowId) => {
        setSelectedRowIds((current) => {
            if (enableFinishedProductControl) {
                return current.includes(rowId) ? [] : [rowId];
            }

            return current.includes(rowId)
                ? current.filter((id) => id !== rowId)
                : [...current, rowId];
        });
    };

    const toggleAllVisibleRows = () => {
        if (enableFinishedProductControl) {
            return;
        }

        setSelectedRowIds((current) =>
            allVisibleSelected
                ? current.filter((id) => !visibleRowIds.includes(id))
                : Array.from(new Set([...current, ...visibleRowIds]))
        );
    };

    const openMoveDialog = () => {
        setMoveDialog({
            open: true,
            saving: false,
            targetStatus: viewMode === 'to_clarify' ? 'ordered_tests' : 'archive',
            note: '',
        });
    };

    const closeMoveDialog = () => {
        if (moveDialog.saving) {
            return;
        }

        setMoveDialog({
            open: false,
            saving: false,
            targetStatus: viewMode === 'to_clarify' ? 'ordered_tests' : 'archive',
            note: '',
        });
    };

    const handleMoveSelected = async () => {
        try {
            setMoveDialog((current) => ({ ...current, saving: true }));
            if (moveDialog.targetStatus === 'archive') {
                await variantProductsAPI.archiveBatchTests(selectedRowIds);
            } else {
                await Promise.all(
                    selectedRowIds.map((id) =>
                        variantProductsAPI.updateBatchTest(id, {
                            workflow_status: moveDialog.targetStatus,
                            clarification_note: moveDialog.targetStatus === 'to_clarify' ? moveDialog.note : '',
                        })
                    )
                );
            }
            setRows(await loadRows());
            setSelectedRowIds([]);
            setSuccess(
                moveDialog.targetStatus === 'to_clarify'
                    ? `Przeniesiono ${selectedRowIds.length} pozycji do zakładki Do wyjaśnienia.`
                    : moveDialog.targetStatus === 'ordered_tests'
                        ? `Przeniesiono ${selectedRowIds.length} pozycji do zakładki Badania zlecone.`
                        : `Przeniesiono ${selectedRowIds.length} pozycji do zakładki Badania ukończone.`
            );
            setError('');
            closeMoveDialog();
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się przenieść pozycji.');
            setMoveDialog((current) => ({ ...current, saving: false }));
        }
    };

    const handleGenerateCoA = async () => {
        const selectedRows = rows.filter((row) => selectedRowIds.includes(row.id));
        const projectNumbers = Array.from(new Set(selectedRows.map((row) => row.project_number).filter(Boolean)));
        const linkedDocumentNames = Array.from(new Set(
            selectedRows.flatMap((row) => Array.isArray(row.linked_document_names) ? row.linked_document_names : [])
        ));

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
                linkedDocumentNames: [],
                selectedLinkedDocumentNames: [],
                conclusionText: buildDefaultCoaConclusion(projectNumbers[0]),
            });
            const details = await variantProductsAPI.getProjectDetails(projectNumbers[0]);
            setCoaDialog({
                open: true,
                loading: false,
                saving: false,
                projectNumber: projectNumbers[0],
                details: Array.isArray(details) ? details : [],
                selectedDetailIds: Array.isArray(details) ? details.map((detail) => detail.id) : [],
                linkedDocumentNames,
                selectedLinkedDocumentNames: linkedDocumentNames,
                conclusionText: buildDefaultCoaConclusion(projectNumbers[0]),
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
                linkedDocumentNames: [],
                selectedLinkedDocumentNames: [],
                conclusionText: '',
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
            linkedDocumentNames: [],
            selectedLinkedDocumentNames: [],
            conclusionText: '',
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

    const toggleCoaLinkedDocument = (documentName) => {
        setCoaDialog((current) => ({
            ...current,
            selectedLinkedDocumentNames: current.selectedLinkedDocumentNames.includes(documentName)
                ? current.selectedLinkedDocumentNames.filter((name) => name !== documentName)
                : [...current.selectedLinkedDocumentNames, documentName],
        }));
    };

    const handleConfirmGenerateCoA = async () => {
        try {
            setCoaDialog((current) => ({ ...current, saving: true }));
            const response = await variantProductsAPI.generateBatchCoA({
                ids: selectedRowIds,
                detail_ids: coaDialog.selectedDetailIds,
                linked_document_names: coaDialog.selectedLinkedDocumentNames,
                conclusion_text: coaDialog.conclusionText,
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
        const selectedRows = rows.filter((row) => selectedRowIds.includes(row.id));
        const existingDocumentNames = Array.from(new Set(
            selectedRows.flatMap((row) => Array.isArray(row.linked_document_names) ? row.linked_document_names : [])
        ));
        setDocumentsDialog({
            open: true,
            saving: false,
            existingDocumentNames,
            files: Array(6).fill(null),
            previewIndex: null,
        });
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
            saving: false,
            existingDocumentNames: [],
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

    const handleSaveDocuments = async () => {
        const documentNames = documentsDialog.files
            .filter(Boolean)
            .map((file) => file.name);
        if (documentNames.length === 0) {
            setError('Wybierz co najmniej jeden plik.');
            return;
        }

        try {
            setDocumentsDialog((current) => ({ ...current, saving: true }));
            await variantProductsAPI.saveBatchDocuments({
                ids: selectedRowIds,
                document_names: documentNames,
            });
            setRows(await loadRows());
            setSuccess(`Dodano ${documentNames.length} nazw dokumentów do zaznaczonych pozycji.`);
            setError('');
            closeDocumentsDialog();
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się zapisać nazw dokumentów.');
            setDocumentsDialog((current) => ({ ...current, saving: false }));
        }
    };

    const previewDocument = documentsDialog.previewIndex !== null
        ? documentsDialog.files[documentsDialog.previewIndex]
        : null;
    const showClarificationColumn = !enableFinishedProductControl && viewMode === 'to_clarify';
    const moveOptions = viewMode === 'to_clarify'
        ? [
            { value: 'ordered_tests', label: 'Badania zlecone' },
            { value: 'archive', label: 'Badania ukończone' },
        ]
        : [
            { value: 'to_clarify', label: 'Do wyjaśnienia' },
            { value: 'archive', label: 'Badania ukończone' },
        ];

    return (
        <div className="w-full">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
                    <p className="mt-2 text-sm text-slate-600">{description}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                        Pozycji: <span className="font-semibold text-slate-900">{displayCount}</span>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                <span>Zaznaczone: <span className="font-semibold text-slate-900">{selectedRowIds.length}</span></span>
                <div className="flex items-center gap-2">
                    {enableFinishedProductControl && allowCreateFinishedProductControl && (
                        <button
                            type="button"
                            onClick={() => openDialog(selectedRowIds.length === 1 ? rows.find((row) => row.id === selectedRowIds[0]) : null)}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length !== 1}
                        >
                            Dodaj kontrolę
                        </button>
                    )}
                    {!enableFinishedProductControl && !archiveMode && (
                        <button
                            type="button"
                            onClick={handleGenerateCoA}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length === 0}
                        >
                            Generuj CoA
                        </button>
                    )}
                    {!enableFinishedProductControl && !archiveMode && (
                        <button
                            type="button"
                            onClick={openDocumentsDialog}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length === 0}
                        >
                            Dodaj dokumenty
                        </button>
                    )}
                    {!enableFinishedProductControl && !archiveMode && (
                        <button
                            type="button"
                            onClick={openMoveDialog}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length === 0}
                        >
                            Przenieś
                        </button>
                    )}
                    {enableFinishedProductControl && finishedProductControlFilter === 'incorrect' && (
                        <button
                            type="button"
                            onClick={openSelectedCommentPreviewDialog}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedRowIds.length !== 1}
                        >
                            Pokaż komentarz
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setSelectedRowIds([])}
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                                        {enableFinishedProductControl ? null : (
                                            <input
                                                type="checkbox"
                                                checked={allVisibleSelected}
                                                onChange={toggleAllVisibleRows}
                                                aria-label="Zaznacz wszystkie widoczne wiersze"
                                            />
                                        )}
                                    </th>
                                    <th className="px-6 py-4">ID badania</th>
                                    <th className="px-6 py-4">ID kontroli etykiety</th>
                                    <th className="px-6 py-4">Numer projektu</th>
                                    <th className="px-6 py-4">Numer wariantu</th>
                                    <th className="w-[22rem] min-w-[22rem] px-6 py-4">Nazwa</th>
                                    <th className="px-6 py-4">EAN</th>
                                    <th className="px-6 py-4">Numer w Asana</th>
                                    <th className="px-6 py-4">Laboratorium</th>
                                    <th className="px-6 py-4">Materiał</th>
                                    <th className="px-6 py-4">Nazwa produktu</th>
                                    <th className="px-6 py-4">Nr projektowy</th>
                                    <th className="px-6 py-4">EAN produktu</th>
                                    <th className="px-6 py-4">Seria produktu</th>
                                    <th className="px-6 py-4">Data ważności produktu</th>
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
                                    <th className="px-6 py-4">Status etykiety</th>
                                    <th className="px-6 py-4">Zweryfikowano</th>
                                    <th className="px-6 py-4">Komentarz</th>
                                    <th className="px-6 py-4">Data utworzenia</th>
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
                                    <th className="px-6 py-4">ID badania</th>
                                    <th className="px-6 py-4">ID kontroli etykiety</th>
                                    <th className="px-6 py-4">Numer projektu</th>
                                    <th className="px-6 py-4">Numer wariantu</th>
                                    <th className="w-[22rem] min-w-[22rem] px-6 py-4">Nazwa</th>
                                    <th className="px-6 py-4">EAN</th>
                                    <th className="px-6 py-4">Numer w Asana</th>
                                    <th className="px-6 py-4">Numer serii</th>
                                    <th className="px-6 py-4">Status badań</th>
                                    <th className="px-6 py-4">Status etykiety</th>
                                    <th className="px-6 py-4">Data produkcji</th>
                                    <th className="px-6 py-4">Data ważności</th>
                                    <th className="px-6 py-4">Plan. realizacji</th>
                                    <th className="px-6 py-4">Data dodania serii</th>
                                    <th className="px-6 py-4">Data zlecenia</th>
                                    <th className="px-6 py-4">Laboratorium</th>
                                    <th className="px-6 py-4">Materiał</th>
                                    <th className="px-6 py-4">Nazwa produktu</th>
                                    <th className="px-6 py-4">Nr projektowy</th>
                                    <th className="px-6 py-4">EAN produktu</th>
                                    <th className="px-6 py-4">Seria produktu</th>
                                    <th className="px-6 py-4">Data ważności produktu</th>
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
                                    {showClarificationColumn && <th className="px-6 py-4">Notatka</th>}
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={enableFinishedProductControl ? 34 : showClarificationColumn ? 41 : 40} className="px-6 py-10 text-center text-slate-500">
                                        {enableFinishedProductControl ? 'Ładowanie kontroli produktu gotowego...' : 'Ładowanie zleconych badań partii...'}
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan={enableFinishedProductControl ? 34 : showClarificationColumn ? 41 : 40} className="px-6 py-10 text-center text-slate-500">
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
                                            {row.test_order_id ?? '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                            {row.label_control_id ?? '—'}
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
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.asana_task_number || '—'}</td>
                                                <td className="px-6 py-4 text-slate-700">{row.laboratory_name || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.printed_material_type || '—'}</td>
                                                <td className="px-6 py-4 text-slate-700">{row.product_name || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_project_number || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_ean_number || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_batch_number || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.product_expiry_date || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.control_date || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.market_label_version || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.active_substances_match_pds, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.label_version_matches_used_version, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.has_printing_errors, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.has_graphic_design_errors, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.print_correctness, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.has_labeling_errors, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.cap_is_correct, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.induction_seal_weld_correct, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.induction_seal_opening_correct, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.package_is_dirty, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.package_is_damaged, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.qr_code_is_active, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.package_contents_match_card, highlightNegativeFinishedControlValues)}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{LABEL_STATUS_META[row.label_status || 'current']?.label || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{renderFinishedControlValue(row.product_verified, highlightNegativeFinishedControlValues)}</td>
                                                <td className="px-6 py-4 text-slate-700">{row.comment || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.created_at ? new Date(row.created_at).toLocaleString('pl-PL') : '—'}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="w-[22rem] min-w-[22rem] px-6 py-4"><TwoLineNameCell>{row.name}</TwoLineNameCell></td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.ean}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.asana_task_number || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.batch_number}</td>
                                                <td className="px-6 py-4 text-slate-700">
                                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${(TEST_STATUS_META[row.workflow_status || 'ordered_tests'] || TEST_STATUS_META.ordered_tests).className}`}>
                                                        {(TEST_STATUS_META[row.workflow_status || 'ordered_tests'] || TEST_STATUS_META.ordered_tests).label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-700">
                                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${(LABEL_STATUS_META[row.label_status || 'current'] || LABEL_STATUS_META.current).className}`}>
                                                        {(LABEL_STATUS_META[row.label_status || 'current'] || LABEL_STATUS_META.current).label}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.production_date || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.expiry_date || '—'}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-700">{row.planned_test_date || '—'}</td>
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
                                                {showClarificationColumn && <td className="px-6 py-4 text-slate-700">{row.clarification_note || '—'}</td>}
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
                    <div className="flex max-h-[calc(100vh-48px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-xl font-semibold text-slate-900">Kontrola produktu gotowego</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Wariant: {dialog.form.sku} | {dialog.form.name}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            <div className="grid gap-4">
                            <FormField label="Nazwa produktu" required>
                                <input type="text" value={dialog.form.product_name} onChange={(event) => updateField('product_name', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <FormField label="Numer projektowy produktu" required>
                                <input type="text" value={dialog.form.product_project_number} onChange={(event) => updateField('product_project_number', event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            <SelectField label="Rodzaj materiału zadrukowanego" value={dialog.form.printed_material_type} onChange={(event) => updateField('printed_material_type', event.target.value)} options={MATERIAL_TYPES} />
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
                            {CONTROL_QUESTION_FIELDS.map(({ field, noteField, label, options }) => (
                                <FormField key={field} label={label} required>
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                                            {options.map((option) => (
                                                <label key={option} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-900">
                                                    <input
                                                        type="radio"
                                                        value={option}
                                                        checked={dialog.form[field] === option}
                                                        onChange={(event) => updateField(field, event.target.value)}
                                                        className="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500"
                                                    />
                                                    <span>{option}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {dialog.form[field] === 'Nie' && (
                                            <textarea
                                                value={dialog.form[noteField]}
                                                onChange={(event) => updateField(noteField, event.target.value)}
                                                rows={3}
                                                placeholder="Wpisz uwagi"
                                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                        )}
                                    </div>
                                </FormField>
                            ))}
                            <FormField label="Komentarz">
                                <textarea value={dialog.form.comment} onChange={(event) => updateField('comment', event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500" />
                            </FormField>
                            </div>
                        </div>
                        {dialogError && (
                            <div className="border-t border-slate-200 px-6 py-4">
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {dialogError}
                                </div>
                            </div>
                        )}
                        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-5">
                            <button type="button" onClick={closeDialog} disabled={dialog.saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={dialog.saving || !isControlFormValid()}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {dialog.saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {statusDecisionDialog.open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">Przenieś po zapisie</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Wybierz docelowy status etykiety dla zapisywanej kontroli.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900">
                                <input
                                    type="radio"
                                    value="incorrect"
                                    checked={statusDecisionDialog.labelStatus === 'incorrect'}
                                    onChange={(event) => setStatusDecisionDialog((current) => ({ ...current, labelStatus: event.target.value }))}
                                    className="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500"
                                />
                                <span>Błędne</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900">
                                <input
                                    type="radio"
                                    value="correct"
                                    checked={statusDecisionDialog.labelStatus === 'correct'}
                                    onChange={(event) => setStatusDecisionDialog((current) => ({ ...current, labelStatus: event.target.value }))}
                                    className="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500"
                                />
                                <span>Poprawne</span>
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeStatusDecisionDialog}
                                disabled={dialog.saving}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSave}
                                disabled={dialog.saving || !statusDecisionDialog.labelStatus}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {dialog.saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {commentPreviewDialog.open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">Komentarz</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {commentPreviewDialog.row?.sku} / {commentPreviewDialog.row?.name}
                            </p>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                            {commentPreviewDialog.row?.comment || 'Brak komentarza.'}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={closeCommentPreviewDialog}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {coaDialog.open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 md:p-8">
                    <div className="flex max-h-[calc(100vh-48px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 className="text-xl font-semibold text-slate-900">Generuj CoA</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Wybierz informacje szczegółowe dla projektu {coaDialog.projectNumber}.
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5">
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
                                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="mb-3 text-sm font-medium text-slate-900">LINKED DOCUMENTS / DOKUMENTY ZWIĄZANE</div>
                                        {coaDialog.linkedDocumentNames.length === 0 ? (
                                            <div className="text-sm text-slate-500">
                                                Brak nazw dokumentów dodanych wcześniej do zaznaczonych badań.
                                            </div>
                                        ) : (
                                            <div className="grid gap-2">
                                                {coaDialog.linkedDocumentNames.map((documentName) => (
                                                    <label key={documentName} className="inline-flex items-center gap-3 text-sm text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={coaDialog.selectedLinkedDocumentNames.includes(documentName)}
                                                            onChange={() => toggleCoaLinkedDocument(documentName)}
                                                        />
                                                        <span>{documentName}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <label className="block">
                                            <span className="mb-3 block text-sm font-medium text-slate-900">CONCLUSION / WNIOSEK</span>
                                            <textarea
                                                value={coaDialog.conclusionText}
                                                onChange={(event) => setCoaDialog((current) => ({ ...current, conclusionText: event.target.value }))}
                                                rows={4}
                                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                                            />
                                        </label>
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
                        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-5">
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
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-sm font-semibold text-slate-900">Zapisane nazwy dokumentów</div>
                                {documentsDialog.existingDocumentNames.length === 0 ? (
                                    <div className="mt-2 text-sm text-slate-500">
                                        Brak zapisanych nazw dokumentów dla zaznaczonych badań.
                                    </div>
                                ) : (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {documentsDialog.existingDocumentNames.map((documentName) => (
                                            <span key={documentName} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700">
                                                {documentName}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                                    className={`rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-white ${documentsDialog.saving ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                                                >
                                                    Dodaj
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setDocumentsDialog((current) => ({ ...current, previewIndex: index }))}
                                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                                    disabled={!file || documentsDialog.saving}
                                                >
                                                    Podgląd
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateDocumentSlot(index, null)}
                                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                                    disabled={!file || documentsDialog.saving}
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
                                disabled={documentsDialog.saving}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveDocuments}
                                disabled={documentsDialog.saving}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {documentsDialog.saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {moveDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                    <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-slate-900">Przenieś</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Zaznaczone pozycje: {selectedRowIds.length}
                            </p>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-move-target-status">
                                Status docelowy
                            </label>
                            <select
                                id="variant-move-target-status"
                                value={moveDialog.targetStatus}
                                onChange={(event) => setMoveDialog((current) => ({ ...current, targetStatus: event.target.value }))}
                                className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                            >
                                {moveOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {moveDialog.targetStatus === 'to_clarify' && (
                            <div className="mb-6">
                                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-clarification-note">
                                    Notatka
                                </label>
                                <textarea
                                    id="variant-clarification-note"
                                    value={moveDialog.note}
                                    onChange={(event) => setMoveDialog((current) => ({ ...current, note: event.target.value }))}
                                    rows={5}
                                    placeholder="Wprowadź notatkę do wyjaśnienia"
                                    className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
                                />
                            </div>
                        )}
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
                                onClick={handleMoveSelected}
                                disabled={moveDialog.saving || (moveDialog.targetStatus === 'to_clarify' && !moveDialog.note.trim())}
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

export default VariantProductBatchOrderedTestsPage;
