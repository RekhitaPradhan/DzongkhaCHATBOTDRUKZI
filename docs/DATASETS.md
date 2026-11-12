# Resources (status)
| Verified fact base (docs/facts.json, 70+ entries) | Answers about Bhutan, retrieved directly, no model guessing | Written from general knowledge. Review before relying on it. Add `"dz":"..."` to any entry to override machine translation with human-checked Dzongkha. |
| Resource | Use | Status |
|---|---|---|
| NLLB-200 distilled 600M (Xenova/nllb-200-distilled-600M) | dzo<->eng translation | Used. CC-BY-NC. Dzongkha quality unverified. |
| Qwen2.5-0.5B-Instruct ONNX | English conversation | Used. Check licence on model card. |
| facebook/mms-tts-dzo | Dzongkha speech | Exists, CC-BY-NC-4.0. Needs ONNX export (untested). |
| Dzoseg (KarmaCST) | Tokenizer / segmentation | Not yet integrated; not a chatbot resource. Check licence. |
| Jyoti-77/dzongkha-asr | Speech data | Not yet inspected; for a Stage 2 ASR fine-tune. Not a language model. |
| GovTech DNLP (dnlp.tech.gov.bt) | MT, ASR, TTS, corpus | Hosted services; no public weights found. Verify. |


## Stage 14 translation choice

The local helper now defaults to `kinleyrabgay/nllb-200-600M-dzo-eng-300k`, a community NLLB fine-tune with a Dzongkha-English parallel corpus. Its model card documents both translation directions. This is a community checkpoint, not an official GovTech model. Its licence is CC-BY-NC-4.0, so it is not suitable for commercial use without permission. Translation quality still needs native-speaker evaluation.
