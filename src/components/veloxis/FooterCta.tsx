import { Link } from "react-router-dom";

export function FooterCta() {
  return (
    <section className="bg-[#0d9488] py-[60px]">
      <div className="mx-auto max-w-[960px] px-8 text-center">
        <h2 className="text-[34px] font-medium text-white">
          Your invoice is an asset. Convert it to cash.
        </h2>
        <p className="mx-auto mt-3 mb-[26px] max-w-[440px] text-[15px] text-[#99f6e4]">
          Join exporters from emerging markets worldwide growing faster because they are not waiting 60 days to be paid.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/contact"
            className="rounded-[10px] bg-white px-[26px] py-3 text-[14px] font-medium text-[#0d9488] hover:bg-[#f0fdfa] transition-colors"
          >
            Apply now →
          </Link>
          <Link
            to="/contact"
            className="rounded-[10px] px-[26px] py-3 text-[14px] font-medium text-white transition-colors hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.4)" }}
          >
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
