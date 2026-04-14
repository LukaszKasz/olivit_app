function MenuPlaceholderPage({ title }) {
    return (
        <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Sekcja robocza
                </span>
                <h1 className="mt-4 text-3xl font-semibold text-slate-900">
                    {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Pozycja menu została dodana i jest gotowa pod dalszą implementację widoku, tabeli albo formularza.
                </p>
            </div>
        </div>
    );
}

export default MenuPlaceholderPage;
