import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ordersAPI } from '../api';

function OrdersPage() {
    const { t } = useTranslation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, orderId: null });

    const isNumericLike = (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value !== 'string') return false;
        const normalized = value.trim().replace(',', '.');
        return normalized !== '' && !Number.isNaN(Number(normalized));
    };

    const formatAmount = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return value;
        return numeric.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleContextMenu = (e, orderId) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            orderId: orderId
        });
    };

    const handlePrintShippingLabel = (orderId) => {
        console.log(`Printing shipping label for order: ${orderId}`);
        alert(`Rozpoczęto drukowanie etykiety transportowej dla zamówienia: ${orderId}`);
    };

    useEffect(() => {
        const handleClick = () => {
            if (contextMenu.visible) {
                setContextMenu({ ...contextMenu, visible: false });
            }
        };
        document.addEventListener('click', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
        };
    }, [contextMenu.visible]);

    const handleRowClick = async (orderId) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            return;
        }

        setExpandedOrderId(orderId);

        if (!orderDetails[orderId]) {
            setDetailsLoading(true);
            try {
                const details = await ordersAPI.getOrderDetails(orderId);
                setOrderDetails(prev => ({
                    ...prev,
                    [orderId]: details
                }));
            } catch (err) {
                console.error("Failed to fetch details:", err);
            } finally {
                setDetailsLoading(false);
            }
        }
    };

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const data = await ordersAPI.getOrders(10);
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
                                    <th className="px-6 py-3">{t('orders.colSource')}</th>
                                    <th className="px-6 py-3">{t('orders.colReference')}</th>
                                    <th className="px-6 py-3">{t('orders.colCustomerId')}</th>
                                    <th className="px-6 py-3 text-right">{t('orders.colTotalPaid')}</th>
                                    <th className="px-6 py-3">{t('orders.colPayment')}</th>
                                    <th className="px-6 py-3">{t('orders.colDate')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <React.Fragment key={order.id}>
                                        <tr
                                            className="bg-white border-b hover:bg-slate-50 cursor-pointer"
                                            onClick={() => handleRowClick(order.id)}
                                            onContextMenu={(e) => handleContextMenu(e, order.id)}
                                        >
                                            <td className="px-6 py-4 font-medium" style={{ whiteSpace: 'nowrap' }}>{order.id}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${order.source === 'Baselinker' ? 'bg-indigo-100 text-indigo-800' :
                                                        order.source === 'WooCommerce' ? 'bg-purple-100 text-purple-800' :
                                                            order.source === 'Shopify' ? 'bg-emerald-100 text-emerald-800' :
                                                                order.source === 'Magento' ? 'bg-orange-100 text-orange-800' :
                                                            'bg-pink-100 text-pink-800'
                                                    }`}>
                                                    {order.source}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{order.reference}</td>
                                            <td className={`px-6 py-4 ${isNumericLike(order.id_customer) ? 'text-right tabular-nums' : ''}`}>{order.id_customer}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums">
                                                {formatAmount(order.total_paid)}
                                            </td>
                                            <td className="px-6 py-4">{order.payment}</td>
                                            <td className="px-6 py-4">{order.date_add}</td>
                                        </tr>
                                        {expandedOrderId === order.id && (
                                            <tr className="bg-slate-50 border-b">
                                                <td colSpan="7" className="px-6 py-4 pb-6">
                                                    {detailsLoading && !orderDetails[order.id] ? (
                                                        <div className="flex items-center text-sm text-slate-500">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                                                            {t('orders.detailsLoading')}
                                                        </div>
                                                    ) : orderDetails[order.id] && orderDetails[order.id].length > 0 ? (
                                                        <div className="pl-6 border-l-2 border-primary-500 my-2">
                                                            <table className="w-full text-sm text-left bg-white rounded-lg shadow-sm border border-slate-200">
                                                                <thead className="text-xs text-slate-600 bg-slate-100 border-b">
                                                                    <tr>
                                                                        <th className="px-4 py-2">ID</th>
                                                                        <th className="px-4 py-2">{t('orders.detailsProductName')}</th>
                                                                        <th className="px-4 py-2 text-right">{t('orders.detailsQuantity')}</th>
                                                                        <th className="px-4 py-2 text-right">{t('orders.detailsPrice')} (Netto)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {orderDetails[order.id].map((item) => (
                                                                        <tr key={item.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                                                            <td className="px-4 py-2">{item.product_id}</td>
                                                                            <td className="px-4 py-2 font-medium">{item.product_name}</td>
                                                                            <td className="px-4 py-2 text-right tabular-nums">{item.product_quantity}</td>
                                                                            <td className="px-4 py-2 tracking-wide font-mono whitespace-nowrap text-right tabular-nums">
                                                                                {formatAmount(item.product_price)}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-slate-500 italic pl-6">
                                                            Brak szczegółów zamówienia.
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {contextMenu.visible && (
                <div
                    className="absolute z-50 bg-white border border-slate-200 shadow-lg rounded-md py-1 min-w-[200px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-primary-600 transition-colors flex items-center"
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePrintShippingLabel(contextMenu.orderId);
                            setContextMenu({ ...contextMenu, visible: false });
                        }}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        {t('orders.printShippingLabel')}
                    </button>
                    {/* Tutaj w przyszłości można dołożyć więcej opcji klikając prawym przyciskiem myszy */}
                </div>
            )}
        </div>
    );
}

export default OrdersPage;
