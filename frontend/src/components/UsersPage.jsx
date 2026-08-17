import { useEffect, useState } from 'react';
import { authAPI, usersAPI } from '../api';

const emptyForm = { username: '', email: '', password: '', is_admin: false };

function UsersPage() {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [dialog, setDialog] = useState({ open: false, userId: null, form: emptyForm });

    const loadUsers = async () => {
        setLoading(true);
        try {
            const [me, data] = await Promise.all([authAPI.getCurrentUser(), usersAPI.getUsers()]);
            setCurrentUser(me);
            setUsers(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            setError(err?.response?.data?.detail || 'Nie udało się pobrać użytkowników.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const openCreate = () => setDialog({ open: true, userId: null, form: { ...emptyForm } });
    const openEdit = (user) => setDialog({
        open: true,
        userId: user.id,
        form: { username: user.username, email: user.email, password: '', is_admin: user.is_admin },
    });
    const updateField = (field, value) => setDialog((current) => ({
        ...current,
        form: { ...current.form, [field]: value },
    }));

    const saveUser = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = { ...dialog.form };
            if (dialog.userId && !payload.password) delete payload.password;
            if (dialog.userId) await usersAPI.updateUser(dialog.userId, payload);
            else await usersAPI.createUser(payload);
            setDialog({ open: false, userId: null, form: { ...emptyForm } });
            setSuccess(dialog.userId ? 'Zaktualizowano użytkownika.' : 'Dodano użytkownika.');
            await loadUsers();
        } catch (err) {
            setError(err?.response?.data?.detail || 'Nie udało się zapisać użytkownika.');
        } finally {
            setSaving(false);
        }
    };

    const deleteUser = async (user) => {
        if (!window.confirm(`Czy na pewno usunąć użytkownika ${user.username}?`)) return;
        try {
            await usersAPI.deleteUser(user.id);
            setSuccess(`Usunięto użytkownika ${user.username}.`);
            await loadUsers();
        } catch (err) {
            setError(err?.response?.data?.detail || 'Nie udało się usunąć użytkownika.');
        }
    };

    return (
        <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Użytkownicy</h1>
                    <p className="mt-2 text-sm text-slate-600">Zarządzanie kontami i uprawnieniami administratorów.</p>
                </div>
                <button type="button" onClick={openCreate} disabled={loading || !currentUser?.is_admin} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">
                    Dodaj użytkownika
                </button>
            </div>
            {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500"><tr><th className="px-6 py-4">Użytkownik</th><th className="px-6 py-4">E-mail</th><th className="px-6 py-4">Rola</th><th className="px-6 py-4">Utworzono</th><th className="px-6 py-4">Akcje</th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-500">Ładowanie użytkowników...</td></tr> : users.map((user) => (
                            <tr key={user.id} className="border-t border-slate-100">
                                <td className="px-6 py-4 font-semibold text-slate-900">{user.username}{user.id === currentUser?.id ? ' (Ty)' : ''}</td>
                                <td className="px-6 py-4 text-slate-700">{user.email}</td>
                                <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.is_admin ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>{user.is_admin ? 'Administrator' : 'Użytkownik'}</span></td>
                                <td className="px-6 py-4 text-slate-700">{user.created_at ? new Date(user.created_at).toLocaleString('pl-PL') : '—'}</td>
                                <td className="px-6 py-4"><div className="flex gap-2"><button type="button" onClick={() => openEdit(user)} className="rounded-xl border border-slate-300 px-3 py-2">Edytuj</button><button type="button" onClick={() => deleteUser(user)} disabled={user.id === currentUser?.id} className="rounded-xl border border-rose-300 px-3 py-2 text-rose-700 disabled:opacity-40">Usuń</button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {dialog.open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={saveUser} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
                <h2 className="text-2xl font-semibold text-slate-900">{dialog.userId ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}</h2>
                <div className="mt-6 grid gap-4">
                    <label className="text-sm font-medium text-slate-700">Nazwa użytkownika<input required minLength="3" value={dialog.form.username} disabled={dialog.userId === currentUser?.id} onChange={(e) => updateField('username', e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100 disabled:text-slate-500" /></label>
                    <label className="text-sm font-medium text-slate-700">E-mail<input required type="email" value={dialog.form.email} onChange={(e) => updateField('email', e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
                    <label className="text-sm font-medium text-slate-700">Hasło {dialog.userId ? '(pozostaw puste bez zmiany)' : ''}<input required={!dialog.userId} minLength="6" type="password" value={dialog.form.password} onChange={(e) => updateField('password', e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
                    <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={dialog.form.is_admin} disabled={dialog.userId === currentUser?.id} onChange={(e) => updateField('is_admin', e.target.checked)} /> Administrator</label>
                </div>
                <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDialog({ open: false, userId: null, form: { ...emptyForm } })} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3">Anuluj</button><button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50">{saving ? 'Zapisywanie...' : 'Zapisz'}</button></div>
            </form></div>}
        </div>
    );
}

export default UsersPage;
