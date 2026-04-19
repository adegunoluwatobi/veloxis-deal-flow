import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import WebsiteLayout from "@/components/veloxis/WebsiteLayout";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "validating" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>({ kind: "validating" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Missing unsubscribe token." });
      return;
    }

    const validate = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (!res.ok) {
          setState({
            kind: "invalid",
            message: data?.error || "This unsubscribe link is invalid or has expired.",
          });
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        if (data.valid === true) {
          setState({ kind: "valid" });
          return;
        }
        setState({ kind: "invalid", message: "Unable to validate this link." });
      } catch (err) {
        setState({
          kind: "invalid",
          message: "Network error — please try again.",
        });
      }
    };

    validate();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          message: data?.error || "Failed to process unsubscribe.",
        });
        return;
      }
      if (data.success || data.reason === "already_unsubscribed") {
        setState({ kind: "success" });
        return;
      }
      setState({ kind: "error", message: "Unexpected response." });
    } catch {
      setState({ kind: "error", message: "Network error — please try again." });
    }
  };

  return (
    <WebsiteLayout>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.kind === "validating" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating your link…
              </div>
            )}

            {state.kind === "valid" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Click the button below to unsubscribe from Veloxis emails.
                  You'll continue to receive essential account and security
                  notifications.
                </p>
                <Button onClick={handleConfirm} className="w-full">
                  Confirm Unsubscribe
                </Button>
              </>
            )}

            {state.kind === "submitting" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </div>
            )}

            {(state.kind === "success" || state.kind === "already") && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">
                    {state.kind === "success"
                      ? "You've been unsubscribed."
                      : "You've already unsubscribed."}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  If this was a mistake, contact{" "}
                  <a
                    href="mailto:support@veloxis.co.uk"
                    className="underline"
                  >
                    support@veloxis.co.uk
                  </a>
                  .
                </p>
                <Link to="/" className="text-sm underline">
                  Return to homepage
                </Link>
              </div>
            )}

            {(state.kind === "invalid" || state.kind === "error") && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                  <span className="text-sm">{state.message}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Need help? Contact{" "}
                  <a
                    href="mailto:support@veloxis.co.uk"
                    className="underline"
                  >
                    support@veloxis.co.uk
                  </a>
                  .
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </WebsiteLayout>
  );
}
