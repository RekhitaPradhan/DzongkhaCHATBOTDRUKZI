# Manual tests (run in the browser with Ollama + `python server.py`)
Pass only if the answer contains facts that exist ONLY in your test file.
1. Text question: "Tell me about Bhutan's king". 2. Follow-up: "How long has he reigned?"
3. PDF summary. 4. PDF: "Explain page 5" (answer must match page 5). 5. Screenshot of a Python error: cause + corrected code.
6. Photo of a maths question: correct solution. 7. A chart: title, axes, values. 8. Scanned PDF: text found with page numbers.
9. Two images: "Compare these" mentions both. 10. Ask about the file again without re-uploading.
11. Ask for something not in the file: must say it is not specified. 12. Ask in English, then in Dzongkha: both answered.
Chip must show "✓ Ready" only after reading; with no vision model it must show the ⚠ warning.
