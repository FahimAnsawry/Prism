import os
import re
import sys
import pypdf
import pypdfium2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

PDF_PATH = r"F:\Ui_Ux\732187356-Enhance-UI-1-02-Dark-Version-Portrait.pdf"
OUTPUT_MD = r"F:\Ui_Ux\732187356-Enhance-UI-1-02-Dark-Version-Portrait.md"

def clean_text(text):
    if not text:
        return ""
    # Normalize unicode
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # Replace common replacement characters or broken ligatures if any
    text = text.replace('\ufffd', "'")
    return text.strip()

def process():
    print(f"Reading {PDF_PATH}...")
    reader = pypdf.PdfReader(PDF_PATH)
    doc = pypdfium2.PdfDocument(PDF_PATH)
    total_pages = len(reader.pages)
    print(f"Total pages: {total_pages}")
    
    ocr = RapidOCR()
    
    md_sections = []
    md_sections.append("# Enhance UI: Design for Developers (1.02 Dark Version)\n")
    md_sections.append("**Authors:** Adrian Twarog & George Moller\n")
    md_sections.append("> A comprehensive guide to basic design rules and formulas to create good-looking components, colors, and typography.\n\n---\n")

    for i in range(total_pages):
        page_num = i + 1
        page = reader.pages[i]
        raw_text = page.extract_text() or ""
        cleaned = clean_text(raw_text)
        
        # If text is empty or very short, use OCR
        if len(cleaned) < 40:
            bmp = doc[i].render(scale=2.0)
            img = np.array(bmp.to_pil())
            ocr_res, _ = ocr(img)
            if ocr_res:
                ocr_lines = [line[1] for line in ocr_res]
                ocr_text = "\n".join(ocr_lines)
                if len(ocr_text.strip()) > len(cleaned):
                    cleaned = ocr_text.strip()
        
        if not cleaned:
            continue
            
        # Format the page content
        page_header = f"\n\n<!-- Page {page_num} -->\n"
        
        # Let's see if there's a strong title at the top
        lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
        if not lines:
            continue
            
        first_line = lines[0]
        # Check if first line is a section or chapter header
        formatted_content = ""
        if len(lines) == 1:
            formatted_content = f"**{lines[0]}**\n"
        else:
            # Check if quote
            is_quote = any("" in l or "—" in l or "–" in l or "quote" in l.lower() for l in lines) and len(lines) <= 6
            if is_quote and any(name in cleaned for name in ["Dali", "Angelou", "Spolsky", "Jobs", "Eames", "Rams", "Frank", "Picasso", "Einstein"]):
                formatted_content = f"> *{cleaned.replace(chr(10), ' ')}*\n"
            else:
                # Normal page content
                content_body = "\n".join(lines)
                formatted_content = f"{content_body}\n"
        
        md_sections.append(f"{page_header}\n### [Page {page_num}] {first_line}\n\n{formatted_content}\n---")
        
        if page_num % 50 == 0:
            print(f"Processed {page_num}/{total_pages} pages...")

    full_md = "\n".join(md_sections)
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write(full_md)
    print(f"Successfully generated {OUTPUT_MD} ({len(full_md)} characters)")

if __name__ == "__main__":
    process()
