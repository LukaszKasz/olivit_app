import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const GOODS_STORAGE_KEY = 'nexo_goods_payload';

function GoodsPage() {
    const { t } = useTranslation();
    const location = useLocation();
    const [payload, setPayload] = useState(location.state?.payload || null);

    useEffect(() => {
        if (location.state?.payload) {
            return;
        }

        const stored = sessionStorage.getItem(GOODS_STORAGE_KEY);
        if (!stored) return;

        try {
            setPayload(JSON.parse(stored));
        } catch {
            setPayload(null);
        }
    }, [location.state]);

    const goods = Array.isArray(payload?.goods) ? payload.goods : [];
    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">
                {t('goods.title')}
            </h1>

            <div className="card">
                {goods.length === 0 ? (
                    <p className="text-slate-500">{t('goods.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-3">{t('goods.colId')}</th>
                                    <th className="px-6 py-3">{t('goods.colSymbol')}</th>
                                    <th className="px-6 py-3">{t('goods.colName')}</th>
                                    <th className="px-6 py-3">{t('goods.colBarcode')}</th>
                                    <th className="px-6 py-3 text-right">{t('goods.colNetPrice')}</th>
                                    <th className="px-6 py-3 text-right">{t('goods.colAvailable')}</th>
                                    <th className="px-6 py-3 text-right">{t('goods.colReserved')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {goods.map((item, index) => (
                                    <tr key={`${item.id || item.symbol || 'row'}-${index}`} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium" style={{ whiteSpace: 'nowrap' }}>{item.id || '-'}</td>
                                        <td className="px-6 py-4">{item.symbol || '-'}</td>
                                        <td className="px-6 py-4">{item.nazwa || '-'}</td>
                                        <td className="px-6 py-4">{item.kodKreskowy || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums">
                                            {item.cenaNetto == null ? '-' : Number(item.cenaNetto).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums">
                                            {item.stanDostepny == null ? '-' : Number(item.stanDostepny).toLocaleString('pl-PL')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums">
                                            {item.stanZarezerwowany == null ? '-' : Number(item.stanZarezerwowany).toLocaleString('pl-PL')}
                                        </td>
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

export { GOODS_STORAGE_KEY };
export default GoodsPage;
