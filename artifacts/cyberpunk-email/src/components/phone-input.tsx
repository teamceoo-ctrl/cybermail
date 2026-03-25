import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (val: string) => void;
  gateway?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  showGateway?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  gateway,
  placeholder = "Phone number (digits only)",
  className,
  disabled,
  size = "md",
  showGateway = true,
}: PhoneInputProps) {
  const { state, result } = usePhoneValidation(value, gateway);

  const borderClass =
    state === "valid"
      ? "border-primary/60 focus:border-primary"
      : state === "invalid"
      ? "border-red-500/60 focus:border-red-500"
      : "";

  const h = size === "sm" ? "h-8" : "h-9";

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "font-mono text-xs bg-background/50 border-border/60 pr-8 transition-colors",
            borderClass,
            h,
            className
          )}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {state === "checking" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
          )}
          {state === "valid" && (
            <CheckCircle className="h-3.5 w-3.5 text-primary" />
          )}
          {state === "invalid" && (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
      </div>

      {state === "valid" && result && (
        <div className="font-mono text-[10px] text-primary/70 px-0.5 space-y-0.5">
          <span>✓ {result.e164}</span>
          {showGateway && result.gatewayEmail && (
            <span className="ml-3 text-muted-foreground/60">→ {result.gatewayEmail}</span>
          )}
        </div>
      )}

      {state === "invalid" && result?.reason && (
        <div className="font-mono text-[10px] text-red-400 px-0.5">
          ✗ {result.reason}
        </div>
      )}
    </div>
  );
}
