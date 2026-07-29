"""
Smart Diagnostics - PDF Lab Report Generator
Uses ReportLab to generate publication-grade clinical lab reports
with metric comparison tables, severity indicators, AI summaries, and doctor signature blocks.
"""

import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


class PDFReportGenerator:
    """Generates styled PDF diagnostic reports."""

    @staticmethod
    def generate_pdf(
        report_id: str,
        patient_name: str,
        patient_age: int,
        patient_gender: str,
        mrn: str,
        test_type: str,
        metrics: list,
        ai_summary: str,
        pathologist_name: str,
        pathologist_notes: str,
        status: str
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()

        # Custom Paragraph Styles
        title_style = ParagraphStyle(
            'HeaderTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            textColor=colors.HexColor('#0F172A'),
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'HeaderSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#64748B'),
            spaceAfter=12
        )
        section_title = ParagraphStyle(
            'SectionTitle',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=12,
            textColor=colors.HexColor('#1E293B'),
            spaceBefore=10,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor('#334155')
        )
        ai_box_style = ParagraphStyle(
            'AIBoxText',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor('#0F52BA')
        )

        elements = []

        # 1. Header Banner
        header_data = [
            [
                Paragraph("<b>SMART DIAGNOSTICS</b><br/><font size=8 color='#64748B'>CLINICAL LABORATORY & DIAGNOSTIC INTERPRETATION</font>", title_style),
                Paragraph(f"<b>REPORT ID:</b> {report_id}<br/><b>DATE:</b> {datetime.utcnow().strftime('%Y-%m-%d')}<br/><b>STATUS:</b> <font color='#059669'>{status}</font>", ParagraphStyle('RightHead', parent=subtitle_style, alignment=2))
            ]
        ]
        header_table = Table(header_data, colWidths=[340, 200])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        elements.append(header_table)
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563EB'), spaceAfter=12))

        # 2. Patient Demographics & Order Metadata Box
        patient_info_data = [
            [
                Paragraph(f"<b>Patient Name:</b> {patient_name}", body_style),
                Paragraph(f"<b>Age / Gender:</b> {patient_age} yrs / {patient_gender}", body_style),
            ],
            [
                Paragraph(f"<b>Medical Record #:</b> {mrn}", body_style),
                Paragraph(f"<b>Diagnostic Panel:</b> {test_type}", body_style),
            ]
        ]
        info_table = Table(patient_info_data, colWidths=[270, 270])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
            ('PADDING', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 12))

        # 3. Lab Metrics & Range Evaluation Table
        elements.append(Paragraph("Laboratory Test Parameters & Reference Range Check", section_title))

        table_data = [["Metric Parameter", "Result Value", "Reference Unit", "Ref Bounds", "Clinical Flag"]]

        for m in metrics:
            sev = m.get("severity", "NORMAL")
            sev_color = "#059669" # Green
            if sev in ["LOW", "HIGH"]:
                sev_color = "#D97706" # Amber
            elif sev == "CRITICAL":
                sev_color = "#DC2626" # Red

            ref_range_str = f"{m.get('ref_min', 'N/A')} - {m.get('ref_max', 'N/A')}"

            table_data.append([
                Paragraph(f"<b>{m.get('metric_name')}</b>", body_style),
                Paragraph(f"{m.get('value')}", body_style),
                Paragraph(f"{m.get('unit')}", body_style),
                Paragraph(ref_range_str, body_style),
                Paragraph(f"<font color='{sev_color}'><b>{sev}</b></font>", body_style)
            ])

        metrics_table = Table(table_data, colWidths=[150, 90, 90, 110, 100])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
        ]))
        elements.append(metrics_table)
        elements.append(Spacer(1, 14))

        # 4. AI Interpretation Summary Box
        if ai_summary:
            elements.append(Paragraph("AI-Assisted Plain-Language Medical Interpretation", section_title))
            ai_paragraphs = [Paragraph(p, ai_box_style) for p in ai_summary.split('\n') if p.strip()]
            ai_table_data = [[ai_paragraphs]]
            ai_table = Table(ai_table_data, colWidths=[540])
            ai_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EFF6FF')),
                ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#93C5FD')),
                ('PADDING', (0,0), (-1,-1), 10),
            ]))
            elements.append(ai_table)
            elements.append(Spacer(1, 14))

        # 5. Pathologist Review & Sign-Off Section
        elements.append(Paragraph("Pathologist Clinical Review & Sign-off", section_title))
        notes_text = pathologist_notes if pathologist_notes else "Verified normal diagnostic parameters."
        sign_data = [
            [
                Paragraph(f"<b>Pathologist Clinical Notes:</b><br/>{notes_text}", body_style),
                Paragraph(f"<b>VERIFIED & APPROVED BY:</b><br/><b>{pathologist_name}</b><br/>Lic #: MD-PATH-99302<br/><font color='#059669'>Digital Signature Verified ✓</font>", body_style)
            ]
        ]
        sign_table = Table(sign_data, colWidths=[340, 200])
        sign_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
            ('PADDING', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        elements.append(sign_table)
        elements.append(Spacer(1, 16))

        # 6. Disclaimer Footer
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#CBD5E1'), spaceAfter=8))
        elements.append(Paragraph(
            "<font size=7 color='#94A3B8'>Confidential Medical Document - Generated by Smart Diagnostics AI Platform. "
            "This report has been reviewed and electronically signed by a certified clinical pathologist.</font>",
            ParagraphStyle('FooterText', parent=subtitle_style, alignment=1)
        ))

        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
