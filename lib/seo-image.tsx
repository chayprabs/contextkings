import { siteConfig } from "@/lib/seo";

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const;

const pillStyle = {
  display: "flex",
  alignItems: "center",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "9999px",
  padding: "12px 20px",
  background: "rgba(255, 255, 255, 0.06)",
  color: "rgba(255, 255, 255, 0.88)",
  fontSize: 22,
  lineHeight: 1,
} as const;

export function SeoSocialImage() {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        padding: 40,
        background:
          "radial-gradient(circle at top left, rgba(71, 122, 255, 0.30), transparent 36%), radial-gradient(circle at bottom right, rgba(39, 198, 255, 0.22), transparent 30%), linear-gradient(135deg, #05070A 0%, #0B1220 100%)",
        color: "#F8FAFC",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          width: "100%",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 32,
          padding: 44,
          background: "rgba(7, 10, 16, 0.74)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                height: 16,
                width: 16,
                borderRadius: 9999,
                background: "#58A6FF",
                boxShadow: "0 0 32px rgba(88, 166, 255, 0.85)",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.05em",
              }}
            >
              {siteConfig.name}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              borderRadius: 9999,
              border: "1px solid rgba(88, 166, 255, 0.28)",
              padding: "10px 18px",
              background: "rgba(88, 166, 255, 0.10)",
              color: "#D9ECFF",
              fontSize: 20,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            CrustData workflow builder
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.06em",
            }}
          >
            Turn research prompts into executable workflows
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.35,
              color: "rgba(248, 250, 252, 0.76)",
              maxWidth: 860,
            }}
          >
            Company research, prospecting, recruiting, and signal monitoring from
            one AI workflow interface.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={pillStyle}>Plain-English planning</div>
          <div style={pillStyle}>File and CSV input</div>
          <div style={pillStyle}>Ranked outputs and reports</div>
        </div>
      </div>
    </div>
  );
}
