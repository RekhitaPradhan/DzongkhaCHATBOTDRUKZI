# DRUKZI — Windows setup

DRUKZI is a text-based English/Dzongkha assistant. It can read documents and analyse uploaded images when a local Ollama vision model is installed. It does not speak replies or use microphone input.

## 1. Install prerequisites

1. Install Python 3.11 (64-bit) and add it to PATH.
2. Install Node.js LTS.
3. Install Ollama from https://ollama.com/download.
4. Open Command Prompt and install the text and vision models:

```bat
ollama pull qwen3:4b
ollama pull moondream
```

`qwen3:4b` answers questions. `moondream` analyses uploaded images. If your computer has enough memory, `gemma3:4b` or `qwen2.5vl:3b` may provide another vision option.

## 2. Start DRUKZI

1. Extract this ZIP to a normal folder, such as `C:\DRUKZI`.
2. Double-click `start_drukzi_windows.bat`.
3. Keep both terminal windows open.
4. Open **http://localhost:3000**.

Do not open `index.html` by double-clicking it. The page must run through the local web server.

## 3. Upload and ask about an image

1. Open a new conversation.
2. Select the paperclip button and choose a JPG, PNG, WEBP or another supported image.
3. Wait until the file chip says it is ready.
4. Type a question about the image, for example:
   - What is shown in this picture?
   - Read the text in this screenshot.
   - Explain this diagram.
   - Solve the question shown in this image.
5. Press Send.

The image is processed locally by the installed Ollama vision model. The image is not sent to a cloud AI API. OCR may also extract readable text.

## 4. Ask about

Open **Explore → Ask about** to browse more than 100 suggested questions grouped into topics, including Bhutan, culture, world geography, science, technology, AI, education and everyday learning. Select any question to send it to DRUKZI.

## 5. Troubleshooting

- **No vision model:** run `ollama pull moondream`, then restart Ollama and refresh DRUKZI.
- **Ollama not found:** reopen Command Prompt and run `ollama list`.
- **Translation helper error:** check the Python terminal; the translation model may need to download or convert on first run.
- **World references unavailable:** check your internet connection. The local model can still answer without Wikipedia retrieval.
- **Image upload appears stuck:** check that the file is a supported image and try a smaller image. Images are resized before analysis.
- **Port already in use:** close old DRUKZI terminal windows before restarting.

## Important

Image understanding requires a compatible local Ollama vision model. OCR can read text but cannot replace visual understanding. Answers may be incorrect, so verify important information. Wikipedia retrieval adds references for some world-knowledge questions but is not a guaranteed or always-current source.
