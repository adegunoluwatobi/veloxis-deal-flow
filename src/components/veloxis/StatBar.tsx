const STATS = [
  { value: "80%", label: "Advanced on day one" },
  { value: "24hrs", label: "From approval to funds" },
  { value: "30–90", label: "Day payment terms" },
  { value: "UK & EU", label: "Buyer destination markets" },
];

export function StatBar() {
  return (
    <section className="bg-[#f9fafb]" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto grid max-w-[780px] grid-cols-2 md:grid-cols-4 gap-6 px-8 py-6 text-center">
        {STATS.map((s) => (
          <div key={s.label}>
            <div className="text-[28px] font-medium text-[#0d9488]">{s.value}</div>
            <div className="mt-[3px] text-[12px] text-[#6b7280]">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
