import { useToast, type ToastVariant } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

/**
 * Маппинг ToastVariant → variant компонента Toast (Radix).
 */
const variantMap: Record<ToastVariant, string> = {
  success: 'success',
  error: 'error',
  info: 'info',
  warning: 'warning',
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, duration }) => (
        <Toast key={id} variant={variantMap[variant] as any} duration={duration}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
