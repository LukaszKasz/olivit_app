import { useState } from 'react';
import { brdAPI } from '../api';

function BrdPage() {
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleDownload = async () => {
        setDownloading(true);
        setError('');
        setSuccess('');

        try {
            const response = await brdAPI.download();
            const blob = new Blob([response.data], {
                type: response.headers['content-type']
                    || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const disposition = response.headers['content-disposition'] || '';
            const match = disposition.match(/filename="?([^"]+)"?/i);
            const filename = match?.[1] || 'BRD-olivit-app.docx';
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            setSuccess('Dokument BRD został pobrany.');
        } catch (err) {
            setError(err?.response?.data?.detail || 'Nie udało się pobrać dokumentu BRD.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="card">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-slate-800">BRD</h1>
                        <p className="text-slate-600">
                            Pobierz aktualny dokument BRD aplikacji Olivit w formacie DOCX.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {downloading ? 'Pobieranie...' : 'Pobierz BRD'}
                    </button>
                </div>

                {error && (
                    <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
                        {success}
                    </div>
                )}
            </div>
        </div>
    );
}

export default BrdPage;
