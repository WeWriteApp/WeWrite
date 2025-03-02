import { useStripe } from "../providers/StripeProvider";

export default function BillingOverview() {
  const { invoices, upcomingInvoice, paymentMethods, loading } = useStripe();

  if (loading) return <p className="text-center text-gray-500">Loading...</p>;

  // Calculate the correctly adjusted amount due for upcoming invoice
  const adjustedUpcomingAmount = upcomingInvoice ? (
    upcomingInvoice.subtotal_excluding_tax +
    upcomingInvoice.lines.data.reduce((acc, line) => acc + line.amount, 0) -
    upcomingInvoice.subtotal_excluding_tax
  ) : 0;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Billing Overview</h2>

      {/* 🔹 Show Next Payment */}
      {upcomingInvoice ? (
        <p className="text-lg text-gray-700 mb-4">
          Next payment of <strong>${(adjustedUpcomingAmount / 100).toFixed(2)}</strong> due on {" "}
          {new Date(upcomingInvoice.next_payment_attempt * 1000).toLocaleDateString()}
        </p>
      ) : (
        <p className="text-gray-500">No upcoming payments.</p>
      )}

      {/* 🔹 List Past Invoices */}
      <h3 className="text-xl font-medium mt-6 mb-2">Payment History</h3>
      {invoices.length > 0 ? (
        <ul className="space-y-2">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="p-3 bg-gray-100 rounded-md">
              Paid ${(invoice.amount_due / 100).toFixed(2)} on {" "}
              {new Date(invoice.created * 1000).toLocaleDateString()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No previous invoices.</p>
      )}

      {/* 🔹 Show Saved Payment Methods */}
      <h3 className="text-xl font-medium mt-6 mb-2">Saved Payment Methods</h3>
      {paymentMethods.length > 0 ? (
        <ul className="space-y-2">
          {paymentMethods.map((pm) => (
            <li key={pm.id} className="p-3 bg-gray-100 rounded-md">
              {pm.card.brand} ending in {pm.card.last4}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No saved payment methods.</p>
      )}
    </div>
  );
}
