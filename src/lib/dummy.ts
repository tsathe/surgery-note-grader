import { SurgeryNote, RubricDomain } from "@/lib/types"

export const DUMMY_NOTES: SurgeryNote[] = [
  {
    id: "n1",
    title: "Appendectomy – Patient A",
    content:
      "Patient presented with 24h abdominal pain localized to RLQ. WBC 13K. CT consistent with acute appendicitis. Underwent laparoscopic appendectomy. Findings: inflamed non-perforated appendix. EBL 25 mL. No complications. Disposition: PACU, then floor with clear liquids, advance as tolerated.",
    patient_info: "34M, NKDA",
    surgery_date: "2025-01-05",
    surgeon: "Dr. Smith",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "n2",
    title: "Cholecystectomy – Patient B",
    content:
      "Elective laparoscopic cholecystectomy for symptomatic cholelithiasis. Critical view obtained. Cystic duct and artery clipped and divided. Gallbladder removed in endocatch. No bile spillage. Discharged home same day with low-fat diet instructions.",
    patient_info: "45F, PCN allergy",
    surgery_date: "2025-01-03",
    surgeon: "Dr. Lee",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "n3",
    title: "Inguinal Hernia Repair – Patient C",
    content:
      "Right inguinal hernia repair with mesh. Indirect hernia sac identified and reduced. Mesh placed and secured without tension. No complications. Stable to PACU. Follow-up in clinic in 2 weeks.",
    patient_info: "62M, HTN controlled",
    surgery_date: "2025-01-01",
    surgeon: "Dr. Patel",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]




