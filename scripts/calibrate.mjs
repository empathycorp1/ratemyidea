// Calibration run per scoring-spec.md's "Calibration set" and
// "Distribution testing" sections. Hits the running dev server's
// /api/score endpoint directly (no code changes, just measurement).
//
// Run it with: node scripts/calibrate.mjs   (dev server must be running)

const BASE_URL = "http://localhost:3000";

const CALIBRATION_SET = [
  { idea: "An AI that writes better prompts for your AI agents", target: [8, 15] },
  { idea: "Uber, but for lawn care in suburban neighbourhoods", target: [18, 28] },
  { idea: "A marketplace for gym equipment nobody in the building uses", target: [28, 38] },
  { idea: "Rent an air mattress in my apartment during a design conference", target: [30, 40] },
  { idea: "Subscription box for niche hot sauces", target: [30, 40] },
  { idea: "Compliance software for a regulation taking effect in 18 months", target: [55, 68] },
  { idea: "Payments infrastructure for a country most providers refuse to serve", target: [70, 82] },
  { idea: "A search engine for the entire internet, better than Google", target: [10, 20] },
];

const FIFTY_IDEAS = [
  "An app that uses AI to summarize your inbox every morning.",
  "A to-do list app with reminders and cloud sync.",
  "A social network exclusively for people who love specialty coffee.",
  "A chatbot that texts you a motivational quote every morning.",
  "A ride-sharing app for a major city that already has Uber and Lyft.",
  "A note-taking app that syncs your notes across all your devices.",
  "A marketplace where businesses can hire freelance logo designers.",
  "An app that reminds you to drink more water and tracks your intake.",
  "An AI tool that writes cover letters for job applications.",
  "A cryptocurrency token people can use to tip their favorite content creators.",
  "Compliance software that helps EU companies prepare for a new data protection regulation taking effect next year.",
  "Underwriting software that helps banks issue small business loans in regions most lenders avoid.",
  "A platform connecting retired engineers with startups that need part-time technical consulting.",
  "A subscription meal kit service for people managing autoimmune-friendly diets.",
  "A SaaS tool that helps restaurants track and reduce food inventory waste.",
  "A marketplace for renting professional camera and video gear by the day.",
  "Payroll automation software built specifically for small nonprofits.",
  "A wearable that monitors stress in hospital workers using skin conductivity sensors.",
  "A local marketplace connecting elderly homeowners with vetted handypeople for small repairs.",
  "An insurance product designed specifically for gig economy delivery drivers.",
  "A wall-mounted smart display that shows your family's shared calendar and chore list.",
  "A subscription box that ships replacement air filters sized to your home's HVAC system.",
  "Payments infrastructure for businesses sending money to countries most providers refuse to serve.",
  "A voice-controlled device that reminds elderly users to take their medication on schedule.",
  "An API that automatically checks fintech products against changing regulatory requirements.",
  "A rental service for underwater drones used by marine researchers.",
  "A retail kiosk that 3D-scans your feet in-store and manufactures custom orthotics on the spot.",
  "An app that lets city residents rent out their unused parking spot by the hour.",
  "Enterprise software that tracks Scope 3 carbon emissions across a company's entire supply chain.",
  "A vertical SaaS platform for scheduling, billing, and records at independent veterinary clinics.",
  "Proprietary sensor hardware that detects crop disease in fields before symptoms are visible to the eye.",
  "Regulatory-compliant payment rails built specifically for licensed cannabis dispensaries.",
  "Fraud detection software trained on a bank's own proprietary transaction history.",
  "Managed backup infrastructure specifically built for hospital patient record systems.",
  "A combined hardware and software system that detects water leaks in apartment buildings in real time.",
  "Enterprise identity verification built for cross-border remittance companies.",
  "A specialized ERP system built specifically for shipyards and marine construction firms.",
  "A proprietary genomic testing panel for diagnosing rare pediatric diseases.",
  "Industrial predictive maintenance using proprietary vibration sensors and machine learning models.",
  "A closed-loop recycling system for lithium-ion batteries using a patented metal extraction process.",
  "A new search engine, built by one developer, intended to replace Google.",
  "A new social network intended to replace Twitter, with no specific niche or differentiator.",
  "Self-driving car software being built by a two-person startup.",
  "A neural interface implant that translates any language in real time, pending FDA approval.",
  "A blockchain donation platform intended to end world hunger.",
  "A dating app that guarantees users will be married within six months.",
  "A new operating system intended to replace Windows and macOS.",
  "A space tourism company founded by a college dropout with no funding secured.",
  "An AI model that claims to predict stock market moves with 95 percent accuracy for retail traders.",
  "A universal basic income platform funded entirely by voluntary donations.",
];

async function scoreOne(idea) {
  const res = await fetch(`${BASE_URL}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  const data = await res.json();
  return data;
}

// Default: calibration set only (cheap, fast — meant to be rerun often
// while tuning the prompt). Pass --fifty to also run the 50-idea
// distribution test.
const runFifty = process.argv.includes("--fifty");

async function main() {
  const calibrationResults = [];
  for (const { idea, target } of CALIBRATION_SET) {
    const data = await scoreOne(idea);
    calibrationResults.push({ idea, target, total: data.total, raw: data });
    console.error(`[calibration] ${data.total ?? "ERR"}  ${idea}`);
  }

  let fiftyResults;
  if (runFifty) {
    fiftyResults = [];
    for (const idea of FIFTY_IDEAS) {
      const data = await scoreOne(idea);
      fiftyResults.push({
        idea,
        total: data.total,
        category: data.category,
        verdict: data.verdict,
        valid: data.valid,
        flagged: data.flagged,
      });
      console.error(`[fifty] ${data.total ?? "ERR"}  ${idea}`);
    }
  }

  console.log(JSON.stringify({ calibrationResults, fiftyResults }, null, 2));
}

main();
