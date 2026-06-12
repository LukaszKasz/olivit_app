# BRD do estymacji aplikacji Olivit QMS

## 1. Cel dokumentu

Ten dokument opisuje aktualny zakres aplikacji `Olivit zarządzanie jakością` na podstawie analizy kodu repozytorium. Celem jest przygotowanie materiału do wyceny dalszego rozwoju przez programistę lub software house.

Dokument rozdziela:

- funkcje już zaimplementowane i działające end-to-end,
- funkcje częściowo zaimplementowane,
- miejsca przygotowane w UI lub API, ale jeszcze niedomknięte biznesowo,
- ryzyka i luki, które mają wpływ na estymację.

## 2. Kontekst biznesowy

Aplikacja wspiera proces kontroli jakości produktów w dwóch głównych obszarach:

- `Bulk / Baza produktów`:
  katalog produktów głównych, zlecanie badań laboratoryjnych i dodawanie numerów serii.
- `Produkty spakowane / Warianty`:
  katalog wariantów produktów, obsługa partii, archiwizacja badań, generowanie CoA i kontrola produktu gotowego.

Dodatkowo aplikacja posiada moduły pomocnicze:

- zarządzanie integracjami z systemami zewnętrznymi,
- testy integracji Asana,
- diagnostykę systemu,
- import/eksport danych z bazy,
- techniczne endpointy do pobierania zamówień z zewnętrznych platform sprzedażowych.

## 3. Stack i architektura

## 3.1. Architektura techniczna

- Frontend: React 18 + React Router + Axios + Tailwind + i18next
- Backend: FastAPI + SQLAlchemy + JWT auth
- Baza danych: PostgreSQL 15
- Uruchomienie: Docker Compose
- Dokumentacja API: Swagger pod `/docs`

## 3.2. Serwisy w Docker Compose

- `frontend`: port `3300`
- `backend`: port `8001` mapowany na `8000` w kontenerze
- `db`: PostgreSQL na porcie `5432`

## 3.3. Charakter rozwiązania

To nie jest jeszcze domknięty system enterprise. W kodzie widać połączenie:

- gotowych modułów biznesowych,
- elementów POC,
- placeholderów pod przyszłe sekcje,
- funkcji administracyjno-serwisowych.

Ma to istotny wpływ na estymację, bo część zakresu trzeba liczyć jako rozwój produktu, a nie tylko utrzymanie.

## 4. Role i uprawnienia

## 4.1. Aktualny stan

W systemie istnieje tylko jeden poziom dostępu:

- użytkownik zalogowany.

Funkcje:

- rejestracja użytkownika,
- logowanie JWT,
- ochrona wszystkich tras aplikacyjnych po zalogowaniu.

Brakuje:

- ról biznesowych,
- uprawnień per moduł,
- audytu działań użytkownika,
- resetu hasła,
- zarządzania kontami użytkowników z panelu.

## 4.2. Wniosek do BRD

Do wyceny należy doprecyzować, czy docelowo system ma mieć:

- administratora,
- operatora jakości,
- laboratoryjnego użytkownika,
- użytkownika tylko do odczytu,
- osobę odpowiedzialną za integracje.

Obecnie tego nie ma.

## 5. Mapa modułów aplikacji

## 5.1. Moduły dostępne z menu

1. Logowanie
2. Rejestracja
3. Bulk / Baza produktów
4. Bulk / Baza produktów - Badania zlecone
5. Bulk / Baza produktów - Do spakowania
6. Bulk / Baza produktów - Do wyjaśnienia
7. Bulk / Baza produktów - Archiwum
8. Produkty spakowane / Warianty
9. Produkty spakowane / Warianty - Badania zlecone
10. Produkty spakowane / Warianty - Kontrola produktu gotowego - Bieżące
11. Produkty spakowane / Warianty - Kontrola produktu gotowego - Błędne
12. Produkty spakowane / Warianty - Kontrola produktu gotowego - Poprawne
13. Produkty spakowane / Warianty - Badania ukończone
14. Ustawienia
15. Asana
16. Diagnostyka

## 5.2. Moduły poza menu, ale obecne w kodzie

- endpointy do pobierania zamówień z:
  PrestaShop, Baselinker, WooCommerce, Shopify, Magento
- dashboard POC po zalogowaniu:
  komponent istnieje, ale nie jest używany w routingu
- osobny starszy komponent kontroli produktu gotowego:
  istnieje w kodzie, ale nie jest używany przez aktualny routing

## 6. Widoki i funkcjonalności

## 6.1. Logowanie

### Cel

Umożliwia wejście do systemu użytkownikowi z istniejącym kontem.

### Zakres

- formularz: `username`, `password`
- zapis tokenu JWT w `localStorage`
- przekierowanie po sukcesie do `Bulk / Baza produktów`
- automatyczne wylogowanie przy odpowiedzi `401` z backendu
- przełącznik języka PL/EN

### Walidacje

- oba pola wymagane
- błędne dane logowania zwracają komunikat z backendu

### Uwagi estymacyjne

- brak `remember me`
- brak resetu hasła
- brak MFA

## 6.2. Rejestracja

### Cel

Tworzenie nowego konta użytkownika.

### Zakres

- pola: `username`, `email`, `password`, `confirmPassword`
- walidacja zgodności haseł
- walidacja minimalnej długości hasła: 6 znaków
- po sukcesie przekierowanie do logowania

### Walidacje backend

- unikalny `username`
- unikalny `email`
- poprawny format email

### Uwagi estymacyjne

- brak polityki złożoności hasła
- brak aktywacji konta przez email
- brak moderacji kont

## 6.3. Bulk / Baza produktów

### Cel

Przegląd listy produktów głównych i uruchamianie akcji operacyjnych na produkcie.

### Zakres widoku

- lista produktów głównych
- wyszukiwanie po:
  numerze projektu i nazwie
- licznik rekordów
- menu kontekstowe per wiersz
- przycisk szczegółów
- przycisk dodania serii

### Dostępne akcje biznesowe

1. Zlecenie badań laboratoryjnych
2. Dodanie numeru serii bez przypisania laboratorium
3. Podgląd szczegółowych parametrów produktu

### Akcja: zlecenie badań

Formularz zawiera:

- laboratorium
- numer serii

Laboratoria są aktualnie zaszyte w frontendzie:

- `Laboratorium A`
- `Laboratorium B`
- `Laboratorium C`

Po zapisie tworzony jest rekord w tabeli `main_product_test_orders`.

### Akcja: dodanie serii

Pozwala zapisać numer serii bez wyboru laboratorium.

### Akcja: szczegóły produktu

Otwiera dane z tabeli `product_detailed_parameters`, grupowane po typie parametru.

### Uwagi estymacyjne

- brak paginacji
- brak sortowania tabeli
- brak filtrów zaawansowanych
- brak edycji/usuwania zleceń
- brak historii zmian

## 6.4. Bulk / Baza produktów - Badania zlecone

### Cel

Widok `Badania zlecone` w module `Bulk / Baza produktów` prezentuje listę produktów głównych, dla których został uruchomiony proces badań laboratoryjnych.

### Zakres

- dane widoczne w tym widoku pochodzą z aplikacji `Olivit QMS` i są tworzone w momencie użycia akcji `Zleć badania` z poziomu widoku głównego modułu `Bulk / Baza produktów`
- produkt źródłowy pochodzi z `Pimcore`, natomiast informacje związane ze zleceniem badania, statusem, numerem serii oraz datami są przechowywane w aplikacji
- kolumny:
  numer projektu, nazwa projektu / produktu, laboratorium, numer serii, data produkcji, data ważności, data realizacji badania, status
- widok tylko do odczytu
- rekord pojawia się w tym widoku po utworzeniu zlecenia badania

### Źródło danych

- tabela `main_product_test_orders`

### Braki

- brak filtrowania
- brak eksportu
- brak zmiany statusu
- brak powiązania z wynikiem badania

## 6.5. Bulk / Baza produktów - Do spakowania

### Stan

Widok używa tego samego komponentu listy co główny moduł `Bulk / Baza produktów`, ale z innym tytułem i opisem.

### Wniosek

Biznesowo sekcja istnieje w menu, ale nie ma osobnej logiki ani osobnego źródła danych.

To znaczy, że w aktualnym stanie:

- nie ma faktycznego workflow `do spakowania`,
- nie ma statusu produktu `do spakowania`,
- nie ma filtracji tylko do takich rekordów.

## 6.6. Bulk / Baza produktów - Do wyjaśnienia

### Stan

Placeholder.

### Obecna implementacja

- tylko ekran informacyjny
- brak danych
- brak akcji

## 6.7. Bulk / Baza produktów - Archiwum

### Stan

Placeholder.

### Obecna implementacja

- tylko ekran informacyjny
- brak danych
- brak akcji

## 6.8. Produkty spakowane / Warianty

### Cel

Przegląd wariantów produktów i tworzenie partii dla wariantów.

### Zakres widoku

- lista wariantów
- wyszukiwanie po:
  SKU, nazwie, EAN
- paginacja:
  50 rekordów na stronę
- zaznaczanie pojedyncze i zbiorcze
- dodawanie serii dla wybranego wiersza
- zbiorcze dodawanie serii dla zaznaczonych rekordów
- zlecanie badań laboratoryjnych z menu kontekstowego

### Akcje biznesowe

1. Dodanie serii do pojedynczego wariantu
2. Zlecenie badania do laboratorium dla pojedynczego wariantu
3. Dodanie serii dla wielu zaznaczonych wariantów

### Dane zapisywane

Tworzony jest rekord w `variant_product_batch_test_orders` z:

- `sku`
- `name`
- `ean`
- `batch_number`
- opcjonalnie `laboratory_name`
- `batch_added_at`
- `ordered_at` tylko jeśli wskazano laboratorium

### Uwagi estymacyjne

- akcja bulk działa jako wiele niezależnych requestów
- brak statusu postępu i częściowego raportu błędów na poziomie pojedynczych rekordów
- brak importu partii z pliku

## 6.9. Produkty spakowane / Warianty - Badania zlecone

### Cel

Centralny operacyjny widok partii wariantów.

### Zakres

- lista partii wariantów
- wyszukiwanie po:
  SKU, nazwie, EAN, numerze serii
- zaznaczanie rekordów
- akcje zbiorcze:
  generowanie CoA, dodanie dokumentów, przeniesienie do archiwum

### Kolumny danych

- numer projektu wyliczany ze SKU
- SKU
- nazwa
- EAN
- numer serii
- data dodania serii
- data zlecenia
- laboratorium
- pola kontroli produktu gotowego, jeśli zostały już uzupełnione na tym rekordzie

### Akcja: Generuj CoA

Warunki:

- zaznaczone rekordy muszą należeć do jednego numeru projektu

Przebieg:

1. System pobiera szczegółowe parametry produktu dla numeru projektu.
2. Użytkownik wybiera, które parametry mają wejść do dokumentu.
3. Backend generuje PDF CoA.
4. PDF jest pobierany do pliku.

### Akcja: Dodaj dokumenty

Aktualny stan:

- UI pozwala dodać do 6 plików
- jest podgląd PDF w iframe
- po kliknięciu `Zapisz` pojawia się komunikat sukcesu
- brak zapisu plików w backendzie i brak trwałego storage

To jest funkcja pozorna lub szkic funkcji.

### Akcja: Przenieś do archiwum

Przenosi rekordy z:

- `variant_product_batch_test_orders`

do:

- `variant_product_batch_test_orders_archive`

Przenoszone są także uzupełnione pola kontroli.

### Uwagi estymacyjne

- brak statusów workflow typu `nowe`, `w badaniu`, `po kontroli`, `archiwalne`
- brak cofania archiwizacji
- brak realnego obiegu dokumentów
- brak wersjonowania CoA

## 6.10. Produkty spakowane / Warianty - Badania ukończone

### Cel

Podgląd zarchiwizowanych partii.

### Zakres

- widok oparty o tę samą tabelę co `Badania zlecone`
- źródło danych:
  `variant_product_batch_test_orders_archive`
- tylko odczyt

### Uwagi estymacyjne

- brak filtrowania po dacie archiwizacji
- brak eksportu
- brak przywrócenia z archiwum

## 6.11. Produkty spakowane / Warianty - Kontrola produktu gotowego - Bieżące

### Cel

Rejestracja i przegląd kontroli produktu gotowego.

### Przebieg biznesowy

1. Użytkownik otwiera picker partii z widoku badań zleconych.
2. Wybiera konkretną partię wariantu.
3. System otwiera formularz kontroli i wstępnie uzupełnia część danych.
4. Użytkownik zapisuje kontrolę.
5. Dane są:
   zapisywane jako osobny rekord w tabeli kontroli oraz jednocześnie dopisywane do rekordu partii.

### Formularz kontroli produktu gotowego

Pola:

- rodzaj materiału zadrukowanego
- nazwa produktu
- numer projektowy produktu
- numer EAN produktu
- numer serii produktu
- data ważności produktu
- data kontroli
- numer wersji etykiety lub kartonika
- zgodność substancji aktywnych z PDS
- zgodność wersji etykiety z używaną wersją
- błędy drukarskie
- błędy graficzne
- poprawność nadruku
- błędy oklejenia
- poprawność nakrętki
- poprawność zgrzewu wkładki indukcyjnej
- poprawność otwierania wkładki indukcyjnej
- zabrudzenie opakowania
- uszkodzenie opakowania
- aktywność kodu QR
- zgodność zawartości z kartą produktu
- potwierdzenie weryfikacji produktu
- komentarz

### Słowniki odpowiedzi

- `Tak / Nie`
- `Tak / Nie / Nie dotyczy`
- rodzaj materiału:
  `Etykieta+opakowanie`, `Kartonik`

### Zapis do bazy

Po zapisie:

- rekord trafia do `variant_product_finished_product_controls`
- dane kontroli aktualizują też odpowiadający rekord w `variant_product_batch_test_orders`

### Uwagi estymacyjne

- brak edycji istniejącej kontroli
- brak usuwania
- brak podpisu osoby wykonującej kontrolę w danych biznesowych
- brak załączników do kontroli
- brak statusu akceptacji / odrzucenia

## 6.12. Produkty spakowane / Warianty - Kontrola produktu gotowego - Błędne

### Cel

Widok filtruje kontrole z wykrytymi niezgodnościami.

### Logika błędności

Rekord uznawany jest za błędny, jeżeli co najmniej jedno z pól kontrolnych ma niepożądaną wartość, np.:

- substancje aktywne niezgodne,
- błędy drukarskie = `Tak`,
- błędy graficzne = `Tak`,
- opakowanie uszkodzone = `Tak`,
- QR nieaktywny,
- produkt niezweryfikowany,
- itd.

### Stan

- widok tylko do odczytu
- nie można z niego dodać nowej kontroli

## 6.13. Produkty spakowane / Warianty - Kontrola produktu gotowego - Poprawne

### Cel

Widok filtruje kontrole bez wykrytych niezgodności.

### Stan

- widok tylko do odczytu
- logika odwrotna do sekcji błędnych

## 6.14. Ustawienia

### Cel

Administracja konfiguracją integracji i backupem danych.

### Zakres

Sekcje konfiguracyjne:

- PrestaShop
- WooCommerce
- Baselinker
- Shopify
- Magento
- Asana

Dostępne pola obejmują m.in.:

- `base_url`
- `api_key`
- `consumer_key`
- `consumer_secret`
- `access_token`
- `access_token_secret`
- `verify_ssl`

### Dodatkowe funkcje

1. Eksport tabel do JSON
2. Import tabel z JSON

### Eksport danych

Eksport zawiera pełną zawartość wszystkich obsługiwanych tabel.

### Import danych

Import:

- czyta plik JSON UTF-8,
- waliduje format,
- czyści wszystkie tabele z eksportu,
- wgrywa dane od nowa,
- resetuje sekwencje ID,
- nadpisuje dane w bazie.

### Uwagi krytyczne

Import jest operacją destrukcyjną z perspektywy biznesowej, bo nadpisuje dane.

Brakuje:

- potwierdzenia skutków operacji,
- wersjonowania backupów,
- loga importów,
- uprawnień ograniczających dostęp do tej funkcji,
- możliwości importu częściowego.

## 6.15. Asana

### Cel

Widok techniczno-testowy do sprawdzania integracji z Asaną.

### Funkcje

1. Test `users/me`
2. Pobranie taska po `task_gid`
3. Dodanie komentarza do taska

### Charakter modułu

To nie jest pełny moduł biznesowy.

To jest raczej panel diagnostyczny / integracyjny.

### Braki

- brak listy tasków
- brak mapowania obiektów biznesowych aplikacji do zadań Asany
- brak workflow typu zgłoś problem jakościowy do Asany

## 6.16. Diagnostyka

### Cel

Panel techniczny do sprawdzania stanu aplikacji.

### Zakres

- status backendu
- status bazy
- liczba produktów głównych
- liczba wariantów
- liczba użytkowników
- zamaskowany URL bazy
- nazwa zalogowanego użytkownika
- dane klienta:
  host, origin, user-agent
- ostatnie logi aplikacji z bufora in-memory

### Zastosowanie

Moduł pomocny dla supportu, wdrożenia i testów środowiskowych.

### Ograniczenia

- logi są tylko w pamięci procesu
- brak centralizacji logów
- brak filtrów po poziomie logowania

## 7. Procesy biznesowe

## 7.1. Proces: rejestracja i logowanie

1. Użytkownik zakłada konto.
2. Loguje się do systemu.
3. Otrzymuje token JWT.
4. Korzysta z chronionych widoków.

## 7.2. Proces: zlecenie badania dla produktu głównego

1. Użytkownik wyszukuje produkt główny.
2. Otwiera akcję kontekstową.
3. Wybiera laboratorium.
4. Uzupełnia numer serii.
5. Zapisuje zlecenie.
6. Rekord trafia do listy badań zleconych.

## 7.3. Proces: dodanie serii dla produktu głównego

1. Użytkownik wybiera produkt.
2. Dodaje numer serii bez laboratorium.
3. Rekord trafia do tabeli badań zleconych.

Uwaga:
model danych nie rozróżnia tego wyraźnym statusem od pełnego zlecenia badania.

## 7.4. Proces: dodanie partii dla wariantu

1. Użytkownik wyszukuje wariant.
2. Dodaje numer serii dla pojedynczego lub wielu wariantów.
3. System zapisuje rekordy partii.

## 7.5. Proces: zlecenie badania dla wariantu

1. Użytkownik wybiera wariant.
2. Wskazuje laboratorium i numer serii.
3. System zapisuje rekord partii z datą zlecenia.

## 7.6. Proces: kontrola produktu gotowego

1. Użytkownik otwiera widok bieżących kontroli.
2. Wybiera partię z listy badań zleconych.
3. Uzupełnia formularz kontroli.
4. System zapisuje kontrolę.
5. Rekord trafia do listy kontroli.
6. Dane kontroli są widoczne także w wierszu partii.

## 7.7. Proces: generowanie CoA

1. Użytkownik zaznacza partie.
2. Wszystkie partie muszą mieć ten sam numer projektu.
3. System pobiera parametry szczegółowe produktu głównego.
4. Użytkownik zaznacza parametry do wydruku.
5. System generuje PDF.
6. Użytkownik pobiera plik.

## 7.8. Proces: archiwizacja partii

1. Użytkownik zaznacza rekordy partii.
2. Uruchamia archiwizację.
3. Rekordy są kopiowane do tabeli archiwum.
4. Rekordy są usuwane z tabeli bieżącej.

## 7.9. Proces: backup i restore danych

1. Użytkownik eksportuje JSON wszystkich tabel.
2. Użytkownik może zaimportować plik JSON.
3. Import nadpisuje stan danych w systemie.

## 8. Model danych

## 8.1. Tabele główne

### `users`

- dane kont użytkowników
- pola:
  `username`, `email`, `hashed_password`, `created_at`

### `integration_settings`

- konfiguracja integracji zewnętrznych
- jedna pozycja na dostawcę

### `main_products`

- katalog produktów głównych
- pola:
  `project_number`, `name`, `id_szczegolow_produktu`, `order_index`

### `main_product_test_orders`

- zlecenia badań dla produktów głównych
- pola:
  `project_number`, `name`, `laboratory_name`, `batch_number`, `ordered_at`

### `variant_products`

- katalog wariantów
- pola:
  `sku`, `name`, `ean`, `order_index`

### `variant_product_batch_test_orders`

- bieżące partie wariantów i dane operacyjne badań / kontroli
- to centralna tabela workflow dla wariantów

### `variant_product_batch_test_orders_archive`

- archiwum zakończonych partii

### `variant_product_finished_product_controls`

- osobny rejestr wykonanych kontroli produktu gotowego

### `product_detailed_parameters`

- szczegółowe parametry produktu
- wykorzystywane do podglądu szczegółów i do CoA

## 8.2. Relacje biznesowe

- `main_products.project_number` służy do mapowania parametrów szczegółowych
- `main_products.id_szczegolow_produktu` łączy produkt z `product_detailed_parameters`
- numer projektu dla wariantu jest wyliczany ze wstępu SKU, nie z relacji FK
- kontrola produktu gotowego jest zapisana podwójnie:
  jako osobny rekord i jako aktualizacja rekordu partii

## 8.3. Uwagi estymacyjne do modelu danych

- brak jawnych kluczy obcych między wieloma bytami
- brak tabel słownikowych dla laboratoriów, statusów i typów odpowiedzi
- część dat jest przechowywana jako `string`, a nie typ daty
- brak tabeli dokumentów / załączników
- brak tabeli audytowej

## 9. API backendowe

## 9.1. Auth

- `POST /register`
- `POST /login`
- `GET /me`

## 9.2. Backup danych

- `GET /api/database/export`
- `POST /api/database/import`

## 9.3. Produkty główne

- `GET /api/main-products`
- `GET /api/main-products/{product_id}/details`
- `GET /api/main-products/ordered-tests`
- `POST /api/main-products/ordered-tests`

## 9.4. Warianty i partie

- `GET /api/variant-products`
- `GET /api/variant-products/projects/{project_number}/details`
- `GET /api/variant-products/batches/ordered-tests`
- `GET /api/variant-products/batches/archive`
- `POST /api/variant-products/batches/ordered-tests`
- `POST /api/variant-products/batches/archive`
- `POST /api/variant-products/batches/coa`

## 9.5. Kontrola produktu gotowego

- `GET /api/variant-products/finished-product-controls`
- `POST /api/variant-products/finished-product-controls`

## 9.6. Integracje i administracja

- `GET /api/integrations/settings`
- `PUT /api/integrations/settings`
- `GET /api/asana/me`
- `GET /api/asana/tasks/{task_gid}`
- `POST /api/asana/comment`
- `GET /api/system/diagnostics`

## 9.7. Zamówienia z platform sprzedażowych

- `GET /api/orders`
- `GET /api/orders/{order_id}/details`

Te endpointy nie mają obecnie dedykowanego UI w aplikacji.

## 10. Integracje zewnętrzne

## 10.1. PrestaShop

Zakres:

- pobieranie najnowszych zamówień
- pobieranie pozycji zamówienia

## 10.2. Baselinker

Zakres:

- pobieranie najnowszych zamówień
- pobieranie produktów z zamówienia

## 10.3. WooCommerce

Zakres:

- pobieranie zamówień
- pobieranie szczegółów zamówienia

## 10.4. Shopify

Zakres:

- pobieranie zamówień
- pobieranie szczegółów zamówienia

## 10.5. Magento

Zakres:

- pobieranie zamówień
- pobieranie szczegółów zamówienia
- obsługa Bearer token oraz OAuth1

## 10.6. Asana

Zakres:

- test połączenia `users/me`
- pobranie taska
- dodanie komentarza do taska

## 10.7. Uwagi estymacyjne do integracji

- brak harmonogramów synchronizacji
- brak kolejek
- brak retry policy na poziomie biznesowym
- brak ekranów mapowania i monitorowania synchronizacji
- brak trwałego logowania błędów integracji

## 11. Reguły biznesowe i walidacje

## 11.1. Produkty główne

- `project_number`, `name`, `batch_number` są wymagane przy zapisie zlecenia

## 11.2. Partie wariantów

- `sku`, `name`, `ean`, `batch_number` są wymagane
- `ordered_at` jest ustawiane tylko wtedy, gdy podano laboratorium

## 11.3. CoA

- zaznaczone partie muszą mieć jeden numer projektu
- muszą istnieć parametry szczegółowe produktu
- użytkownik musi wskazać przynajmniej jeden parametr

## 11.4. Kontrola produktu gotowego

- wszystkie pola wymagane poza komentarzem
- wskazana partia musi istnieć
- `sku` z formularza musi pasować do wskazanej partii

## 11.5. Import bazy

- plik musi być JSON UTF-8
- musi zawierać komplet znanych tabel
- nie może zawierać nieznanych tabel ani kolumn

## 12. Zakres już działający vs częściowo działający

## 12.1. Funkcje działające end-to-end

- rejestracja
- logowanie JWT
- ochrona tras
- lista produktów głównych
- lista wariantów
- zlecanie badań dla produktów głównych
- dodawanie serii dla produktów głównych
- dodawanie partii dla wariantów
- zlecanie badań dla wariantów
- lista badań zleconych dla produktów głównych
- lista badań zleconych dla wariantów
- archiwizacja partii wariantów
- lista archiwum partii
- zapis kontroli produktu gotowego
- lista kontroli produktu gotowego
- filtrowanie kontroli poprawnych i błędnych
- generowanie PDF CoA
- zapis i odczyt ustawień integracji
- eksport/import danych
- diagnostyka systemu
- testy Asana

## 12.2. Funkcje częściowo zaimplementowane

- `Bulk / Do spakowania`
  tylko osobny tytuł, bez osobnej logiki biznesowej
- dokumenty dla partii wariantów
  jest UI, brak backendu i trwałego zapisu
- integracje zamówień
  backend istnieje, brak UI i workflow biznesowego

## 12.3. Funkcje niezaimplementowane mimo obecności w menu

- `Bulk / Do wyjaśnienia`
- `Bulk / Archiwum`

## 13. Ograniczenia i dług techniczny wpływający na wycenę

1. Brak RBAC i ról biznesowych.
2. Brak pełnego modelu statusów workflow.
3. Brak trwałej obsługi dokumentów i załączników.
4. Brak audytu zmian.
5. Brak testów automatycznych biznesowych i frontendowych.
6. Część słowników jest zaszyta w kodzie frontendu.
7. Numer projektu dla wariantu jest wyliczany heurystycznie ze SKU.
8. Import danych nadpisuje wszystkie tabele.
9. Część pól dat i odpowiedzi jest przechowywana jako `string`.
10. Są komponenty nieużywane i ślady POC, co wskazuje na potrzebę refaktoru przed większym rozwojem.
11. W kodzie serwisów integracyjnych widać fallbacki i styl POC, a nie pełny mechanizm produkcyjny.

## 14. Zakres do doprecyzowania przed finalną wyceną

## 14.1. Pytania biznesowe

1. Jakie role użytkowników mają istnieć docelowo?
2. Czy laboratoria mają być zarządzane z panelu?
3. Jakie statusy mają mieć produkty, partie i kontrole?
4. Czy dokumenty mają być przechowywane w bazie, na dysku czy w chmurze?
5. Czy CoA ma mieć szablony, podpisy, numerację, wersjonowanie?
6. Czy kontrola produktu gotowego ma mieć akceptację drugiej osoby?
7. Czy placeholdery `Do wyjaśnienia` i `Archiwum` dla bulk mają wejść do zakresu?
8. Czy endpointy zamówień mają otrzymać UI i realny proces biznesowy?
9. Czy Asana ma być tylko testem integracji, czy częścią workflow jakościowego?
10. Czy import/eksport danych ma być dostępny dla zwykłych użytkowników?

## 14.2. Pytania techniczne

1. Czy projekt ma przejść refaktor modelu danych przed dalszym rozwojem?
2. Czy wymagane są testy automatyczne?
3. Czy potrzebne są migracje bazy w Alembic zamiast ręcznych modyfikacji schematu przy starcie?
4. Czy wdrożenie ma działać lokalnie, on-premise, czy w chmurze?
5. Czy logi i diagnostyka mają być centralizowane?

## 15. Rekomendowany podział estymacji dla programisty

Dla wyceny najlepiej rozbić prace na osobne strumienie:

1. Stabilizacja techniczna i refaktor
2. Domknięcie modelu ról i uprawnień
3. Rozwój modułu `Bulk`
4. Rozwój modułu `Warianty i partie`
5. Domknięcie modułu kontroli produktu gotowego
6. Pełna obsługa dokumentów i załączników
7. Rozwój i uszczelnienie integracji
8. Raporty, eksporty i dokumenty PDF
9. Testy automatyczne i przygotowanie produkcyjne

## 16. Wniosek końcowy

Aktualna aplikacja jest działającym szkieletem systemu jakościowego z kilkoma realnie użytecznymi modułami operacyjnymi. Najbardziej dojrzała część to:

- katalog produktów,
- obsługa partii wariantów,
- archiwizacja,
- kontrola produktu gotowego,
- generowanie CoA,
- konfiguracja integracji i diagnostyka.

Jednocześnie system nie jest jeszcze w pełni domknięty biznesowo. Największe obszary wpływające na wycenę to:

- brak ról i procesów zatwierdzania,
- niepełna obsługa dokumentów,
- placeholdery w części menu,
- integracje obecne bardziej jako warstwa techniczna niż pełny proces biznesowy,
- potrzeba uporządkowania modelu danych i poziomu produkcyjnej jakości kodu.

## 17. Rekomendacja praktyczna do wyceny

Jeżeli programista ma przygotować rzetelną wycenę, powinien policzyć osobno:

- koszt doprowadzenia obecnej wersji do stabilnego standardu produkcyjnego,
- koszt wdrożenia brakujących funkcji z obecnego menu,
- koszt nowych wymagań biznesowych, jeśli pojawią się po warsztacie BRD.

Bez takiego rozdzielenia wycena będzie ryzykowna, bo obecny kod łączy funkcje gotowe, częściowo gotowe i przygotowane tylko koncepcyjnie.
