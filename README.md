# DRUKZI (Stage 1)
Static, in-browser Dzongkha assistant. No AI APIs, no backend.
**Pipeline:** input (Dzongkha/English/mixed) -> NLLB-200 600M (dzo->eng, only Tibetan-script runs) -> Qwen2.5-0.5B-Instruct (answers, with history) -> NLLB (eng->dzo) -> MMS-TTS-dzo.
**Run:** serve the folder over HTTPS or localhost (e.g. `npx serve .`), or push to GitHub Pages/Netlify. Models download from Hugging Face on first use (~1 GB: Qwen q4f16/q8 ~0.4 GB, NLLB q8 ~0.6 GB) and are cached by the browser (Cache API). The Transformers.js library loads from jsDelivr, so first load needs internet; cache the library (or vendor it into `js/`) for fully offline use.
**Dzongkha voice:** no ONNX build of `facebook/mms-tts-dzo` is published. Export it to Transformers.js layout in `models/mms-tts-dzo/` (config, tokenizer files, `onnx/model.onnx`), e.g. via `optimum-cli export onnx --model facebook/mms-tts-dzo models/mms-tts-dzo`, then move model.onnx into `onnx/`. UNTESTED. Licence is CC-BY-NC-4.0 (non-commercial); NLLB is also CC-BY-NC.
**Known limits:** Dzongkha quality is bounded by NLLB; a 0.5B LLM knows little about Bhutan, so expect wrong or thin answers. Replies show the English pivot so users can check. Not yet built: voice input, wake word, streaming, test suite. Offline mode and quality are UNTESTED.
**Datasets:** see docs/DATASETS.md.

**Speed:** do NOT open index.html as file://. Run `npx serve .` (serve.json enables multi-threaded WASM) and open the http://localhost URL in Chrome/Edge. Models then cache after the first load.

## FAST LOCAL MODE (recommended): Ollama + CTranslate2
All on your own machine, no cloud. The app auto-detects it and skips the in-browser models.
1. Install Ollama (ollama.com), then: `ollama pull qwen2.5:3b` (use `qwen2.5:7b` if you have a GPU/16 GB RAM).
2. `pip install ctranslate2 transformers sentencepiece torch numpy`
3. One-time: `ct2-transformers-converter --model facebook/nllb-200-distilled-600M --output_dir nllb-ct2 --quantization int8`
4. `python server.py` (keep it running; first /tts call downloads facebook/mms-tts-dzo, so the Dzongkha voice works without ONNX export)
5. In another terminal: `npx serve .` and open the http://localhost URL. Status should say "Local mode".
UNTESTED by me. If the helper is not running, the app falls back to the slower in-browser models.
