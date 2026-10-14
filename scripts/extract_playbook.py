import os
import sys
import time
import json
import pypdfium2
import numpy as np
from concurrent.futures import ProcessPoolExecutor, as_completed
from rapidocr_onnxruntime import RapidOCR

PDF_PATH = r"F:\Ui_Ux\822515540-The-UI-UX-Playbook.pdf"
OUTPUT_MD = r"F:\Ui_Ux\822515540-The-UI-UX-Playbook.md"
CACHE_JSON = r"F:\Planner\scripts\playbook_ocr_cache.json"

def ocr_single_page(args):
    page_idx, pdf_path = args
    try:
        ocr = RapidOCR()
        doc = pypdfium2.PdfDocument(pdf_path)
        page = doc[page_idx]
        bmp = page.render(scale=1.25)
        img = np.array(bmp.to_pil())
        res, _ = ocr(img)
        lines = []
        if res:
            for item in res:
                box = item[0]
                text = item[1]
                score = float(item[2])
                top_y = min(p[1] for p in box)
                bottom_y = max(p[1] for p in box)
                left_x = min(p[0] for p in box)
                height = bottom_y - top_y
                lines.append({
                    "text": text,
                    "top_y": top_y,
                    "left_x": left_x,
                    "height": height,
                    "score": score
                })
        # Sort lines primarily top-to-bottom
        lines.sort(key=lambda l: (round(l["top_y"] / 12) * 12, l["left_x"]))
        return page_idx, lines
    except Exception as e:
        print(f"Error on page {page_idx+1}: {e}", flush=True)
        return page_idx, []

def run_extraction():
    doc = pypdfium2.PdfDocument(PDF_PATH)
    total_pages = len(doc)
    print(f"Total pages in Playbook: {total_pages}", flush=True)
    
    # Check cache if already processed
    cached_data = {}
    if os.path.exists(CACHE_JSON):
        try:
            with open(CACHE_JSON, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
            print(f"Loaded {len(cached_data)} cached pages.", flush=True)
        except Exception:
            cached_data = {}

    to_process = [i for i in range(total_pages) if str(i) not in cached_data]
    print(f"Pages to process: {len(to_process)}", flush=True)

    if to_process:
        tasks = [(i, PDF_PATH) for i in to_process]
        t0 = time.time()
        # Use 3 workers
        with ProcessPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(ocr_single_page, task): task[0] for task in tasks}
            completed_count = 0
            for future in as_completed(futures):
                p_idx, lines = future.result()
                cached_data[str(p_idx)] = lines
                completed_count += 1
                if completed_count % 10 == 0 or completed_count == len(tasks):
                    elapsed = time.time() - t0
                    print(f"Progress: {completed_count}/{len(tasks)} pages OCR'd in {elapsed:.1f}s...", flush=True)
                    # Periodic save
                    with open(CACHE_JSON, "w", encoding="utf-8") as f:
                        json.dump(cached_data, f, ensure_ascii=False)

        with open(CACHE_JSON, "w", encoding="utf-8") as f:
            json.dump(cached_data, f, ensure_ascii=False)

    print("Reconstructing Markdown document...", flush=True)
    md_sections = []
    md_sections.append("# The UI/UX Playbook: Learn Tips, Tricks and Principles to Design Beautiful UI Designs\n")
    md_sections.append("**Publisher:** uxpeak\n")
    md_sections.append("> Complete master guide containing every visual hierarchy tip, proximity principle, clarity formula, alignment rule, contrast method, whitespace guideline, layout technique, typography rule, and interaction cost optimization from The UI/UX Playbook.\n\n---\n")

    for i in range(total_pages):
        page_num = i + 1
        page_lines = cached_data.get(str(i), [])
        if not page_lines:
            continue

        # Extract text lines
        text_lines = []
        for l in page_lines:
            t = l["text"].strip()
            # Filter out lone page artifact like small stray numbers if needed, but keep all genuine content
            if t:
                text_lines.append(t)
        
        if not text_lines:
            continue

        first_line = text_lines[0]
        # Clean header text
        header_title = first_line
        if first_line.lower() == "uxpeak" and len(text_lines) > 1:
            header_title = text_lines[1]
            body_lines = text_lines[2:]
        else:
            body_lines = text_lines[1:]

        md_sections.append(f"\n<!-- Page {page_num} -->\n### [Page {page_num}] {header_title}\n")
        
        # Format body lines
        formatted_body = []
        for bline in body_lines:
            if bline.lower() == "uxpeak":
                continue
            if any(bline.startswith(prefix) for prefix in ["•", "-", "*", "1.", "2.", "3.", "4.", "5."]):
                formatted_body.append(f"- {bline.lstrip('•-* ')}")
            elif bline.isupper() and len(bline) < 40:
                formatted_body.append(f"\n#### {bline}\n")
            elif bline.lower() in ["do", "don't", "tip", "rule", "example", "why it works"]:
                formatted_body.append(f"\n**{bline.upper()}**:")
            else:
                formatted_body.append(bline)

        md_sections.append("\n".join(formatted_body))
        md_sections.append("\n\n---")

    full_md = "\n".join(md_sections)
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write(full_md)
    print(f"Successfully generated {OUTPUT_MD} ({len(full_md)} characters)", flush=True)

if __name__ == "__main__":
    run_extraction()
