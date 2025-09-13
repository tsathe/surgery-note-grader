import { SurgeryNote, RubricDomain } from "@/lib/types"

export const DUMMY_NOTES: SurgeryNote[] = [
  {
    id: "n1",
    note_text:
      "Patient presented with 24h abdominal pain localized to RLQ. WBC 13K. CT consistent with acute appendicitis. Underwent laparoscopic appendectomy. Findings: inflamed non-perforated appendix. EBL 25 mL. No complications. Disposition: PACU, then floor with clear liquids, advance as tolerated.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "n2",
    note_text:
      "Elective laparoscopic cholecystectomy for symptomatic cholelithiasis. Critical view obtained. Cystic duct and artery clipped and divided. Gallbladder removed in endocatch. No bile spillage. Discharged home same day with low-fat diet instructions.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "n3",
    note_text:
      "Right inguinal hernia repair with mesh. Indirect hernia sac identified and reduced. Mesh placed and secured without tension. No complications. Stable to PACU. Follow-up in clinic in 2 weeks.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]




