import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "bg-foreground text-background border border-border rounded-none px-4 py-2 text-[13px] font-medium shadow-lg",
          description: "text-background/80 text-xs",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
