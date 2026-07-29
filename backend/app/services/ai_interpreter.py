"""
Smart Diagnostics - AI Report Interpreter Service (Abstraction)
Integrates Groq API (LLaMA 3.3 70B model) to generate sub-second,
plain-language clinical interpretations of anonymized patient metric flags.
"""

import os
from abc import ABC, abstractmethod
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


class IReportInterpreter(ABC):
    """Abstract interface decoupling AI engine from core business domain."""

    @abstractmethod
    async def interpret(self, anonymized_payload: Dict[str, Any]) -> str:
        """Generates structured medical interpretation from anonymized metric flags."""
        pass


class GroqAIInterpreter(IReportInterpreter):
    """Concrete Groq AI Interpreter utilizing LLaMA models for sub-second inference."""

    def __init__(self):
        self._api_key = GROQ_API_KEY
        self._model = GROQ_MODEL
        self._client = None

        if self._api_key:
            try:
                from groq import AsyncGroq
                self._client = AsyncGroq(api_key=self._api_key)
            except Exception as e:
                print(f"Groq SDK Initialization Notice: {e}")

    async def interpret(self, anonymized_payload: Dict[str, Any]) -> str:
        """Sends anonymized lab flags to Groq API or fallback generator."""

        # 1. Check if Groq client is available
        if self._client:
            try:
                prompt = self._build_prompt(anonymized_payload)
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are Smart Diagnostics AI, an elite clinical laboratory pathologist consultant. "
                                "Provide clear, compassionate, and medically accurate summaries of diagnostic metrics. "
                                "Translate complex lab parameters into clear feedback for patients and clinical notes for doctors. "
                                "Never fabricate data. Highlight low/high flags explicitly."
                            )
                        },
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=600,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                print(f"Groq API call warning ({e}). Utilizing clinical fallback summary engine.")

        # 2. Local Fallback Generator if Groq fails or key unavailable
        return self._generate_fallback_summary(anonymized_payload)

    def _build_prompt(self, payload: Dict[str, Any]) -> str:
        test_type = payload.get("test_type", "Lab Test")
        demo = payload.get("patient_demographics", {})
        metrics = payload.get("metrics", [])
        flags = payload.get("evaluated_flags", [])

        metrics_text = "\n".join([f"- {m['metric_name']}: {m['value']} {m['unit']}" for m in metrics])
        flags_text = "\n".join([f"- {f['metric_name']} ({f['severity']}): {f['message']} [Ref: {f['ref_range']}]" for f in flags])

        return f"""
Diagnopulse Medical Interpretation Request:
Test Panel: {test_type}
Patient Demographics: Age {demo.get('age', 'N/A')}, Gender {demo.get('gender', 'N/A')}

Measured Metrics:
{metrics_text}

Clinical Range Flags:
{flags_text}

Instructions:
1. Provide a concise 2-3 paragraph Medical Interpretation Summary.
2. Clearly explain any abnormal or critical flags in simple terms.
3. Suggest next steps or routine diagnostic follow-ups for the primary physician.
"""

    def _generate_fallback_summary(self, payload: Dict[str, Any]) -> str:
        test_type = payload.get("test_type", "Diagnostic Panel")
        flags = payload.get("evaluated_flags", [])

        abnormal = [f for f in flags if f.get("severity") in ["LOW", "HIGH", "CRITICAL"]]

        if not abnormal:
            return (
                f"Clinical Summary for {test_type}:\n"
                "All measured laboratory parameters fall within standard physiological reference intervals. "
                "No abnormal biological flags or biochemical risks were detected during range validation."
            )

        flag_details = "; ".join([f"{f['metric_name']} ({f['severity']}: {f['message']})" for f in abnormal])
        return (
            f"Clinical Summary for {test_type}:\n"
            f"Range validation identified {len(abnormal)} abnormal metric flag(s): {flag_details}.\n\n"
            "Clinical Impression: The observed deviations may reflect transient physiological variations or targeted health indicators. "
            "It is recommended that the attending physician correlate these findings with clinical history and consider follow-up testing."
        )
