// One-off: rerun just the 15 highest-scoring ideas from the 50-idea v3
// run, against v4, to check the verdict-shape fix at the top of the range.

const BASE_URL = "http://localhost:3000";

const TOP_15_BEFORE = [
  { idea: "Payments infrastructure for businesses sending money to countries most providers refuse to serve.", before: 77, beforeVerdict: "Regulatory relationships and compliance infrastructure are the real moat, not the technology." },
  { idea: "Regulatory-compliant payment rails built specifically for licensed cannabis dispensaries.", before: 74, beforeVerdict: "Cannabis banking is genuinely blocked by federal law; solving it requires regulatory relationships, not just code." },
  { idea: "A closed-loop recycling system for lithium-ion batteries using a patented metal extraction process.", before: 71, beforeVerdict: "Real regulatory tailwind and material recovery value, but patent strength and unit economics remain unproven at scale." },
  { idea: "Proprietary sensor hardware that detects crop disease in fields before symptoms are visible to the eye.", before: 69, beforeVerdict: "Early disease detection is real and valuable, but sensor hardware is expensive to develop and farmers already use cheaper visual scouting and agronomist networks." },
  { idea: "Underwriting software that helps banks issue small business loans in regions most lenders avoid.", before: 66, beforeVerdict: "Real pain and a buyer with budget, but underwriting software is table stakes—the moat is data and relationships, not code." },
  { idea: "A combined hardware and software system that detects water leaks in apartment buildings in real time.", before: 66, beforeVerdict: "Real pain and a buyer with budget, but water detection hardware already exists—your moat is installation scale and landlord relationships, not the sensors." },
  { idea: "A proprietary genomic testing panel for diagnosing rare pediatric diseases.", before: 65, beforeVerdict: "Real pain and regulatory moat, but competing against established labs with larger panels and insurance relationships." },
  { idea: "A rental service for underwater drones used by marine researchers.", before: 64, beforeVerdict: "Marine researchers have real budget for this, but underwater drones are capital equipment with high switching costs and specialized support needs." },
  { idea: "A specialized ERP system built specifically for shipyards and marine construction firms.", before: 63, beforeVerdict: "Real pain in a capital-intensive industry, but entrenched competitors already own the relationships." },
  { idea: "Managed backup infrastructure specifically built for hospital patient record systems.", before: 62, beforeVerdict: "Hospitals already buy backup infrastructure; you need to explain why they switch from their incumbent vendor." },
  { idea: "Compliance software that helps EU companies prepare for a new data protection regulation taking effect next year.", before: 60, beforeVerdict: "Real deadline and clear buyer, but the market shrinks once compliance happens and free guidance from regulators competes." },
  { idea: "Industrial predictive maintenance using proprietary vibration sensors and machine learning models.", before: 60, beforeVerdict: "Real pain and real buyers, but vibration sensors exist and ML models are commoditizing—the moat is unclear." },
  { idea: "An API that automatically checks fintech products against changing regulatory requirements.", before: 56, beforeVerdict: "Real pain for a real buyer, but regulatory guidance and compliance consultants already solve this—you need a defensible data or relationship moat." },
  { idea: "A vertical SaaS platform for scheduling, billing, and records at independent veterinary clinics.", before: 56, beforeVerdict: "Veterinary clinics have real pain here, but Vetster, Shepherd, and Covetrus already own the market with entrenched relationships." },
  { idea: "A wearable that monitors stress in hospital workers using skin conductivity sensors.", before: 55, beforeVerdict: "Hospitals already track burnout through surveys; unclear why they'd buy wearables instead of addressing root causes." },
];

async function scoreOne(idea) {
  const res = await fetch(`${BASE_URL}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  return res.json();
}

async function main() {
  const results = [];
  for (const item of TOP_15_BEFORE) {
    const data = await scoreOne(item.idea);
    results.push({ ...item, after: data.total, afterVerdict: data.verdict, cached: data.cached });
    console.error(`[${item.before} -> ${data.total}] ${item.idea}`);
  }
  console.log(JSON.stringify(results, null, 2));
}

main();
