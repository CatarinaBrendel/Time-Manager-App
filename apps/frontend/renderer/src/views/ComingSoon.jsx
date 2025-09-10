export default function ComingSoon({ title = "Coming Soon" }) {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-platinum bg-white/70 p-8 text-center">
      <div>
        <div className="text-lg font-semibold">{title}</div>
        <p className="mt-2 text-sm text-gray-600">
          This section isn’t implemented yet. Check back later!
        </p>
      </div>
    </div>
  );
}
