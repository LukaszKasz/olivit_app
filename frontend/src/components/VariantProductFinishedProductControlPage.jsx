import { useEffect, useState } from 'react';
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
        printed_material_type: 'Etykieta+opakowanie',
        product_name: order?.product_name || order?.name || '',
        product_project_number: order?.product_project_number || '',
        product_ean_number: order?.product_ean_number || order?.ean || '',
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

function VariantProductFinishedProductControlPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [dialogError, setDialogError] = useState('');
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

    useEffect(() => {
        const loadRows = async () => {
            try {
                setLoading(true);
                const data = await variantProductsAPI.getOrderedBatchTests();
                setRows(Array.isArray(data) ? data : []);
                setError('');
            } catch (err) {
                setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać zleconych badań partii.');
            } finally {
                setLoading(false);
            }
        };

        loadRows();
    }, []);

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
        event.preventDefault();
        setContextMenu({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            row,
        });
    };

    const openDialog = (row = contextMenu.row) => {
        if (!row) {
            return;
        }

        setDialog({
            open: true,
            saving: false,
            form: createInitialForm(row),
        });
        setDialogError('');
        setContextMenu({ visible: false, x: 0, y: 0, row: null });
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

    const filteredRows = rows.filter((row) => {
        const value = searchQuery.trim().toLowerCase();
        if (!value) {
            return true;
        }

        return [row.sku, row.name, row.ean, row.batch_number].some((field) =>
            String(field || '').toLowerCase().includes(value)
        );
    });

    return (
        <div className="w-full">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Warianty produktów / Kontrola produktu gotowego</h1>
                    <p className="mt-2 text-sm text-slate-600">Tabela prezentuje te same partie i produkty co widok badań zleconych. Kliknij prawym przyciskiem na wiersz, aby wypełnić formularz.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    Pozycji: <span className="font-semibold text-slate-900">{rows.length}</span>
                </div>
            </div>

            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="variant-product-finished-control-search">
                    Wyszukiwanie
                </label>
                <input
                    id="variant-product-finished-control-search"
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
                            <tr>
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
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="30" className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie zleconych badań partii...
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="30" className="px-6 py-10 text-center text-slate-500">
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
                                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">{row.sku}</td>
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
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {contextMenu.visible && (
                <div
                    className="absolute z-40 min-w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        type="button"
                        onClick={() => openDialog()}
                        className="w-full rounded-xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                        Wypełnij formularz
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
        </div>
    );
}

export default VariantProductFinishedProductControlPage;
