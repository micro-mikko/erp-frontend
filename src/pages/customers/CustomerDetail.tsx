import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Mail, Phone, MapPin, FileText, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import type { Customer, Invoice } from '../../api/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Customer>(`/customers/${id}`),
      api.get<Invoice[]>('/invoices'),
    ]).then(([c, invs]) => {
      setCustomer(c);
      setInvoices(invs.filter(i => i.customerId === id));
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );
  if (!customer) return <div className="p-6 text-white/50">Kunden hittades inte</div>;

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/customers" className="btn-ghost"><ArrowLeft size={14} /> Tillbaka</Link>
          <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300 font-semibold">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-xl font-semibold text-white">{customer.name}</h1>
        </div>
        <Link to={`/customers/${id}/edit`} className="btn-secondary">
          <Edit size={14} /> Redigera
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card space-y-3">
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide">Kontaktuppgifter</h2>
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Mail size={13} className="text-brand-400" />{customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Phone size={13} className="text-brand-400" />{customer.phone}
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <MapPin size={13} className="text-brand-400" />{customer.address}
            </div>
          )}
          {customer.vatNumber && (
            <div className="text-sm text-white/50">
              <span className="text-white/30 text-xs">VAT: </span>{customer.vatNumber}
            </div>
          )}
        </div>

        <div className="card">
          <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Statistik</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Totalt fakturerat</span>
              <span className="text-brand-300 font-semibold">{fmt(totalRevenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Antal fakturor</span>
              <span className="text-white">{invoices.length}</span>
            </div>
          </div>
        </div>

        <div className="card flex items-center justify-center">
          <Link to={`/invoices/new?customerId=${id}`} className="btn-primary">
            <FileText size={14} /> Ny faktura
          </Link>
        </div>
      </div>

      {/* Invoices */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <FileText size={15} className="text-brand-400" />Fakturor ({invoices.length})
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-6">Inga fakturor för denna kund</p>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <Link key={inv.id} to={`/invoices/${inv.id}`}
                className="flex items-center justify-between p-3 bg-surface-200 hover:bg-surface-300 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-brand-400">{inv.invoiceNumber}</span>
                  <span className="text-xs text-white/40">
                    {format(new Date(inv.issueDate), 'd MMM yyyy', { locale: sv })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{fmt(inv.total)}</span>
                  <span className={`badge-${inv.status}`}>
                    {{ draft: 'Utkast', sent: 'Skickad', paid: 'Betald' }[inv.status] || inv.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
