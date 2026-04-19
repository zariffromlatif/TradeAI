export default function BidComparisonMatrix({ rows = [], onSelect }) {
  if (!rows.length) {
    return (
      <p className="text-xs text-neutral-500">
        No submitted bids yet for comparison.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-[#2a2a2a] rounded-xl">
      <table className="w-full text-sm">
        <thead className="table-head">
          <tr>
            <th className="px-3 py-2 text-left">Supplier</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Freight</th>
            <th className="px-3 py-2 text-right">Insurance</th>
            <th className="px-3 py-2 text-right">Duties</th>
            <th className="px-3 py-2 text-right">Lead (days)</th>
            <th className="px-3 py-2 text-right">Total Est.</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-3 py-2 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a2a2a]">
          {rows.map((row) => (
            <tr key={row.quoteId} className="hover:bg-[#171717]">
              <td className="px-3 py-2 text-neutral-100">{row.supplier}</td>
              <td className="px-3 py-2 text-right text-neutral-200">
                {row.price?.toLocaleString?.() ?? row.price}
              </td>
              <td className="px-3 py-2 text-right text-neutral-300">{row.freight}</td>
              <td className="px-3 py-2 text-right text-neutral-300">{row.insurance}</td>
              <td className="px-3 py-2 text-right text-neutral-300">{row.dutiesEstimate}</td>
              <td className="px-3 py-2 text-right text-neutral-300">{row.leadTimeDays}</td>
              <td className="px-3 py-2 text-right text-neutral-100">{row.totalEstimated}</td>
              <td className="px-3 py-2 text-right text-[#8ab4ff]">{row.compositeScore ?? "—"}</td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  className="btn-ui btn-secondary !h-8"
                  onClick={() => onSelect?.(row.quoteId)}
                >
                  Select
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
