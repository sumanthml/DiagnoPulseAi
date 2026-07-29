"""
Smart Diagnostics - Data Anonymization Engine
Scrubs Personally Identifiable Information (PII) before submitting metric payloads
to external LLMs (Groq API), maintaining HIPAA design principles.
"""

from typing import Dict, Any, List


class AnonymizerService:
    """Anonymizes patient lab data for compliant AI summary generation."""

    @staticmethod
    def sanitize_for_ai(
        test_type: str,
        patient_age: int,
        patient_gender: str,
        metrics: List[Dict[str, Any]],
        evaluated_flags: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Produces a completely anonymized payload stripped of PII
        (names, emails, phone numbers, SSN, MRNs).
        """
        anonymized_metrics = []
        for m in metrics:
            anonymized_metrics.append({
                "metric_name": m.get("name") or m.get("metric_name"),
                "value": m.get("value"),
                "unit": m.get("unit")
            })

        anonymized_flags = []
        for f in evaluated_flags:
            anonymized_flags.append({
                "metric_name": f.get("metric_name"),
                "severity": f.get("severity"),
                "message": f.get("message"),
                "ref_range": f"{f.get('ref_min', 0)} - {f.get('ref_max', 0)} {f.get('unit', '')}"
            })

        return {
            "test_type": test_type,
            "patient_demographics": {
                "age": patient_age,
                "gender": patient_gender
                # NO name, MRN, email, or address
            },
            "metrics": anonymized_metrics,
            "evaluated_flags": anonymized_flags
        }
