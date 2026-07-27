import { useEffect, useState } from 'react';
import { databaseBackupAPI } from '../api';

const TABLE_USAGE = {
    users: ['Logowanie', 'Rejestracja'],
    integration_settings: ['Ustawienia'],
    main_products: ['Bulk / Baza produktów'],
    main_product_test_orders: [
        'Bulk / Baza produktów - Badania zlecone',
        'Bulk / Baza produktów - Wszystkie',
        'Bulk / Baza produktów - Do wyjaśnienia',
        'Bulk / Baza produktów - Do spakowania',
        'Bulk / Baza produktów - Zwolnione',
        'Bulk / Baza produktów - Archiwum',
    ],
    variant_products: ['Produkty spakowane / Warianty'],
    variant_product_batch_test_orders: [
        'Produkty spakowane / Warianty - Badania zlecone',
        'Produkty spakowane / Warianty - Wszystkie',
        'Produkty spakowane / Warianty - Do wyjaśnienia',
        'Produkty spakowane / Warianty - Do zwolnienia',
    ],
    variant_product_batch_test_orders_archive: [
        'Produkty spakowane / Warianty - Do zwolnienia warunkowe',
        'Produkty spakowane / Warianty - Archiwum',
    ],
    variant_product_finished_product_controls: [
        'Produkty spakowane / Warianty - Kontrola produktu gotowego - Bieżące',
        'Produkty spakowane / Warianty - Kontrola produktu gotowego - Do wyjaśnienia',
        'Produkty spakowane / Warianty - Kontrola produktu gotowego - Archiwum',
        'Produkty spakowane / Warianty - Kontrola produktu gotowego - Poprawne',
    ],
    product_detailed_parameters: ['BRD', 'CoA'],
};

function TableCleanupPage() {
    const [loading, setLoading] = useState(true);
    const [clearingTableName, setClearingTableName] = useState('');
    const [tables, setTables] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadTables = async () => {
        setLoading(true);
        setError('');

        try {
            const data = await databaseBackupAPI.getTables();
            setTables(Array.isArray(data?.tables) ? data.tables : []);
        } catch (err) {
            setError(err?.response?.data?.detail || 'Nie udało się pobrać listy tabel.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTables();
    }, []);

    const handleClearTable = async (tableName) => {
        const confirmed = window.confirm(`Czy na pewno wyczyścić wszystkie rekordy z tabeli ${tableName}?`);
        if (!confirmed) {
            return;
        }

        setClearingTableName(tableName);
        setError('');
        setSuccess('');

        try {
            const result = await databaseBackupAPI.clearTable(tableName);
            setSuccess(`Wyczyszczono tabelę ${result.table_name}. Usunięto ${result.deleted_count} rekordów.`);
            await loadTables();
        } catch (err) {
            setError(err?.response?.data?.detail || `Nie udało się wyczyścić tabeli ${tableName}.`);
        } finally {
            setClearingTableName('');
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-semibold text-slate-900">Czyszczenie tabel</h1>
                <p className="mt-2 text-sm text-slate-600">
                    Widok pozwala usunąć wszystkie rekordy z wybranej tabeli. Operacja jest nieodwracalna.
                </p>
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
                <div className="max-h-[calc(100vh-20rem)] overflow-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Tabela</th>
                                <th className="px-6 py-4">Widoki</th>
                                <th className="px-6 py-4">Liczba rekordów</th>
                                <th className="px-6 py-4">Akcja</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie tabel...
                                    </td>
                                </tr>
                            ) : tables.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                                        Brak tabel do wyświetlenia.
                                    </td>
                                </tr>
                            ) : (
                                tables.map((table) => (
                                    <tr key={table.table_name} className="border-t border-slate-100 hover:bg-slate-50/80">
                                        <td className="px-6 py-4 font-medium text-slate-900">{table.table_name}</td>
                                        <td className="px-6 py-4 text-slate-700">
                                            <div className="flex flex-wrap gap-2">
                                                {(TABLE_USAGE[table.table_name] || ['Widok techniczny / brak mapowania']).map((viewName) => (
                                                    <span
                                                        key={viewName}
                                                        className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                                                    >
                                                        {viewName}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">{table.row_count}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                type="button"
                                                onClick={() => handleClearTable(table.table_name)}
                                                disabled={loading || clearingTableName === table.table_name}
                                                className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {clearingTableName === table.table_name ? 'Czyszczenie...' : 'Czyść'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default TableCleanupPage;
