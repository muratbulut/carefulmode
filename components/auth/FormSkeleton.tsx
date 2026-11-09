/** Form oturum kontrolünden sonra gelene kadar yerini tutan gri bloklar. */
export function FormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <span className="skeleton h-4 w-24 rounded-md" />
          <span className="skeleton h-[50px] rounded-xl" />
        </div>
      ))}
      <span className="skeleton h-[52px] rounded-xl" />
    </div>
  );
}
