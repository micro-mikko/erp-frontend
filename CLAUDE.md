# ERP Frontend — CLAUDE.md

## Vad är det här?
ERP-system för finska SMB-företag. Svensk UI (sv-SE), finska bokföringsstandarder.
React 19 + TypeScript + Vite 7 + TailwindCSS + Recharts.

## Snabbkommandon
```bash
npm run dev      # Dev-server på port 5200
npm run build    # TypeScript + Vite build (dist/)
npm run lint     # ESLint
```

> **OBS:** Port 5173 är blockerad av ett annat projekt (Payroll Rebel). Dev-server kör på **5200**.

## API-anslutning
- **Dev**: Vite proxy `/api` → `http://localhost:4000` (backend måste köra)
- **Produktion**: `VITE_API_URL` env-variabel → `https://backend-production-4269.up.railway.app`
- Se `src/api/client.ts` för implementation

## Projektstruktur
```
src/
├── App.tsx                     # Alla rutter + PrivateRoute/SuperuserRoute
├── api/
│   ├── client.ts               # API-wrapper (get/post/put/patch/delete/upload)
│   └── types.ts                # TypeScript-interfaces (Invoice, Expense, Customer, etc.)
├── context/
│   └── AuthContext.tsx         # useAuth hook, login/register, JWT i localStorage
├── components/
│   ├── Layout.tsx              # Huvudlayout med nav/sidebar
│   ├── CategoryPicker.tsx      # Väljer kategori + underkategori
│   ├── DimensionPicker.tsx     # Väljer bokföringsdimension
│   └── SupplierPicker.tsx      # Söker/väljer leverantör
└── pages/
    ├── Login.tsx / Register.tsx
    ├── Dashboard.tsx           # KPI:er, trender, aging, top-kunder
    ├── Chat.tsx                # AI-assistent (Claude Sonnet)
    ├── Inbox.tsx               # Dokumentinbox + AI-analys
    ├── Dimensions.tsx          # Dimensionsanalys (inbäddad i Dashboard)
    ├── Accounting.tsx          # Verifikat-lista + ny verifikat-modal
    ├── VAT.tsx                 # Momsrapportering
    ├── AnnualReport.tsx        # Årsredovisning
    ├── Subscriptions.tsx       # Prenumerationslista
    ├── Expenses.tsx            # Utgiftslista
    ├── Superuser.tsx           # Superuser-admin
    ├── invoices/
    │   ├── InvoicesShell.tsx   # Tab: Fakturor | Prenumerationer
    │   ├── InvoiceList.tsx     # Lista + KPI:er + charts
    │   ├── InvoiceForm.tsx     # Skapa/redigera faktura
    │   ├── InvoiceDetail.tsx   # Fakturavy
    │   └── SubscriptionForm.tsx / SubscriptionDetail.tsx
    ├── customers/
    │   ├── CustomerList.tsx / CustomerForm.tsx / CustomerDetail.tsx
    ├── suppliers/
    │   ├── SupplierList.tsx / SupplierForm.tsx / SupplierDetail.tsx
    ├── expenses/
    │   ├── ExpenseFormPage.tsx / ExpenseDetail.tsx
    └── settings/
        ├── SettingsLayout.tsx  # Tabbar: Företag | Användare | Dimensioner | Backup | Superuser
        ├── Settings.tsx        # Företagsinformation
        ├── Users.tsx           # Användarhantering
        ├── DimensionAdmin.tsx  # Administrera dimensioner
        └── Backup.tsx          # Export/import backup
```

## Alla sidor & rutter

| Rutt | Sida | Beskrivning |
|------|------|-------------|
| `/login` | Login | Inloggning |
| `/register` | Register | Registrera företag + användare |
| `/` | Dashboard | KPI, trender, aging, top-kunder, expense-breakdown |
| `/chat` | Chat | AI-assistent med naturligt språk |
| `/inbox` | Inbox | Dokumenthantering + AI-analys + godkänn→utgift |
| `/invoices` | InvoiceList | Faktualista + KPI:er + charts |
| `/invoices/new` | InvoiceForm | Skapa faktura |
| `/invoices/:id/edit` | InvoiceForm | Redigera faktura |
| `/invoices/:id` | InvoiceDetail | Fakturavy |
| `/invoices/subscriptions` | Subscriptions | Prenumerationslista + MRR/ARR |
| `/invoices/subscriptions/new` | SubscriptionForm | Skapa prenumeration |
| `/invoices/subscriptions/:id` | SubscriptionDetail | Prenumerationsvy |
| `/invoices/subscriptions/:id/edit` | SubscriptionForm | Redigera prenumeration |
| `/customers` | CustomerList | Kundlista |
| `/customers/new` | CustomerForm | Skapa kund |
| `/customers/:id` | CustomerDetail | Kundvy |
| `/customers/:id/edit` | CustomerForm | Redigera kund |
| `/suppliers` | SupplierList | Leverantörslista |
| `/suppliers/new` | SupplierForm | Skapa leverantör |
| `/suppliers/:id` | SupplierDetail | Leverantörsvy |
| `/suppliers/:id/edit` | SupplierForm | Redigera leverantör |
| `/expenses` | Expenses | Utgiftslista med filter/sökning |
| `/expenses/new` | ExpenseFormPage | Skapa utgift |
| `/expenses/:id` | ExpenseDetail | Utgiftsvy |
| `/expenses/:id/edit` | ExpenseFormPage | Redigera utgift |
| `/accounting` | Accounting | Verifikatlista + ny verifikat-modal |
| `/vat` | VAT | Momsrapportering + historik |
| `/annual-report` | AnnualReport | Årsredovisning PDF/JSON |
| `/settings/company` | Settings | Företagsinformation |
| `/settings/users` | Users | Användarhantering |
| `/settings/dimensions` | DimensionAdmin | Dimensionsadmin |
| `/settings/backup` | Backup | Backup export/import |
| `/settings/superuser` | Superuser | Superuser-panel (kräver isSuperuser) |

## Autentisering
- JWT lagras i `localStorage` som `token`
- `useAuth()` hook från `AuthContext` — ger `user`, `login`, `logout`, `register`
- `PrivateRoute`: redirectar till `/login` om ej inloggad
- `SuperuserRoute`: kräver `user.isSuperuser === true`
- Roller: `admin`, `accountant`, `user`
- Auto-logout vid 401-svar från API

## Design-system

### Färger
- **Surface**: `surface-0`, `surface-50`, `surface-100`, `surface-200`, `surface-300` (mörkt tema)
- **Brand**: `brand-300` till `brand-600`
- **Status**: `emerald` (success), `red` (danger), `amber` (warning), `orange`

### CSS-klasser
```css
.card           /* Kortkomponent: rounded-2xl, border border-white/8, bg-surface-100/50 */
.stat-card      /* KPI-kort */
.btn-primary    /* Primär knapp: bg-brand-600, hover:bg-brand-500 */
.btn-secondary  /* Sekundär knapp: border, text-white/60 */
.btn-ghost      /* Ghost-knapp: text-white/40 */
.input          /* Input-fält: bg-surface-200, border-white/10, focus:ring-brand-500 */
.label          /* Formuläretikett: text-xs font-medium text-white/40 uppercase */
.table-row-hover /* Tabell-rad hover: hover:bg-white/[0.02] */
```

### Status-badges
- **Faktura**: `badge-draft`, `badge-sent`, `badge-paid`
- **Dokument**: amber (väntar), blue (analyserar), purple (klar), emerald (matchad)
- **Utgift**: amber (PENDING), emerald (PAID)
- **Prenumeration**: green (ACTIVE), yellow (PAUSED), red (CANCELLED)

## Dataformat
- **Valuta**: EUR, sv-SE locale (`123 456,78 €`)
- **Datum**: sv locale, `d MMM yyyy` (t.ex. "15 jan 2026")
- **Momssatser**: 0%, 10%, 14%, 25.5%
- **Alla UI-strängar**: Svenska (sv-SE)

## Visualisering (Recharts)
- `AreaChart` — intäkts/kostnadstrender
- `BarChart` — aging-analys, top-kunder
- `PieChart` — utgifter per kategori, fakturastatus

## Viktiga mönster

### API-anrop
```typescript
import { api } from '../api/client';
const data = await api.get<Invoice[]>('/invoices');
const result = await api.post<Invoice>('/invoices', payload);
```

### Dokumentpolling
Dokumentstatus polling sker var 3:e sekund för PROCESSING-dokument (Inbox).

### Sortering
Klient-side sortering med asc/desc-toggle. Klick på kolumnhuvud växlar riktning.

### Sökning
Klient-side, case-insensitiv filtrering på relevanta fält.

## Deployment (Railway)
- **URL**: `https://frontend-production-ce4b.up.railway.app`
- **Build**: `npx vite build` (inte `npm run build` — undviker strikta TS-fel)
- **Start**: `npx serve -s dist -l $PORT`
- **Node**: ≥22 (`.node-version` fil + `engines.node: ">=22"`)
- **Env-var**: `VITE_API_URL=https://backend-production-4269.up.railway.app`

## Kända begränsningar
- Port 5173 är blockerad lokalt → används alltid 5200
- TypeScript-fel i strikta byggen — löst med `npx vite build` som skippar strikt typkontroll
