import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { prestashopAPI } from '../api';

function OrdersPage() {
    const { t } = useTranslation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const data = await prestashopAPI.getOrders(10);
                setOrders(data);
                setError(null);
            } catch (err) {
                setError(err.message || 'Failed to fetch orders');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">
                {t('sidebar.orders')}
            </h1>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : orders.length === 0 ? (
                    <p className="text-slate-500">{t('orders.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-3">{t('orders.colId')}</th>
                                    <th className="px-6 py-3">{t('orders.colReference')}</th>
                                    <th className="px-6 py-3">{t('orders.colCustomerId')}</th>
                                    <th className="px-6 py-3">{t('orders.colTotalPaid')}</th>
                                    <th className="px-6 py-3">{t('orders.colPayment')}</th>
                                    <th className="px-6 py-3">{t('orders.colDate')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium">{order.id}</td>
                                        <td className="px-6 py-4">{order.reference}</td>
                                        <td className="px-6 py-4">{order.id_customer}</td>
                                        <td className="px-6 py-4">{order.total_paid}</td>
                                        <td className="px-6 py-4">{order.payment}</td>
                                        <td className="px-6 py-4">{new Date(order.date_add).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default OrdersPage;
