"""
Smart Diagnostics - Diagnostic Analyzer Strategies (Polymorphism)
Implements Strategy Pattern for dynamic range evaluation across diagnostic panels:
- Blood Test (CBC)
- Lipid Profile
- Thyroid Profile
- Liver Function Test
- Comprehensive Metabolic Panel
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
from app.domain.models import MetricEntry, FlagSeverity, DomainException


class DiagnosticAnalyzerStrategy(ABC):
    """Abstract Strategy interface for dynamic diagnostic range evaluation."""

    @abstractmethod
    def get_test_type(self) -> str:
        """Returns the canonical name of the test panel."""
        pass

    @abstractmethod
    def evaluate_ranges(self, metrics: List[MetricEntry], age: int, gender: str) -> List[Dict[str, Any]]:
        """Evaluates raw metric values against clinical reference bounds."""
        pass


class BloodTestStrategy(DiagnosticAnalyzerStrategy):
    """Polymorphic strategy for Complete Blood Count (CBC).

    POLYMORPHISM: Implements evaluate_ranges() contract from DiagnosticAnalyzerStrategy.
    ENCAPSULATION: Reference bounds are private to this class; no external access.
    """

    def get_test_type(self) -> str:
        return "Complete Blood Count (CBC)"

    def evaluate_ranges(self, metrics: List[MetricEntry], age: int, gender: str) -> List[Dict[str, Any]]:
        flags = []
        is_male = gender.upper() in ["M", "MALE"]

        # Hemoglobin (Hb) bounds (g/dL) — gender-adjusted
        min_hb = 13.8 if is_male else 12.1
        max_hb = 17.2 if is_male else 15.1

        ref_bounds = {
            "Hemoglobin": {"min": min_hb, "max": max_hb, "critical_low": 7.0, "critical_high": 20.0, "unit": "g/dL"},
            "WBC": {"min": 4.5, "max": 11.0, "critical_low": 2.0, "critical_high": 30.0, "unit": "10^3/\u00b5L"},
            "RBC": {"min": 4.3 if is_male else 3.8, "max": 5.9 if is_male else 5.2, "unit": "10^6/\u00b5L"},
            "Platelets": {"min": 150.0, "max": 450.0, "critical_low": 50.0, "critical_high": 1000.0, "unit": "10^3/\u00b5L"},
        }

        for entry in metrics:
            bounds = ref_bounds.get(entry.name)
            if not bounds:
                continue

            val = entry.value
            severity = FlagSeverity.NORMAL
            message = "Within reference limits"

            if "critical_low" in bounds and val < bounds["critical_low"]:
                severity = FlagSeverity.CRITICAL
                message = f"CRITICAL: Dangerously low — immediate clinical attention required ({bounds['critical_low']} {bounds['unit']})"
            elif "critical_high" in bounds and val > bounds["critical_high"]:
                severity = FlagSeverity.CRITICAL
                message = f"CRITICAL: Dangerously elevated — immediate clinical attention required ({bounds['critical_high']} {bounds['unit']})"
            elif val < bounds["min"]:
                severity = FlagSeverity.LOW
                message = f"Below normal threshold ({bounds['min']} {bounds['unit']})"
            elif val > bounds['max']:
                severity = FlagSeverity.HIGH
                message = f"Above normal threshold ({bounds['max']} {bounds['unit']})"

            flags.append({
                "metric_name": entry.name,
                "value": val,
                "unit": entry.unit,
                "ref_min": bounds["min"],
                "ref_max": bounds["max"],
                "severity": severity.value,
                "message": message
            })
        return flags



class LipidProfileStrategy(DiagnosticAnalyzerStrategy):
    """Polymorphic strategy for Lipid Profile."""

    def get_test_type(self) -> str:
        return "Lipid Profile"

    def evaluate_ranges(self, metrics: List[MetricEntry], age: int, gender: str) -> List[Dict[str, Any]]:
        flags = []
        is_male = gender.upper() in ["M", "MALE"]

        ref_bounds = {
            "Total Cholesterol": {"max": 200.0, "unit": "mg/dL"},
            "HDL Cholesterol": {"min": 40.0 if is_male else 50.0, "unit": "mg/dL"},
            "LDL Cholesterol": {"max": 100.0, "unit": "mg/dL"},
            "Triglycerides": {"max": 150.0, "unit": "mg/dL"},
        }

        for entry in metrics:
            bounds = ref_bounds.get(entry.name)
            if not bounds:
                continue

            val = entry.value
            severity = FlagSeverity.NORMAL
            message = "Optimal level"

            if "max" in bounds and val > bounds["max"]:
                severity = FlagSeverity.HIGH if val < (bounds["max"] * 1.3) else FlagSeverity.CRITICAL
                message = f"Elevated level (Target < {bounds['max']} {bounds['unit']})"
            elif "min" in bounds and val < bounds["min"]:
                severity = FlagSeverity.LOW
                message = f"Below recommended limit (Target >= {bounds['min']} {bounds['unit']})"

            flags.append({
                "metric_name": entry.name,
                "value": val,
                "unit": entry.unit,
                "ref_min": bounds.get("min", 0.0),
                "ref_max": bounds.get("max", 999.0),
                "severity": severity.value,
                "message": message
            })
        return flags


class ThyroidProfileStrategy(DiagnosticAnalyzerStrategy):
    """Polymorphic strategy for Thyroid Panel."""

    def get_test_type(self) -> str:
        return "Thyroid Profile"

    def evaluate_ranges(self, metrics: List[MetricEntry], age: int, gender: str) -> List[Dict[str, Any]]:
        flags = []
        ref_bounds = {
            "TSH": {"min": 0.45, "max": 4.5, "unit": "mIU/L"},
            "Free T3": {"min": 2.0, "max": 4.4, "unit": "pg/mL"},
            "Free T4": {"min": 0.8, "max": 1.8, "unit": "ng/dL"},
        }

        for entry in metrics:
            bounds = ref_bounds.get(entry.name)
            if not bounds:
                continue

            val = entry.value
            severity = FlagSeverity.NORMAL
            message = "Normal thyroid activity"

            if val < bounds["min"]:
                severity = FlagSeverity.LOW
                message = f"Suppressed level (Ref: {bounds['min']}-{bounds['max']})"
            elif val > bounds["max"]:
                severity = FlagSeverity.HIGH
                message = f"Elevated level (Ref: {bounds['min']}-{bounds['max']})"

            flags.append({
                "metric_name": entry.name,
                "value": val,
                "unit": entry.unit,
                "ref_min": bounds["min"],
                "ref_max": bounds["max"],
                "severity": severity.value,
                "message": message
            })
        return flags


class LiverFunctionStrategy(DiagnosticAnalyzerStrategy):
    """Polymorphic strategy for Liver Function Panel."""

    def get_test_type(self) -> str:
        return "Liver Function Test"

    def evaluate_ranges(self, metrics: List[MetricEntry], age: int, gender: str) -> List[Dict[str, Any]]:
        flags = []
        ref_bounds = {
            "ALT": {"min": 7.0, "max": 56.0, "unit": "U/L"},
            "AST": {"min": 10.0, "max": 40.0, "unit": "U/L"},
            "Total Bilirubin": {"min": 0.1, "max": 1.2, "unit": "mg/dL"},
            "Albumin": {"min": 3.4, "max": 5.4, "unit": "g/dL"},
        }

        for entry in metrics:
            bounds = ref_bounds.get(entry.name)
            if not bounds:
                continue

            val = entry.value
            severity = FlagSeverity.NORMAL
            message = "Normal hepatic indicator"

            if val < bounds["min"]:
                severity = FlagSeverity.LOW
                message = f"Below range ({bounds['min']}-{bounds['max']} {bounds['unit']})"
            elif val > bounds["max"]:
                severity = FlagSeverity.HIGH if val < (bounds["max"] * 2) else FlagSeverity.CRITICAL
                message = f"Elevated hepatic enzyme ({bounds['min']}-{bounds['max']} {bounds['unit']})"

            flags.append({
                "metric_name": entry.name,
                "value": val,
                "unit": entry.unit,
                "ref_min": bounds["min"],
                "ref_max": bounds["max"],
                "severity": severity.value,
                "message": message
            })
        return flags


class MetabolicPanelStrategy(DiagnosticAnalyzerStrategy):
    """Polymorphic strategy for Comprehensive Metabolic Panel."""

    def get_test_type(self) -> str:
        return "Metabolic Panel"

    def evaluate_ranges(self, metrics: List[MetricEntry], age: int, gender: str) -> List[Dict[str, Any]]:
        flags = []
        ref_bounds = {
            "Fasting Glucose": {"min": 70.0, "max": 99.0, "unit": "mg/dL"},
            "Serum Creatinine": {"min": 0.7, "max": 1.3, "unit": "mg/dL"},
            "Sodium": {"min": 135.0, "max": 145.0, "unit": "mEq/L"},
            "Potassium": {"min": 3.5, "max": 5.0, "unit": "mEq/L"},
        }

        for entry in metrics:
            bounds = ref_bounds.get(entry.name)
            if not bounds:
                continue

            val = entry.value
            severity = FlagSeverity.NORMAL
            message = "Within metabolic limits"

            if val < bounds["min"]:
                severity = FlagSeverity.LOW
                message = f"Low level (Ref: {bounds['min']}-{bounds['max']} {bounds['unit']})"
            elif val > bounds["max"]:
                severity = FlagSeverity.HIGH
                message = f"Elevated level (Ref: {bounds['min']}-{bounds['max']} {bounds['unit']})"

            flags.append({
                "metric_name": entry.name,
                "value": val,
                "unit": entry.unit,
                "ref_min": bounds["min"],
                "ref_max": bounds["max"],
                "severity": severity.value,
                "message": message
            })
        return flags


class UrineAnalysisStrategy(DiagnosticAnalyzerStrategy):
    """Polymorphic strategy for Urinalysis (Urine Routine Examination).

    POLYMORPHISM: 6th concrete implementation of DiagnosticAnalyzerStrategy.
    Demonstrates that the Strategy Pattern is fully extensible — new clinical
    panels can be added without modifying any existing code (Open/Closed Principle).
    """

    def get_test_type(self) -> str:
        return "Urinalysis"

    def evaluate_ranges(self, metrics: List[MetricEntry], age: int, gender: str) -> List[Dict[str, Any]]:
        flags = []
        ref_bounds = {
            "Urine pH": {"min": 4.5, "max": 8.0, "unit": "pH"},
            "Specific Gravity": {"min": 1.005, "max": 1.030, "unit": "SG"},
            "Protein (Urine)": {"min": 0.0, "max": 14.0, "unit": "mg/dL"},
            "Glucose (Urine)": {"min": 0.0, "max": 15.0, "unit": "mg/dL"},
            "WBC (Urine)": {"min": 0.0, "max": 5.0, "unit": "cells/\u00b5L"},
        }

        for entry in metrics:
            bounds = ref_bounds.get(entry.name)
            if not bounds:
                continue

            val = entry.value
            severity = FlagSeverity.NORMAL
            message = "Within normal urinalysis limits"

            if val < bounds["min"]:
                severity = FlagSeverity.LOW
                message = f"Below acceptable range ({bounds['min']}-{bounds['max']} {bounds['unit']})"
            elif val > bounds["max"]:
                severity = FlagSeverity.HIGH if val < (bounds["max"] * 2) else FlagSeverity.CRITICAL
                message = f"Elevated beyond normal limit (Ref: {bounds['min']}-{bounds['max']} {bounds['unit']})"

            flags.append({
                "metric_name": entry.name,
                "value": val,
                "unit": entry.unit,
                "ref_min": bounds["min"],
                "ref_max": bounds["max"],
                "severity": severity.value,
                "message": message
            })
        return flags


class StrategyFactory:
    """Factory to instantiate the concrete DiagnosticAnalyzerStrategy for a given panel.

    ABSTRACTION: Application code calls StrategyFactory.get_strategy(test_type) without
    knowing which concrete strategy will be returned. The factory resolves the mapping
    internally, decoupling the caller from strategy implementation details.
    """

    _strategies: Dict[str, DiagnosticAnalyzerStrategy] = {
        "cbc": BloodTestStrategy(),
        "complete blood count": BloodTestStrategy(),
        "lipid": LipidProfileStrategy(),
        "lipid profile": LipidProfileStrategy(),
        "thyroid": ThyroidProfileStrategy(),
        "thyroid profile": ThyroidProfileStrategy(),
        "liver": LiverFunctionStrategy(),
        "liver function test": LiverFunctionStrategy(),
        "metabolic": MetabolicPanelStrategy(),
        "metabolic panel": MetabolicPanelStrategy(),
        "urine": UrineAnalysisStrategy(),
        "urinalysis": UrineAnalysisStrategy(),
        "urine routine": UrineAnalysisStrategy(),
    }

    @classmethod
    def get_strategy(cls, test_type: str) -> DiagnosticAnalyzerStrategy:
        normalized = test_type.strip().lower()
        for key, strategy in cls._strategies.items():
            if key in normalized or normalized in key:
                return strategy
        # Fallback to BloodTestStrategy
        return BloodTestStrategy()

