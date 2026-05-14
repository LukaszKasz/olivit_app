import { useState } from 'react';
import { asanaAPI } from '../api';

const DEFAULT_TASK_GID = '1214774073398027';
const DEFAULT_FETCH_TASK_GID = '1211645480947098';
const DEFAULT_COMMENT = 'Testowy komentarz dodany z panelu Olivit App.';

function stringifyResult(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
}

function AsanaPage() {
    const [taskGid, setTaskGid] = useState(DEFAULT_TASK_GID);
    const [fetchTaskGid, setFetchTaskGid] = useState(DEFAULT_FETCH_TASK_GID);
    const [commentText, setCommentText] = useState(DEFAULT_COMMENT);
    const [loadingMe, setLoadingMe] = useState(false);
    const [loadingTask, setLoadingTask] = useState(false);
    const [creatingComment, setCreatingComment] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [result, setResult] = useState('');

    const handleLoadMe = async () => {
        setLoadingMe(true);
        setError('');
        setSuccess('');

        try {
            const data = await asanaAPI.getCurrentUser();
            setResult(stringifyResult(data));
            setSuccess('Połączenie z Asaną działa. Pobrano dane użytkownika.');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać danych użytkownika Asany.');
            setResult('');
        } finally {
            setLoadingMe(false);
        }
    };

    const handleCreateComment = async () => {
        setCreatingComment(true);
        setError('');
        setSuccess('');

        try {
            const data = await asanaAPI.createComment({
                task_gid: taskGid,
                text: commentText,
            });
            setResult(stringifyResult(data));
            setSuccess('Komentarz został dodany do zadania Asany.');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się dodać komentarza w Asanie.');
            setResult('');
        } finally {
            setCreatingComment(false);
        }
    };

    const handleLoadTask = async () => {
        setLoadingTask(true);
        setError('');
        setSuccess('');

        try {
            const data = await asanaAPI.getTask(fetchTaskGid);
            setResult(stringifyResult(data));
            setSuccess(`Pobrano task Asany ${fetchTaskGid}.`);
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Nie udało się pobrać taska Asany.');
            setResult('');
        } finally {
            setLoadingTask(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Integracja testowa
                </span>
                <h1 className="mt-4 text-3xl font-semibold text-slate-900">Asana</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    Ten widok korzysta z tokenu zapisanego w ustawieniach integracji. Możesz sprawdzić `users/me`
                    albo dodać testowy komentarz do wskazanego zadania.
                </p>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {typeof error === 'string' ? error : stringifyResult(error)}
                </div>
            )}

            {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                </div>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Test połączenia</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Odpowiada żądaniu `GET /users/me` z nagłówkiem `Authorization: Bearer ...`.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleLoadMe}
                        disabled={loadingMe || creatingComment}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loadingMe ? 'Pobieranie...' : 'Pobierz users/me'}
                    </button>
                </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Pobierz task</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Endpoint backendu wywoła <code>GET /tasks/{'{'}task_gid{'}'}</code> w Asanie.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Numer taska</label>
                        <input
                            className="input-field"
                            value={fetchTaskGid}
                            onChange={(event) => setFetchTaskGid(event.target.value)}
                            placeholder="1211645480947098"
                        />
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleLoadTask}
                            disabled={loadingMe || loadingTask || creatingComment}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loadingTask ? 'Pobieranie taska...' : 'Pobierz task'}
                        </button>
                    </div>
                </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Dodaj komentarz</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Endpoint backendu wywoła <code>POST /tasks/{'{'}task_gid{'}'}/stories</code> w Asanie.
                </p>

                <div className="mt-5 grid gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Task GID</label>
                        <input
                            className="input-field"
                            value={taskGid}
                            onChange={(event) => setTaskGid(event.target.value)}
                            placeholder="1214774073398027"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Treść komentarza</label>
                        <textarea
                            className="input-field min-h-32"
                            value={commentText}
                            onChange={(event) => setCommentText(event.target.value)}
                            placeholder="Wpisz treść komentarza"
                        />
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleCreateComment}
                            disabled={loadingMe || loadingTask || creatingComment}
                            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creatingComment ? 'Dodawanie komentarza...' : 'Dodaj komentarz w Asanie'}
                        </button>
                    </div>
                </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-white">Wynik</h2>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">JSON response</span>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-emerald-200">
                    {result || 'Brak wyniku. Użyj jednego z przycisków powyżej.'}
                </pre>
            </section>
        </div>
    );
}

export default AsanaPage;
