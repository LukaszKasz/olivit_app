import { useEffect, useState } from 'react';
import { mainProductsAPI } from '../api';

function MainProductOrderedTestsPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadOrders = async () => {
            try {
                setLoading(true);
                const data = await mainProductsAPI.getOrderedTests();
                setOrders(Array.isArray(data) ? data : []);
                setError('');
            } catch (err) {
                setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać zleconych badań.');
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, []);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Produkty główne / Badania zlecone</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Dane pobierane z tabeli zleconych badań w bazie PostgreSQL.
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    Pozycji: <span className="font-semibold text-slate-900">{orders.length}</span>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Numer projektu</th>
                                <th className="px-6 py-4">Nazwa</th>
                                <th className="px-6 py-4">Numer serii</th>
                                <th className="px-6 py-4">Data zlecenia</th>
                                <th className="px-6 py-4">Laboratorium</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                                        Ładowanie zleconych badań...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr className="border-t border-slate-100">
                                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                                        Brak zleconych badań.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                                            {order.project_number}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                            {order.name}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                            {order.batch_number || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                                            {new Date(order.ordered_at).toLocaleString('pl-PL')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                            {order.laboratory_name}
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

export default MainProductOrderedTestsPage;
