import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

type ConfirmVariant = "warning" | "info" | "success";

interface ConfirmOptions {
  title: string;
  description: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "", description: "" });
  const [resolveRef, setResolveRef] = useState<{ resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolveRef({ resolve });
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolveRef?.resolve(true);
    setResolveRef(null);
  };

  const handleCancel = () => {
    setOpen(false);
    resolveRef?.resolve(false);
    setResolveRef(null);
  };

  const variant = options.variant ?? "warning";
  const Icon = variant === "warning" ? AlertTriangle : variant === "success" ? CheckCircle2 : Info;
  const iconColor = variant === "warning" ? "text-warning" : variant === "success" ? "text-success" : "text-primary";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-muted ${iconColor}`}>
                <Icon className="h-5 w-5" />
              </div>
              <AlertDialogTitle>{options.title}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="mt-2">
              {options.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {options.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {options.confirmLabel ?? "Yes, Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
