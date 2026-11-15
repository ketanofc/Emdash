export function CornerBrackets() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[0.5px] -left-px h-3 w-3 border-t md:border-t-2 border-l md:border-l-2 border-neutral z-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[0.5px] -right-px h-3 w-3 border-t md:border-t-2 border-r md:border-r-2 border-neutral z-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[0.5px] -left-px h-3 w-3 border-b md:border-b-2 border-l md:border-l-2 border-neutral z-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[0.5px] -right-px h-3 w-3 border-b md:border-b-2 border-r md:border-r-2 border-neutral z-10"
      />
    </>
  );
}
