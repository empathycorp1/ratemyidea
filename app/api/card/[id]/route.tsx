import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCardData } from "@/lib/get-card-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// getCardData() below computes a live rank via a raw pg query — no
// fetch()/cookies()/headers() for Next to notice, so without this a
// GET route handler like this one risks the same fate as app/page.tsx:
// the first-generated image for an id getting cached and served to
// everyone after, showing a rank that's stopped being true.
export const dynamic = "force-dynamic";

// Fonts don't depend on request data — read once at module scope.
// See share-card-preview.html: font-family 'Carlito', Calibri, ...
const carlitoRegular = await readFile(
  join(process.cwd(), "assets/fonts/Carlito-Regular.ttf")
);
const carlitoBold = await readFile(
  join(process.cwd(), "assets/fonts/Carlito-Bold.ttf")
);

/**
 * Truncates for card safety only. share-card-preview.html's four
 * example cards all use short, hand-picked text and never needed
 * this — but a real submission can run up to 280 characters, and this
 * is a fixed 1200x630 canvas, not a page that can grow. Satori doesn't
 * support CSS line-clamping, so the text itself is trimmed in JS.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return new Response("Invalid card id.", { status: 400 });
  }

  const card = await getCardData(idNum);
  if (!card) {
    return new Response("Card not found.", { status: 404 });
  }

  const rankLine = `Ranked ${card.rank.toLocaleString(
    "en-US"
  )} of ${card.totalSubmissions.toLocaleString("en-US")}`.toUpperCase();

  return new ImageResponse(
    (
      // .card.light
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 1200,
          height: 630,
          paddingTop: 62,
          paddingRight: 68,
          paddingBottom: 58,
          paddingLeft: 68,
          background: "#FFFFFF",
          fontFamily: "Carlito",
          color: "#111312",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* .glow.glow1 — blur(110px) isn't reliably supported by
            satori, so the blur is approximated with a radial gradient
            that fades to transparent instead. */}
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            top: -190,
            right: -90,
            borderRadius: 9999,
            opacity: 0.58,
            backgroundImage:
              "radial-gradient(circle, #E8E4FA 0%, rgba(232,228,250,0) 70%)",
          }}
        />
        {/* .glow.glow2 */}
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            bottom: -200,
            right: 180,
            borderRadius: 9999,
            opacity: 0.58,
            backgroundImage:
              "radial-gradient(circle, #FBE4EE 0%, rgba(251,228,238,0) 70%)",
          }}
        />
        {/* .glow.glow3 */}
        <div
          style={{
            position: "absolute",
            width: 380,
            height: 380,
            bottom: -190,
            left: -110,
            borderRadius: 9999,
            opacity: 0.58,
            backgroundImage:
              "radial-gradient(circle, #DFF3E9 0%, rgba(223,243,233,0) 70%)",
          }}
        />

        {/* .inner — position:relative + z-index:1 so this sits above
            the (position:absolute) glows behind it. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* .top */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {/* .brand */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "baseline",
                fontSize: 21,
                letterSpacing: 2.1,
                color: "#8A8A8A",
              }}
            >
              <span style={{ color: "#111111", fontWeight: 700 }}>
                RATEMYIDEA
              </span>
              <span>.FUN</span>
            </div>
            {/* .meta.rank */}
            <div
              style={{
                display: "flex",
                fontSize: 21,
                fontWeight: 700,
                letterSpacing: 1.26,
                color: "#111111",
              }}
            >
              {rankLine}
            </div>
          </div>

          {/* .body */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flex: 1,
              alignItems: "center",
              paddingTop: 10,
              paddingBottom: 10,
            }}
          >
            {/* .left */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                marginRight: 60,
              }}
            >
              {/* .idea */}
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  lineHeight: 1.4,
                  color: "#555555",
                  marginBottom: 26,
                }}
              >
                {truncate(card.ideaText, 160)}
              </div>
              {/* .verdict — the largest text, and the point of the card */}
              <div
                style={{
                  display: "flex",
                  fontSize: 46,
                  lineHeight: 1.22,
                  letterSpacing: -1.012,
                  fontWeight: 700,
                  color: "#111111",
                }}
              >
                {truncate(card.verdict, 140)}
              </div>
            </div>

            {/* .right */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                alignItems: "flex-end",
                textAlign: "right",
              }}
            >
              {/* .score — the only coloured element on the card.
                  letter-spacing corrected to .015em (was -.05em, which
                  made repeated digits touch and read as one shape —
                  e.g. a 44 looked like a single glyph at this size). */}
              <div
                style={{
                  display: "flex",
                  fontSize: 210,
                  lineHeight: 0.82,
                  letterSpacing: 3.15,
                  fontWeight: 700,
                  color: "#362C7A",
                }}
              >
                {card.total}
              </div>
              {/* .outof.meta */}
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  letterSpacing: 1.92,
                  marginTop: 10,
                  color: "#6E6E6E",
                }}
              >
                OUT OF 100
              </div>
            </div>
          </div>

          {/* .rule */}
          <div style={{ display: "flex", height: 1, width: "100%", background: "#E5E5E5" }} />

          {/* .foot */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 26,
            }}
          >
            {/* .meta (category) */}
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 1.2, color: "#6E6E6E" }}>
              {card.category.toUpperCase()}
            </div>
            {/* .cta */}
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#111111" }}>
              Rate yours &rarr;
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Carlito", data: carlitoRegular, weight: 400, style: "normal" },
        { name: "Carlito", data: carlitoBold, weight: 700, style: "normal" },
      ],
      headers: {
        // Scores are immutable, but rank shifts as new ideas get
        // scored — cache briefly, not forever.
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    }
  );
}
